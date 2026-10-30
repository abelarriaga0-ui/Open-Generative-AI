"""Audit the one-time cancellation of unfunded USD 0.35 in Realizo Sandbox."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = [
    "0001_wallet.sql",
    "0008_muapi_pilot_grant.sql",
    "0009_prepaid_muapi_import.sql",
    "0010_cancel_unfunded_pilot_bonus.sql",
]

class PilotBonusReversalTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for name in SCHEMAS:
            self.db.executescript((ROOT / "migrations" / name).read_text(encoding="utf-8"))
        for user in ("owner", "other"):
            self.db.execute(
                "INSERT INTO wallet_users (id,auth_provider,auth_subject) VALUES (?,?,?)",
                (user, "realizo", user),
            )
            self.db.execute("INSERT INTO wallets (user_id) VALUES (?)", (user,))
        self.db.execute(
            "INSERT INTO realizo_muapi_pilot_grants(slot,user_id,amount_cents) "
            "VALUES(1,'owner',35)"
        )
        self.db.execute(
            "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
            "VALUES(1,'owner',775)"
        )

    def tearDown(self):
        self.db.close()

    def balance(self, user):
        return self.db.execute(
            "SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?",
            (user,),
        ).fetchone()

    def reverse(self, user="owner"):
        self.db.execute(
            "INSERT INTO realizo_pilot_grant_reversals(slot,user_id,amount_cents) "
            "VALUES(1,?,35)", (user,)
        )

    def test_real_funds_remain_and_bonus_reversed_exactly_once(self):
        self.assertEqual(self.balance("owner"), (810, 0))
        self.reverse()
        self.assertEqual(self.balance("owner"), (775, 0))
        self.assertEqual(self.balance("other"), (0, 0))
        self.assertEqual(self.db.execute(
            "SELECT amount_cents FROM realizo_prepaid_muapi_imports WHERE slot=1"
        ).fetchone()[0], 775)
        self.assertEqual(self.db.execute(
            "SELECT amount_cents FROM realizo_muapi_pilot_grants WHERE slot=1"
        ).fetchone()[0], 35)
        with self.assertRaises(sqlite3.IntegrityError):
            self.reverse()
        self.assertEqual(self.balance("owner"), (775, 0))

    def test_wrong_account_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.reverse("other")
        self.assertEqual(self.balance("owner"), (810, 0))
        self.assertEqual(self.balance("other"), (0, 0))

    def test_reservations_prevent_automatic_reversal(self):
        self.db.execute(
            "UPDATE wallets SET available_cents=775,reserved_cents=35 WHERE user_id='owner'"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.reverse()
        self.assertEqual(self.balance("owner"), (775, 35))

    def test_changed_balance_prevents_automatic_reversal(self):
        self.db.execute(
            "UPDATE wallets SET available_cents=700 WHERE user_id='owner'"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.reverse()
        self.assertEqual(self.balance("owner"), (700, 0))

    def test_no_paypal_deposit_or_provider_generation_created(self):
        self.reverse()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM verified_deposits").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM generation_jobs").fetchone()[0], 0)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM realizo_pilot_grant_reversals"
        ).fetchone()[0], 1)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM wallet_ledger WHERE external_reference='historical-muapi-prepaid:1'"
        ).fetchone()[0], 1)

if __name__ == "__main__":
    unittest.main()
