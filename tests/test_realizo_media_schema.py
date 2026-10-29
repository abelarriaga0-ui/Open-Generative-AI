import unittest, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class MediaSchema(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for n in ['0001_wallet.sql','0002_paypal.sql','0003_realizo_identity.sql','0004_realizo_media.sql','0005_realizo_media_blob.sql']:
   self.db.executescript((ROOT/'migrations'/n).read_text())
  self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES('u1','realizo','acct1')")
 def tearDown(self):self.db.close()
 def test_private_media_requires_owner_and_rejects_duplicate(self):
  self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES ('a','u1','d1:u1/a','image/jpeg',100,1,86401)")
  self.db.execute('INSERT INTO realizo_media_binary_sandbox(asset_id,body) VALUES (?,?)',('a',bytes([255])*100))
  q=self.db.execute("SELECT body FROM realizo_media_binary_sandbox WHERE asset_id='a'").fetchone()
  self.assertEqual(len(q[0]),100)
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_media_binary_sandbox(asset_id,body) VALUES ('b',x'00')")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES('b','u2','d1:u2/b','image/jpeg',100,1,86401)")
 def test_image_size_and_mime_rejected_at_database(self):
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES('a','u1','u1/a','application/javascript',100,1,86401)")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_media_assets(id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES('a','u1','u1/a','image/jpeg',12000000,1,86401)")
if __name__=='__main__':unittest.main()
