import unittest,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class PaidLanguageResearch(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for f in ['0001_wallet.sql','0004_realizo_media.sql','0009_prepaid_muapi_import.sql',
            '0012_realizo_ai_premium.sql','0013_realizo_ai_premium_pricing.sql',
            '0015_muapi_provider_balance_reconcile_3027.sql','0016_realizo_premium_owner_workflow_quota.sql',
            '0017_realizo_premium_paid_languages.sql']:
   self.db.executescript((ROOT/f).read_text())
  self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES('owner','realizo','owner')")
  self.db.execute("INSERT INTO wallets(user_id) VALUES('owner')")
  self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES ('img','owner','owner/img','image/jpeg',1000,1,9999999999)")
  self.db.execute("INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) VALUES(1,'owner',775)")
  self.db.execute("UPDATE wallets SET available_cents=27 WHERE user_id='owner'")
  self.db.execute("INSERT INTO realizo_muapi_provider_balance_reconciliations(slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents) VALUES(1,'owner',3000,3027,27)")
 def tearDown(self):self.db.close()
 def project(self,i,language='es'):
  self.db.execute("INSERT INTO realizo_ai_projects(id,user_id,primary_asset_id,description,market_code,request_key,billing_type,premium_price_cents,video_language) VALUES(?,?,?,?,?,?,?,?,?)",
   ('p'+str(i),'owner','img','Perfume masculino Goda','EC','key'+str(i),'paid',49,language))
 def test_real_prepaid_balance_reserves_and_captures_paid_research(self):
  self.project(1,'en')
  self.db.execute("INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES('o1','p1','owner',49)")
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='owner'").fetchone(),(2978,49))
  self.db.execute("UPDATE realizo_ai_premium_orders SET status='captured' WHERE id='o1'")
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='owner'").fetchone(),(2978,0))
  self.assertEqual(self.db.execute("SELECT video_language FROM realizo_ai_projects WHERE id='p1'").fetchone()[0],'en')
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_ai_premium_orders SET status='released' WHERE id='o1'")
 def test_bad_language_rejected_before_charge(self):
  with self.assertRaises(sqlite3.IntegrityError):self.project(1,'test-invalid')
  self.assertEqual(self.db.execute("SELECT available_cents FROM wallets WHERE user_id='owner'").fetchone()[0],3027)
 def test_max_five_paid_researches_for_verified_owner(self):
  for i,lang in enumerate(['es','en','pt','fr','it']):self.project(i,lang)
  with self.assertRaises(sqlite3.IntegrityError):self.project(6,'de')
 def test_normal_old_drafts_stay_default_spanish_without_retrocharge(self):
  self.db.execute("INSERT INTO realizo_ai_projects(id,user_id,primary_asset_id,description,market_code,request_key) VALUES('old','owner','img','Old test project','EC','old')")
  self.assertEqual(self.db.execute("SELECT video_language,billing_type,premium_price_cents FROM realizo_ai_projects WHERE id='old'").fetchone(),('es','sponsored',0))
if __name__=='__main__':unittest.main()
