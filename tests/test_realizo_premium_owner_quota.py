import unittest,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class PremiumCreationQuotaTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in ['0001_wallet.sql','0004_realizo_media.sql','0009_prepaid_muapi_import.sql',
               '0012_realizo_ai_premium.sql','0013_realizo_ai_premium_pricing.sql',
               '0016_realizo_premium_owner_workflow_quota.sql']:
   self.db.executescript((ROOT/name).read_text())
  for owner in ['owner','another']:
   self.db.execute('INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES (?,\'realizo\',?)',(owner,owner))
   self.db.execute('INSERT INTO wallets(user_id) VALUES (?)',(owner,))
   self.db.execute('INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
     ('img-'+owner,owner,owner+'/img','image/jpeg',1000,1,9999999999))
 def tearDown(self):self.db.close()
 def create(self,owner,num):
  self.db.execute('INSERT INTO realizo_ai_projects(id,user_id,primary_asset_id,description,market_code,request_key,billing_type) VALUES(?,?,?,?,?,?,?)',
   (owner+'-'+str(num),owner,'img-'+owner,'Product commercial research','EC','key-'+str(num),'sponsored'))
 def test_five_sponsored_products_then_quota(self):
  for i in range(5):self.create('owner',i)
  with self.assertRaises(sqlite3.IntegrityError):self.create('owner',5)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM realizo_ai_projects WHERE user_id='owner'").fetchone()[0],5)
  # Global guard prevents other beta accounts from extending the grant.
  with self.assertRaises(sqlite3.IntegrityError):self.create('another',5)
 def test_no_extra_wallet_charges(self):
  for i in range(3):self.create('owner',i)
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='owner'").fetchone(),(0,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM wallet_ledger").fetchone()[0],0)
if __name__=='__main__':unittest.main()
