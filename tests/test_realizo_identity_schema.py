from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1]
class RealizoIdentitySchema(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in ['0001_wallet.sql','0002_paypal.sql','0003_realizo_identity.sql']:
            self.db.executescript((ROOT/'migrations'/name).read_text())
    def tearDown(self):self.db.close()
    def test_accounts_link_independent_wallets(self):
        self.db.executemany('INSERT INTO realizo_accounts (id,email) VALUES (?,?)',
                            [('id-a','a@example.com'),('id-b','b@example.com')])
        self.db.executemany('INSERT INTO realizo_identities (provider,provider_subject,account_id) VALUES (?,?,?)',
                            [('email','a@example.com','id-a'),('google','102030','id-b')])
        self.db.executemany("INSERT INTO wallet_users (id,auth_provider,auth_subject) VALUES (?,'realizo',?)",
                            [('wallet-a','id-a'),('wallet-b','id-b')])
        self.db.executemany('INSERT INTO wallets (user_id) VALUES (?)',[('wallet-a',),('wallet-b',)])
        self.db.execute("INSERT INTO verified_deposits (id,user_id,payment_provider,payment_reference,amount_cents) VALUES ('dep-a','wallet-a','paypal','cap-a',2000)")
        a=self.db.execute("SELECT available_cents FROM wallets WHERE user_id='wallet-a'").fetchone()[0]
        b=self.db.execute("SELECT available_cents FROM wallets WHERE user_id='wallet-b'").fetchone()[0]
        self.assertEqual((a,b),(2000,0))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO realizo_accounts (id,email) VALUES ('id-c','A@EXAMPLE.COM')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO realizo_identities (provider,provider_subject,account_id) VALUES ('google','102030','id-a')")
    def test_otp_single_record_session_is_hashed_and_revocable(self):
        self.db.execute("INSERT INTO realizo_accounts (id,email) VALUES ('id-a','a@example.com')")
        self.db.execute("INSERT INTO realizo_sessions (token_hash,account_id,created_at,expires_at) VALUES ('hash','id-a',100,200)")
        self.db.execute("UPDATE realizo_sessions SET revoked_at=150 WHERE token_hash='hash'")
        self.assertEqual(self.db.execute("SELECT revoked_at FROM realizo_sessions WHERE token_hash='hash'").fetchone()[0],150)
        self.db.execute("INSERT INTO realizo_email_challenges (email,code_hash,expires_at,sent_at,ip_hash) VALUES ('a@example.com','hash',200,100,'ip')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO realizo_email_challenges (email,code_hash,expires_at,sent_at,ip_hash) VALUES ('a@example.com','two',300,101,'ip')")
if __name__=='__main__':unittest.main()
