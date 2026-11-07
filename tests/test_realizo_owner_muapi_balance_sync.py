import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0031_realizo_owner_muapi_balance_sync_20261107.sql"
OWNER = "owner-test"
OTHER = "other-test"

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE realizo_accounts(id TEXT PRIMARY KEY);
CREATE TABLE wallet_users(id TEXT PRIMARY KEY,auth_provider TEXT NOT NULL,auth_subject TEXT NOT NULL);
CREATE TABLE wallets(user_id TEXT PRIMARY KEY REFERENCES wallet_users(id),available_cents INTEGER NOT NULL,reserved_cents INTEGER NOT NULL,updated_at TEXT);
CREATE TABLE realizo_prepaid_muapi_imports(slot INTEGER PRIMARY KEY,user_id TEXT,amount_cents INTEGER);
CREATE TABLE realizo_muapi_provider_balance_reconciliations(slot INTEGER PRIMARY KEY,user_id TEXT,credited_cents INTEGER);
CREATE TABLE generation_jobs(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE realizo_ai_premium_orders(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE verified_deposits(id TEXT PRIMARY KEY,user_id TEXT,provider_environment TEXT);
CREATE TABLE wallet_ledger(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,available_delta_cents INTEGER,reserved_delta_cents INTEGER,external_reference TEXT UNIQUE);
"""

INSERT = """
INSERT INTO realizo_owner_muapi_balance_sync_20261107
(slot,user_id,before_cents,after_cents,allocated_cents,provider_verified_mills)
VALUES(1,?,34,3089,3055,30892)
"""


class MuapiOwnerSyncTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(SCHEMA)
        self.db.executescript(MIGRATION.read_text())
        self.db.execute("INSERT INTO realizo_accounts VALUES('account-1')")
        self.db.execute("INSERT INTO wallet_users VALUES(?, 'realizo', 'account-1')", (OWNER,))
        self.db.execute("INSERT INTO wallet_users VALUES(?, 'realizo', 'account-2')", (OTHER,))
        self.db.execute("INSERT INTO wallets(user_id,available_cents,reserved_cents) VALUES(?,34,0)", (OWNER,))
        self.db.execute("INSERT INTO wallets(user_id,available_cents,reserved_cents) VALUES(?,0,0)", (OTHER,))
        self.db.execute("INSERT INTO realizo_prepaid_muapi_imports VALUES(1,?,775)", (OWNER,))
        self.db.execute("INSERT INTO realizo_muapi_provider_balance_reconciliations VALUES(1,?,3000)", (OWNER,))
        self.db.execute("INSERT INTO verified_deposits VALUES('live-owner',?,'live')", (OWNER,))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_one_time_owner_credit_is_ledger_backed(self):
        self.db.execute(INSERT, (OWNER,))
        balance = self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?", (OWNER,)).fetchone()
        self.assertEqual(balance, (3089, 0))
        self.assertEqual(self.db.execute("SELECT available_cents FROM wallets WHERE user_id=?", (OTHER,)).fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT available_delta_cents FROM wallet_ledger").fetchone()[0], 3055)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM wallet_ledger").fetchone()[0], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))

    def test_other_customer_liability_blocks(self):
        self.db.execute("UPDATE wallets SET available_cents=5 WHERE user_id=?", (OTHER,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))
        self.assertEqual(self.db.execute("SELECT available_cents FROM wallets WHERE user_id=?", (OWNER,)).fetchone()[0], 34)

    def test_pending_video_or_research_blocks(self):
        self.db.execute("INSERT INTO generation_jobs VALUES('job-1','submitted')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))
        self.db.execute("DELETE FROM generation_jobs")
        self.db.execute("INSERT INTO realizo_ai_premium_orders VALUES('order-1','reserved')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))

    def test_changed_balance_blocks(self):
        self.db.execute("UPDATE wallets SET available_cents=35 WHERE user_id=?", (OWNER,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))

    def test_other_users_live_paypal_blocks(self):
        self.db.execute("INSERT INTO verified_deposits VALUES('live-other',?,'live')", (OTHER,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT, (OWNER,))


if __name__ == '__main__':
    unittest.main()
