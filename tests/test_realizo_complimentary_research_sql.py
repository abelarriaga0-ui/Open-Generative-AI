import sqlite3
import unittest
from pathlib import Path

MIGRATIONS=Path(__file__).resolve().parents[1]/'migrations'

class ComplimentaryResearchSQL(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for f in [
   '0001_wallet.sql','0004_realizo_media.sql',
   '0009_prepaid_muapi_import.sql','0012_realizo_ai_premium.sql',
   '0013_realizo_ai_premium_pricing.sql',
   '0015_muapi_provider_balance_reconcile_3027.sql',
   '0016_realizo_premium_owner_workflow_quota.sql',
   '0017_realizo_premium_paid_languages.sql',
   '0020_realizo_paid_research_without_daily_cap.sql',
   '0021_realizo_sandbox_owner_shared_ai_balance.sql',
   '0029_realizo_complimentary_research_public.sql'
  ]:
   self.db.executescript((MIGRATIONS/f).read_text())
  for n in range(12):
   user=f'account-{n}'
   self.db.execute('INSERT INTO wallet_users (id,auth_provider,auth_subject) VALUES (?,?,?)',(user,'realizo',user))
   self.db.execute('INSERT INTO wallets (user_id) VALUES (?)',(user,))
   self.db.execute('INSERT INTO realizo_media_assets (id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
                   ('image-'+user,user,user+'/a.jpg','image/jpeg',1000,1,9999999999))
 def tearDown(self): self.db.close()
 def create(self,user,idx,billing='sponsored'):
  self.db.execute('INSERT INTO realizo_ai_projects (id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents) VALUES (?,?,?,?,?,?,?,?)',
    (f'{user}-{idx}',user,'image-'+user,'Authentic product video research','EC',f'unique-{idx}',billing,0 if billing=='sponsored' else 49))
 def test_five_free_research_per_customer_per_day_without_wallet_entries(self):
  for i in range(5):self.create('account-0',i)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_premium_daily_limit'):self.create('account-0',5)
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='account-0'").fetchone(),(0,0))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM wallet_ledger').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM realizo_ai_premium_orders').fetchone()[0],0)
 def test_public_global_ceiling_is_40_not_old_five(self):
  for u in range(10):
   for n in range(4):self.create(f'account-{u}',n)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM realizo_ai_projects WHERE billing_type='sponsored'").fetchone()[0],40)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_premium_daily_limit'):self.create('account-10',0)
 def test_paid_research_not_locked_by_free_quota(self):
  for i in range(5):self.create('account-0',i)
  self.create('account-0',10,'paid')
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM realizo_ai_projects WHERE billing_type='paid'").fetchone()[0],1)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM wallet_ledger').fetchone()[0],0)
 def test_owner_reconciliation_uses_wallet_user_id_not_775_legacy(self):
  text=(MIGRATIONS/'0029_realizo_complimentary_research_public.sql').read_text()
  self.assertIn('r.user_id=w.user_id',text)
  self.assertNotIn('amount_cents=775',text)
  self.assertIn("NEW.billing_type='sponsored'",text)
  self.assertIn("'ai_insufficient_general_funds'",text)

if __name__=='__main__': unittest.main()
