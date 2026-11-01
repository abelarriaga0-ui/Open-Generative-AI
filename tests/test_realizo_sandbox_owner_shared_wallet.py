import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'migrations'
BASE=[
 '0001_wallet.sql','0004_realizo_media.sql','0009_prepaid_muapi_import.sql',
 '0012_realizo_ai_premium.sql','0013_realizo_ai_premium_pricing.sql',
 '0015_muapi_provider_balance_reconcile_3027.sql',
 '0016_realizo_premium_owner_workflow_quota.sql',
 '0017_realizo_premium_paid_languages.sql',
 '0018_realizo_premium_video_choice_cost_audit.sql',
 '0019_realizo_premium_creative_style.sql',
 '0020_realizo_paid_research_without_daily_cap.sql',
]
MIGRATION='0021_realizo_sandbox_owner_shared_ai_balance.sql'

class SharedResearchBalance(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in BASE:self.db.executescript((ROOT/name).read_text())
  for uid in ('owner','customer','live'):
   self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES(?,'realizo',?)",(uid,uid))
   self.db.execute('INSERT INTO wallets(user_id) VALUES(?)',(uid,))
   self.db.execute('INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
     ('img-'+uid,uid,uid+'/image','image/jpeg',1000,1,9999999999))
  # Owner's *historically verified* funds: 775 Muapi legacy import,
  # then a provider-verified reconciliation of another 3000.
  self.db.execute("INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) VALUES (1,'owner',775)")
  self.db.execute("UPDATE wallets SET available_cents=27 WHERE user_id='owner'")
  self.db.execute("""INSERT INTO realizo_muapi_provider_balance_reconciliations
   (slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents)
   VALUES (1,'owner',3000,3027,27)""")
  self.db.commit()
 def tearDown(self):self.db.close()
 def add_project(self,user,n):
  project=f'{user}-{n}'
  self.db.execute('''INSERT INTO realizo_ai_projects
   (id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents)
   VALUES (?,?,?,?,? ,?,'paid',49)''',(project,user,'img-'+user,'Shampoo y perfume','EC',project))
  return project
 def reserve(self,user,n):
  project=self.add_project(user,n)
  self.db.execute('INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES (?,?,?,49)',
    ('order-'+project,project,user))
 def balance(self,user):
  return self.db.execute('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?',(user,)).fetchone()
 def migrate(self):
  self.db.executescript((ROOT/MIGRATION).read_text())

 def test_verified_owner_can_spend_available_shared_wallet_even_below_legacy_775_floor(self):
  # This reproduces the user's screenshot: UI shows 50 cents but AI
  # calculation subtracts the historic 775-cent Muapi reserve.
  self.db.execute("UPDATE wallets SET available_cents=50 WHERE user_id='owner'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_insufficient_general_funds'):
   self.reserve('owner',1)
  self.migrate()
  self.reserve('owner',2)
  self.assertEqual(self.balance('owner'),(1,49))
  self.db.execute("UPDATE realizo_ai_premium_orders SET status='captured' WHERE project_id='owner-2'")
  self.assertEqual(self.balance('owner'),(1,0))
  self.assertEqual(self.db.execute("SELECT count(*) FROM wallet_ledger WHERE external_reference LIKE 'ai-premium:%:capture'").fetchone()[0],1)

 def test_verified_owner_with_less_than_price_stays_blocked(self):
  self.migrate()
  self.db.execute("UPDATE wallets SET available_cents=48 WHERE user_id='owner'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_insufficient_general_funds'):
   self.reserve('owner',1)
  self.assertEqual(self.balance('owner'),(48,0))

 def test_unverified_legacy_import_remains_restricted(self):
  # The legacy import table has one global slot. Build an independent DB
  # where the imported account has NO verified reconciliation.
  other=sqlite3.connect(':memory:')
  try:
   other.execute('PRAGMA foreign_keys=ON')
   for name in BASE:other.executescript((ROOT/name).read_text())
   other.executescript((ROOT/MIGRATION).read_text())
   other.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES('customer','realizo','customer')")
   other.execute("INSERT INTO wallets(user_id) VALUES('customer')")
   other.execute("""INSERT INTO realizo_media_assets
       (id,user_id,object_key,content_type,byte_size,created_at,expires_at)
       VALUES ('img','customer','customer/img','image/jpeg',1000,1,9999999999)""")
   other.execute("INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) VALUES(1,'customer',775)")
   other.execute("UPDATE wallets SET available_cents=800 WHERE user_id='customer'")
   other.execute("""INSERT INTO realizo_ai_projects
       (id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents)
       VALUES('p1','customer','img','Shampoo','EC','k1','paid',49)""")
   with self.assertRaisesRegex(sqlite3.IntegrityError,'ai_insufficient_general_funds'):
    other.execute("""INSERT INTO realizo_ai_premium_orders
       (id,project_id,user_id,price_cents) VALUES('o1','p1','customer',49)""")
   self.assertEqual(other.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='customer'").fetchone(),(800,0))
  finally:other.close()

 def test_regular_paid_user_spends_verified_wallet_without_sandbox_owner_credit(self):
  self.migrate()
  self.db.execute("UPDATE wallets SET available_cents=50 WHERE user_id='live'")
  self.reserve('live',1)
  self.assertEqual(self.balance('live'),(1,49))

 def test_owner_release_refunds_once_and_never_creates_credits(self):
  self.migrate()
  self.db.execute("UPDATE wallets SET available_cents=50 WHERE user_id='owner'")
  self.reserve('owner',1)
  self.db.execute("UPDATE realizo_ai_premium_orders SET status='released' WHERE project_id='owner-1'")
  self.assertEqual(self.balance('owner'),(50,0))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_ai_premium_orders SET status='captured' WHERE project_id='owner-1'")
  self.assertEqual(self.balance('owner'),(50,0))

if __name__=='__main__':unittest.main()
