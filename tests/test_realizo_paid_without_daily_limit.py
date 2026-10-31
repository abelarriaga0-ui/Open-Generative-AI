import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1] / 'migrations'
BASE=[
    '0001_wallet.sql','0004_realizo_media.sql','0009_prepaid_muapi_import.sql',
    '0012_realizo_ai_premium.sql','0013_realizo_ai_premium_pricing.sql',
    '0015_muapi_provider_balance_reconcile_3027.sql',
    '0016_realizo_premium_owner_workflow_quota.sql',
    '0017_realizo_premium_paid_languages.sql',
    '0018_realizo_premium_video_choice_cost_audit.sql',
    '0019_realizo_premium_creative_style.sql',
]
class PaidResearchNoArtificialDailyCap(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in BASE:
            self.db.executescript((ROOT/name).read_text())
        for user in ('owner','customer'):
            self.db.execute('INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES (?,\'realizo\',?)',(user,user))
            self.db.execute('INSERT INTO wallets(user_id,available_cents) VALUES (?,?)',(user,10000))
            self.db.execute(
              'INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
              ('img-'+user,user,user+'/img','image/jpeg',1000,1,9999999999))
        self.db.commit()
    def tearDown(self):self.db.close()
    def project(self,n,user='owner',kind='paid'):
        p='p-'+user+'-'+str(n)
        self.db.execute(
          'INSERT INTO realizo_ai_projects(id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents) VALUES(?,?,?,?,?,?,?,?)',
          (p,user,'img-'+user,'Product commercial research','EC','key-'+str(n),kind,49 if kind=='paid' else 0))
        return p
    def apply(self):
        self.db.executescript((ROOT/'0020_realizo_paid_research_without_daily_cap.sql').read_text())
    def test_existing_customer_cap_is_removed_after_migration(self):
        for i in range(3):self.project(i,user='customer')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_premium_daily_limit'):
            self.project(3,user='customer')
        self.apply()
        for i in range(3,17):self.project(i,user='customer')
        for i in range(17):self.project(i,user='owner')
        self.assertEqual(self.db.execute("SELECT count(*) FROM realizo_ai_projects WHERE user_id='customer' AND billing_type='paid'").fetchone()[0],17)
        self.assertEqual(self.db.execute("SELECT count(*) FROM realizo_ai_projects WHERE user_id='owner' AND billing_type='paid'").fetchone()[0],17)
    def test_paid_customer_can_reserve_and_capture_without_limit_but_requires_balance(self):
        self.apply()
        self.db.execute("UPDATE wallets SET available_cents=98 WHERE user_id='customer'")
        for i in range(2):
            p=self.project(i,'customer')
            self.db.execute('INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES (?,?,?,49)',('o-'+p,p,'customer'))
        p=self.project(3,'customer')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_insufficient_general_funds'):
            self.db.execute('INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES (?,?,?,49)',('o-'+p,p,'customer'))
        self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='customer'").fetchone(),(0,98))
        self.db.execute("UPDATE realizo_ai_premium_orders SET status='captured' WHERE user_id='customer'")
        self.assertEqual(self.db.execute("SELECT reserved_cents FROM wallets WHERE user_id='customer'").fetchone()[0],0)
    def test_legacy_sponsored_grants_still_limited_and_account_scoped(self):
        self.apply()
        for i in range(5):self.project(100+i,kind='sponsored')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_premium_daily_limit'):
            self.project(200,kind='sponsored')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_premium_daily_limit'):
            self.project(300,user='customer',kind='sponsored')
    def test_distinct_paid_projects_and_idempotency_still_enforced(self):
        self.apply()
        self.project(1)
        with self.assertRaises(sqlite3.IntegrityError):self.project(1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM realizo_ai_projects WHERE user_id='owner'").fetchone()[0],1)

if __name__=='__main__':unittest.main()
