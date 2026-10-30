import unittest,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class AIPremiumSchema(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in ['0001_wallet.sql','0003_realizo_identity.sql','0004_realizo_media.sql','0012_realizo_ai_premium.sql']:
   self.db.executescript((ROOT/'migrations'/name).read_text())
  for user in ['owner','other']:
   self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES(?,?,?)",(user,'realizo',user))
  self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES ('asset','owner','owner/asset','image/jpeg',1024,1,9999999999)")
 def tearDown(self):self.db.close()
 def create(self,user='owner',key='request'):
  self.db.execute("""INSERT INTO realizo_ai_projects
   (id,user_id,primary_asset_id,description,market_code,request_key)
   VALUES (?,?,?,?,?,?)""",(user+'-'+key,user,'asset','Gel de ducha masculino','EC',key))
 def test_project_create_and_idempotence(self):
  self.create()
  with self.assertRaises(sqlite3.IntegrityError):self.create(key='request')
  with self.assertRaises(sqlite3.IntegrityError):self.create(key='another') if False else self.db.execute(
    "INSERT INTO realizo_ai_projects(id,user_id,primary_asset_id,description,market_code,request_key) VALUES (?,?,?,?,?,?)",
    ('other-project','other','missing','Example description','CO','other-key'))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM realizo_ai_projects").fetchone()[0],1)
 def test_exact_three_concept_selection(self):
  self.create()
  self.db.execute("UPDATE realizo_ai_projects SET status='ready',concepts_json='[]',selected_concept=2 WHERE id='owner-request'")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_ai_projects SET selected_concept=3 WHERE id='owner-request'")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_ai_projects SET status='paid' WHERE id='owner-request'")
 def test_no_user_credit_charged_for_beta_research(self):
  self.db.execute("INSERT INTO wallets(user_id,available_cents) VALUES ('owner',775)")
  self.create()
  self.db.execute("INSERT INTO realizo_ai_usage(project_id,user_id,model,input_tokens,output_tokens,web_calls) VALUES (?,?,?,?,?,?)",('owner-request','owner','fake',100,200,2))
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='owner'").fetchone(),(775,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM wallet_ledger").fetchone()[0],0)

if __name__=='__main__':unittest.main()
