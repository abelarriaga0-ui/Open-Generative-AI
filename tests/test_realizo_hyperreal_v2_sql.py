import pathlib,sqlite3,unittest,uuid,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
MIGRATION=(ROOT/'migrations/0033_realizo_hyperreal_pro_production.sql').read_text()
GATE=(ROOT/'migrations/0034_realizo_hyperreal_pro_release_gate.sql').read_text()
CORE="""
PRAGMA foreign_keys=ON;
CREATE TABLE wallet_users(id TEXT PRIMARY KEY);
CREATE TABLE wallets(user_id TEXT PRIMARY KEY REFERENCES wallet_users(id),
 available_cents INTEGER CHECK(available_cents>=0),
 reserved_cents INTEGER CHECK(reserved_cents>=0),updated_at TEXT);
CREATE TABLE wallet_ledger(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT CHECK(kind IN
 ('deposit','reserve','capture','release')),available_delta_cents INTEGER,
 reserved_delta_cents INTEGER,external_reference TEXT UNIQUE);
INSERT INTO wallet_users VALUES('owner');INSERT INTO wallet_users VALUES('other');
INSERT INTO wallets(user_id,available_cents,reserved_cents) VALUES('owner',2000,0);
INSERT INTO wallets(user_id,available_cents,reserved_cents) VALUES('other',500,0);
"""
class HyperrealProductionSQLTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.executescript(CORE+MIGRATION+GATE)
 def tearDown(self):self.db.close()
 def create(self,price=1000,expiry=600,user='owner'):
  jid=str(uuid.uuid4())
  self.db.execute("""
   INSERT INTO realizo_hyperreal_pro_jobs(
    id,user_id,request_key,fingerprint,product_asset_url,
    customer_brief_json,plan_json,quote_breakdown_json,price_cents,quote_expires_at)
   VALUES (?,?,?,?,'https://realizo.example/photo','{}','[]','{}',?,unixepoch()+?)
   """,(jid,user,str(uuid.uuid4()),'fingerprint',price,expiry))
  return jid
 def balance(self,user='owner'):
  return self.db.execute('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?',(user,)).fetchone()
 def reserve(self,jid):
  self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='reserved' WHERE id=?",(jid,))
 def test_full_package_is_reserved_once_and_captured_only_after_video_bytes(self):
  job=self.create()
  self.assertEqual(self.balance(),(2000,0))
  self.reserve(job)
  self.assertEqual(self.balance(),(1000,1000))
  self.reserve(job)
  self.assertEqual(self.balance(),(1000,1000))
  self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='processing' WHERE id=?",(job,))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='completed' WHERE id=?",(job,))
  self.db.execute("INSERT INTO realizo_hyperreal_pro_video_chunks(job_id,chunk_index,data) VALUES(?,?,?)",(job,0,b'x'*12000))
  self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='completed',result_bytes=12000,result_sha256=? WHERE id=?",('a'*64,job))
  self.assertEqual(self.balance(),(1000,0))
  self.assertEqual(self.balance('other'),(500,0))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM wallet_ledger WHERE user_id="owner"').fetchone()[0],2)
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='failed' WHERE id=?",(job,))
 def test_failure_fully_refunds_and_does_not_affect_other_wallets(self):
  job=self.create(price=750)
  self.reserve(job)
  self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='processing' WHERE id=?",(job,))
  self.db.execute("UPDATE realizo_hyperreal_pro_jobs SET status='failed' WHERE id=?",(job,))
  self.assertEqual(self.balance(),(2000,0))
  self.assertEqual(self.balance('other'),(500,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM wallet_ledger WHERE kind='release'").fetchone()[0],1)
 def test_expiry_and_insufficient_funds_prevent_billing(self):
  expired=self.create(expiry=-10)
  with self.assertRaises(sqlite3.IntegrityError):self.reserve(expired)
  self.assertEqual(self.balance(),(2000,0))
  expensive=self.create(price=2500)
  with self.assertRaises(sqlite3.IntegrityError):self.reserve(expensive)
  self.assertEqual(self.balance(),(2000,0))
 def test_guard_stays_off_until_independent_runner_verification(self):
  self.assertEqual(self.db.execute('SELECT enabled FROM realizo_hyperreal_pro_release_gate WHERE slot=1').fetchone()[0],0)
 def test_three_active_jobs_limit(self):
  for _ in range(2):self.reserve(self.create(price=100))
  self.reserve(self.create(price=100))
  with self.assertRaises(sqlite3.IntegrityError):self.reserve(self.create(price=100))
 def test_no_existing_video_or_paypal_tables_are_modified(self):
  self.assertNotIn('UPDATE generation_jobs',MIGRATION)
  self.assertNotIn('verified_deposits',MIGRATION)
  self.assertNotIn('paypal',MIGRATION.lower())
if __name__=='__main__':unittest.main()
