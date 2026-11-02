"""Ensure the historical prepaid Muapi import is isolated, atomic, and not PayPal."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = (
    "0001_wallet.sql",
    "0002_paypal.sql",
    "0008_muapi_pilot_grant.sql",
    "0009_prepaid_muapi_import.sql",
)

class HistoricMuapiImportTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for filename in MIGRATIONS:
            self.db.executescript((ROOT / "migrations" / filename).read_text())
        self.db.execute(
            "INSERT INTO wallet_users(id,auth_provider,auth_subject) "
            "VALUES ('owner','realizo','owner-id')"
        )
        self.db.execute(
            "INSERT INTO wallet_users(id,auth_provider,auth_subject) "
            "VALUES ('other','realizo','other-id')"
        )
        self.db.execute(
            "INSERT INTO wallets(user_id) VALUES('owner')"
        )
        self.db.execute(
            "INSERT INTO wallets(user_id) VALUES('other')"
        )
        self.db.execute(
            "INSERT INTO realizo_muapi_pilot_grants(slot,user_id,amount_cents) "
            "VALUES(1,'owner',35)"
        )

    def tearDown(self):
        self.db.close()

    def balances(self):
        return dict(self.db.execute(
            "SELECT user_id,available_cents FROM wallets"
        ).fetchall())

    def test_import_is_unique_and_does_not_credit_other_user(self):
        self.db.execute(
            "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
            "VALUES(1,'owner',775)"
        )
        self.assertEqual(self.balances(), {"owner":810,"other":0})
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
                "VALUES(1,'other',775)"
            )
        self.assertEqual(self.balances(), {"owner":810,"other":0})
        row=self.db.execute(
            "SELECT kind,available_delta_cents FROM wallet_ledger "
            "WHERE external_reference='historical-muapi-prepaid:1'"
        ).fetchone()
        self.assertEqual(row, ("deposit",775))

    def test_invalid_owner_or_amount_rolls_back_without_credit(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
                "VALUES(1,'owner',774)"
            )
        self.assertEqual(self.balances(), {"owner":35,"other":0})
        self.db.execute(
            "INSERT INTO wallet_users(id,auth_provider,auth_subject) "
            "VALUES('access-account','cloudflare-access','access-id')"
        )
        self.db.execute("INSERT INTO wallets(user_id) VALUES('access-account')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
                "VALUES(1,'access-account',775)"
            )
        self.assertEqual(self.balances(), {"owner":35,"other":0,"access-account":0})

    def test_historical_credit_is_not_a_paypal_deposit(self):
        self.db.execute(
            "INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) "
            "VALUES(1,'owner',775)"
        )
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM verified_deposits").fetchone()[0],0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO verified_deposits(id,user_id,payment_provider,payment_reference,amount_cents) "
                "VALUES('small','owner','paypal','test-small',100)"
            )
        self.assertEqual(self.balances(), {"owner":810,"other":0})

if __name__=="__main__":
    unittest.main()
