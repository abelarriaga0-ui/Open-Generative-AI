import pathlib,sqlite3,unittest,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
DDL=(ROOT/'migrations/0032_realizo_hyperreal_document_jobs.sql').read_text()
class HyperrealDocumentJobsTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.executescript('PRAGMA foreign_keys=ON; CREATE TABLE wallet_users(id TEXT PRIMARY KEY); INSERT INTO wallet_users VALUES("owner"); INSERT INTO wallet_users VALUES("other");')
  self.db.executescript(DDL)
 def tearDown(self): self.db.close()
 def put(self,user='owner'):
  self.db.execute('INSERT INTO realizo_hyperreal_document_jobs(id,user_id,request_key) VALUES(?,?,?)',
                  (str(uuid.uuid4()),user,str(uuid.uuid4())))
 def test_3_per_day_owner_quota_and_other_customer_not_affected(self):
  for _ in range(3): self.put()
  with self.assertRaises(sqlite3.IntegrityError): self.put()
  self.put('other')
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM realizo_hyperreal_document_jobs WHERE user_id="owner"').fetchone()[0],3)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM realizo_hyperreal_document_jobs WHERE user_id="other"').fetchone()[0],1)
 def test_no_wallet_or_payment_changes(self):
  self.assertNotIn('UPDATE wallets',DDL)
  self.assertNotIn('INSERT INTO wallet_ledger',DDL)
  self.assertNotIn('verified_deposits',DDL)
if __name__=='__main__':unittest.main()
