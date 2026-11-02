import unittest,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class PaidPremiumWalletTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for n in ['0001_wallet.sql','0004_realizo_media.sql',
            '0009_prepaid_muapi_import.sql',
            '0012_realizo_ai_premium.sql','0013_realizo_ai_premium_pricing.sql','0014_paypal_live_provenance.sql']:
   self.db.executescript((ROOT/'migrations'/n).read_text())
  for u in ['owner','customer','other']:
   self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES (?, 'realizo', ?)",(u,u))
   self.db.execute("INSERT INTO wallets(user_id) VALUES (?)",(u,))
   self.db.execute(
    "INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
    ('image-'+u,u,u+'/asset','image/jpeg',2048,1,9999999999))
  self.db.execute("INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) VALUES(1,'owner',775)")
 def tearDown(self):self.db.close()
 def wallet(self,u):
  return self.db.execute('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?',(u,)).fetchone()
 def create(self,u='customer',p='project',typ='paid',price=49):
  self.db.execute("""INSERT INTO realizo_ai_projects(
   id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents)
   VALUES(?,?,?,?,?,?,?,?)""",(p,u,'image-'+u,'Test product description','EC',p,typ,price))
 def reserve(self,p='project',u='customer'):
  self.db.execute("INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES (?,?,?,?)",
                  ('order-'+p,p,u,49))
 def test_owner_muapi_balance_cannot_pay_for_openai(self):
  self.create('owner','ownerproject')
  self.assertEqual(self.wallet('owner'),(775,0))
  with self.assertRaises(sqlite3.IntegrityError):self.reserve('ownerproject','owner')
  self.assertEqual(self.wallet('owner'),(775,0))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM wallet_ledger WHERE kind="reserve"').fetchone()[0],0)
 def test_live_funded_deposit_covers_premium_without_double_debit(self):
  self.db.execute("INSERT INTO verified_deposits (id,user_id,payment_provider,payment_reference,amount_cents) VALUES ('fund','customer','paypal','ref1',2000)")
  self.create()
  self.reserve()
  self.assertEqual(self.wallet('customer'),(1951,49))
  with self.assertRaises(sqlite3.IntegrityError):self.reserve()
  self.db.execute("UPDATE realizo_ai_premium_orders SET status='captured' WHERE id='order-project'")
  self.assertEqual(self.wallet('customer'),(1951,0))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_ai_premium_orders SET status='released' WHERE id='order-project'")
  self.assertEqual(self.db.execute("SELECT SUM(available_delta_cents),SUM(reserved_delta_cents) FROM wallet_ledger WHERE user_id='customer'").fetchone(),(1951,0))
 def test_refund_returns_all_funds_after_provider_rejection(self):
  self.db.execute("UPDATE wallets SET available_cents=100 WHERE user_id='customer'")
  self.create()
  self.reserve()
  self.assertEqual(self.wallet('customer'),(51,49))
  self.db.execute("UPDATE realizo_ai_premium_orders SET status='released' WHERE id='order-project'")
  self.assertEqual(self.wallet('customer'),(100,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM wallet_ledger WHERE external_reference='ai-premium:order-project:release'").fetchone()[0],1)
 def test_historical_credit_remains_locked_even_if_video_was_spent(self):
  self.db.execute("UPDATE wallets SET available_cents=700 WHERE user_id='owner'")
  self.create('owner','ownerproject')
  with self.assertRaises(sqlite3.IntegrityError):self.reserve('ownerproject','owner')
  self.db.execute("UPDATE wallets SET available_cents=850 WHERE user_id='owner'")
  self.reserve('ownerproject','owner')
  self.assertEqual(self.wallet('owner'),(801,49))
  self.assertGreaterEqual(self.wallet('owner')[0],775)
 def test_concurrent_daily_quota_per_user(self):
  for k in range(3):self.create('customer','project'+str(k))
  with self.assertRaises(sqlite3.IntegrityError):self.create('customer','project3')
  self.create('owner','sponsor','sponsored',0)
  with self.assertRaises(sqlite3.IntegrityError):self.create('owner','sponsor2','sponsored',0)
 def test_paypal_live_provenance_is_explicit(self):
  self.db.execute("INSERT INTO verified_deposits (id,user_id,payment_provider,payment_reference,amount_cents) VALUES ('sandbox','customer','paypal','fake',2000)")
  self.assertEqual(self.db.execute("SELECT provider_environment FROM verified_deposits WHERE id='sandbox'").fetchone()[0],'unknown')
  self.db.execute("INSERT INTO verified_deposits (id,user_id,payment_provider,payment_reference,amount_cents,provider_environment) VALUES ('real','other','paypal','real-ref',2000,'live')")
  self.assertEqual(self.db.execute("SELECT provider_environment FROM verified_deposits WHERE id='real'").fetchone()[0],'live')
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE verified_deposits SET provider_environment='unverified' WHERE id='real'")
 def test_nonowners_and_unfunded_wallets_cannot_reserve(self):
  self.create('customer','p2')
  with self.assertRaises(sqlite3.IntegrityError):self.reserve('p2','other')
  self.assertEqual(self.wallet('other'),(0,0))
  with self.assertRaises(sqlite3.IntegrityError):self.reserve('p2','customer')
  self.assertEqual(self.wallet('customer'),(0,0))
if __name__=='__main__':unittest.main()
