import unittest,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
class VerifiedReconcile(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for f in ['0001_wallet.sql','0009_prepaid_muapi_import.sql','0015_muapi_provider_balance_reconcile_3027.sql']:
   self.db.executescript((ROOT/f).read_text())
  self.db.execute("INSERT INTO wallet_users(id,auth_provider,auth_subject) VALUES('owner','realizo','owner'),('other','realizo','other')")
  self.db.execute("INSERT INTO wallets(user_id) VALUES('owner'),('other')")
  self.db.execute("INSERT INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents) VALUES(1,'owner',775)")
  self.db.execute("UPDATE wallets SET available_cents=27 WHERE user_id='owner'")
 def tearDown(self):self.db.close()
 def reconcile(self,user='owner'):
  return self.db.execute('INSERT INTO realizo_muapi_provider_balance_reconciliations(slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents) VALUES (1,?,3000,3027,27)',(user,))
 def test_one_time_credit_with_verified_snapshot(self):
  self.reconcile()
  self.assertEqual(self.db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='owner'").fetchone(),(3027,0))
  self.assertEqual(self.db.execute("SELECT kind,available_delta_cents FROM wallet_ledger WHERE external_reference='muapi-provider-reconciled:30.27:1'").fetchone(),('deposit',3000))
  with self.assertRaises(sqlite3.IntegrityError):self.reconcile()
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM realizo_muapi_provider_balance_reconciliations").fetchone()[0],1)
 def test_other_wallet_or_identity_cannot_be_credited(self):
  with self.assertRaises(sqlite3.IntegrityError):self.reconcile('other')
  self.db.execute("UPDATE wallets SET available_cents=100 WHERE user_id='other'")
  with self.assertRaises(sqlite3.IntegrityError):self.reconcile()
 def test_stale_wallet_snapshot_blocks_reconciliation(self):
  self.db.execute("UPDATE wallets SET available_cents=26 WHERE user_id='owner'")
  with self.assertRaises(sqlite3.IntegrityError):self.reconcile()
 def test_pending_provider_job_blocks_credit(self):
  self.db.execute("INSERT INTO model_prices(model_id,muapi_endpoint,customer_price_cents) VALUES('x','x',1)")
  self.db.execute("INSERT INTO generation_jobs(id,user_id,model_id,idempotency_key,price_cents) VALUES('job','owner','x','key',1)")
  with self.assertRaises(sqlite3.IntegrityError):self.reconcile()
 def test_no_unbacked_amount_or_provider_snapshot_allowed(self):
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_muapi_provider_balance_reconciliations(slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents) VALUES(1,'owner',3027,3027,27)")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO realizo_muapi_provider_balance_reconciliations(slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents) VALUES(1,'owner',3000,3000,27)")
if __name__=='__main__':unittest.main()
