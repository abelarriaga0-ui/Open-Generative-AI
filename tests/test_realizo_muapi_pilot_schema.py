import sqlite3,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class PilotSchema(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for n in ['0001_wallet.sql','0002_paypal.sql','0003_realizo_identity.sql',
            '0004_realizo_media.sql','0005_realizo_media_blob.sql','0006_muapi_pilot.sql',
            '0007_muapi_pilot_catalog.sql']:
   self.db.executescript((ROOT/'migrations'/n).read_text())
 def tearDown(self):self.db.close()
 def test_price_is_disabled_by_default_and_fixed(self):
  row=self.db.execute("SELECT muapi_endpoint,customer_price_cents,enabled,fixed_options_json FROM model_prices WHERE model_id='wan2.2-image-to-video'").fetchone()
  self.assertEqual(row[0],'wan2.2-image-to-video')
  self.assertEqual(row[1],35)
  self.assertEqual(row[2],0)
  self.assertIn('"duration":5',row[3])
 def test_one_slot_can_never_be_claimed_by_two_jobs(self):
  self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES('owner','realizo','owner')")
  self.db.execute("INSERT INTO wallets(user_id,available_cents) VALUES('owner',2000)")
  self.db.execute("UPDATE model_prices SET enabled=1 WHERE model_id='wan2.2-image-to-video'")
  for id in ['jobA','jobB']:
   self.db.execute("INSERT INTO generation_jobs(id,user_id,model_id,idempotency_key,price_cents) VALUES (?,?,?,?,35)",
     (id,'owner','wan2.2-image-to-video',id))
  self.db.execute("INSERT INTO realizo_muapi_pilot_uses(slot,job_id,user_id) VALUES(1,'jobA','owner')")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_muapi_pilot_uses(slot,job_id,user_id) VALUES(1,'jobB','owner')")
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM realizo_muapi_pilot_uses').fetchone()[0],1)
if __name__=='__main__':unittest.main()
