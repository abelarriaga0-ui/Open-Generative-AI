"""Unit tests for the financial invariants of the Cloudflare D1 SQLite migration."""
from pathlib import Path
import sqlite3
import unittest
import uuid

SCHEMA = Path(__file__).resolve().parents[1] / "migrations" / "0001_wallet.sql"
PAYPAL_SCHEMA = Path(__file__).resolve().parents[1] / "migrations" / "0002_paypal.sql"


class WalletSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))
        self.db.executescript(PAYPAL_SCHEMA.read_text(encoding="utf-8"))
        self.db.executemany(
            "INSERT INTO wallet_users (id, auth_provider, auth_subject) VALUES (?, 'test', ?)",
            [("user-a", "sub-a"), ("user-b", "sub-b")],
        )
        self.db.executemany("INSERT INTO wallets (user_id) VALUES (?)", [("user-a",), ("user-b",)])
        self.db.execute(
            "INSERT INTO model_prices (model_id, muapi_endpoint, customer_price_cents, enabled) "
            "VALUES ('model-test', 'flux-schnell-image', 350, 1)"
        )

    def tearDown(self):
        self.db.close()

    def balance(self, user):
        return self.db.execute(
            "SELECT available_cents, reserved_cents FROM wallets WHERE user_id=?", (user,)
        ).fetchone()

    def deposit(self, user, cents, ref=None):
        ref = ref or str(uuid.uuid4())
        self.db.execute(
            "INSERT INTO verified_deposits "
            "(id,user_id,payment_provider,payment_reference,amount_cents) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), user, "test-verified", ref, cents),
        )

    def reserve(self, user, job_id, amount=350, idem=None):
        self.db.execute(
            "INSERT INTO generation_jobs (id,user_id,model_id,idempotency_key,price_cents) "
            "VALUES (?,?,?,?,?)",
            (job_id, user, "model-test", idem or job_id, amount),
        )

    def test_first_topup_minimum_then_any_positive_amount(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.deposit("user-a", 1999)
        self.assertEqual(self.balance("user-a"), (0, 0))
        self.deposit("user-a", 2000)
        self.deposit("user-a", 1)
        self.assertEqual(self.balance("user-a"), (2001, 0))
        with self.assertRaises(sqlite3.IntegrityError):
            self.deposit("user-b", 1)
        self.assertEqual(self.balance("user-b"), (0, 0))

    def test_reserve_then_capture(self):
        self.deposit("user-a", 2000)
        self.reserve("user-a", "job-1")
        self.assertEqual(self.balance("user-a"), (1650, 350))
        self.db.execute("UPDATE generation_jobs SET status='completed' WHERE id='job-1'")
        self.assertEqual(self.balance("user-a"), (1650, 0))
        self.assertEqual(self.balance("user-b"), (0, 0))

    def test_release_after_confirmed_failure(self):
        self.deposit("user-a", 2000)
        self.reserve("user-a", "job-2")
        self.db.execute("UPDATE generation_jobs SET status='failed' WHERE id='job-2'")
        self.assertEqual(self.balance("user-a"), (2000, 0))
        ledger_count = self.db.execute(
            "SELECT COUNT(*) FROM wallet_ledger WHERE user_id='user-a'"
        ).fetchone()[0]
        self.assertEqual(ledger_count, 3)  # deposit, reserve, release

    def test_insufficient_balance_rejects_job_atomically(self):
        self.deposit("user-a", 2000)
        with self.assertRaises(sqlite3.IntegrityError):
            self.reserve("user-a", "job-3", 2001)
        self.assertEqual(self.balance("user-a"), (2000, 0))
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM generation_jobs WHERE id='job-3'"
        ).fetchone()[0], 0)

    def test_duplicate_payment_event_never_doubles_credit(self):
        self.deposit("user-a", 2000, "pay-123")
        with self.assertRaises(sqlite3.IntegrityError):
            self.deposit("user-a", 2000, "pay-123")
        self.assertEqual(self.balance("user-a"), (2000, 0))

    def test_replayed_generation_key_never_doubles_reservation(self):
        self.deposit("user-a", 2000)
        self.reserve("user-a", "job-4", idem="same-click")
        with self.assertRaises(sqlite3.IntegrityError):
            self.reserve("user-a", "job-5", idem="same-click")
        self.assertEqual(self.balance("user-a"), (1650, 350))

    def test_terminal_jobs_cannot_be_recharged(self):
        self.deposit("user-a", 2000)
        self.reserve("user-a", "job-6")
        self.db.execute("UPDATE generation_jobs SET status='completed' WHERE id='job-6'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE generation_jobs SET status='failed' WHERE id='job-6'")
        self.assertEqual(self.balance("user-a"), (1650, 0))

    def test_paypal_order_first_minimum_is_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO paypal_topup_orders (id,user_id,amount_cents) VALUES ('pp-1','user-a',1999)"
            )
        self.db.execute(
            "INSERT INTO paypal_topup_orders (id,user_id,amount_cents) VALUES ('pp-2','user-a',2000)"
        )
        self.deposit("user-a", 2000)
        self.db.execute(
            "INSERT INTO paypal_topup_orders (id,user_id,amount_cents) VALUES ('pp-3','user-a',1)"
        )
        self.assertEqual(self.balance("user-a"), (2000, 0))

    def test_paypal_verified_capture_is_idempotent_and_isolated(self):
        self.db.execute(
            "INSERT INTO paypal_topup_orders (id,user_id,paypal_order_id,amount_cents,status) "
            "VALUES ('intent-a','user-a','ORDER-123',2000,'created')"
        )
        self.db.execute(
            "INSERT INTO verified_deposits "
            "(id,user_id,payment_provider,payment_reference,amount_cents,charged_currency,charged_amount_minor) "
            "VALUES ('paypal:CAP1','user-a','paypal','CAP1',2000,'USD',2000)"
        )
        self.db.execute(
            "INSERT OR IGNORE INTO verified_deposits "
            "(id,user_id,payment_provider,payment_reference,amount_cents,charged_currency,charged_amount_minor) "
            "VALUES ('paypal:CAP1','user-a','paypal','CAP1',2000,'USD',2000)"
        )
        self.assertEqual(self.balance("user-a"), (2000, 0))
        self.assertEqual(self.balance("user-b"), (0, 0))
        rows = self.db.execute(
            "SELECT COUNT(*) FROM verified_deposits WHERE payment_provider='paypal' "
            "AND payment_reference='CAP1'"
        ).fetchone()[0]
        self.assertEqual(rows, 1)


if __name__ == "__main__":
    unittest.main()
