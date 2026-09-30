import concurrent.futures, hashlib, json, re, sqlite3, unittest, urllib.request, uuid
from auth_support import BASE, PASSWORD, request, signup, mail_token, db_path, clean

class EmailAuthentication(unittest.TestCase):
 def setUp(self):self.owners=[]
 def tearDown(self):clean(self.owners)
 def account(self):
  email,cookie,owner=signup();self.owners.append(owner);return email,cookie,owner
 def test_01_public_registration_and_removed_chatgpt_auth(self):
  with urllib.request.urlopen(BASE+'/') as response:
   self.assertEqual(response.status,200);html=response.read().decode();self.assertIn('Create your account',html);self.assertNotIn('signin-with-chatgpt',html);self.assertIn('noindex',html)
  self.assertEqual(request('state',cookie='__sites_local_auth=1',headers={'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'test@example.test'})[0],401)
  self.assertEqual(request('auth/register','POST',{},origin=False)[0],403)
 def test_02_verification_and_replay(self):
  email='integration-'+uuid.uuid4().hex+'@example.test'
  self.assertEqual(request('auth/register','POST',{'name':'Test','email':email,'password':PASSWORD})[0],202)
  self.assertEqual(request('auth/login','POST',{'email':email,'password':PASSWORD})[0],401)
  token=mail_token(email)
  with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(lambda _:request('auth/verify','POST',{'token':token}),range(2)))
  self.assertEqual(sorted(r[0] for r in results),[200,400])
  cookie=next(h['Set-Cookie'].split(';')[0] for status,_,h in results if status==200)
  state=request('state',cookie=cookie)[1];self.owners.append(state['account_id'])
  self.assertEqual(state['account']['email'],email)
  with sqlite3.connect(db_path()) as db:
   row=db.execute('SELECT password_hash,password_salt FROM accounts WHERE id=?',(state['account_id'],)).fetchone()
   self.assertTrue(row[0].startswith('v2:'));self.assertNotIn(PASSWORD,row)
 def test_03_sessions_and_isolation(self):
  email,cookie,owner=self.account();_,other,other_owner=self.account()
  self.assertNotEqual(owner,other_owner)
  code,_,headers=request('auth/login','POST',{'email':email.upper(),'password':PASSWORD})
  self.assertEqual(code,200);self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertIn('SameSite=Lax',headers['Set-Cookie'])
  new_cookie=headers['Set-Cookie'].split(';')[0]
  self.assertEqual(request('state',cookie=cookie+'0')[0],401)
  self.assertEqual(request('auth/logout','POST',{},cookie=cookie)[0],200)
  self.assertEqual(request('state',cookie=cookie)[0],401)
  self.assertEqual(request('state',cookie=new_cookie)[0],200)
  with sqlite3.connect(db_path()) as db:db.execute('UPDATE auth_sessions SET expires_at=0 WHERE owner_id=?',(owner,))
  self.assertEqual(request('state',cookie=new_cookie)[0],401);self.assertEqual(request('state',cookie=other)[0],200)
 def test_04_reset_revokes_sessions_and_pending_email_changes(self):
  email,cookie,owner=self.account();account=request('state',cookie=cookie)[1]['account'];account.update(email='integration-'+uuid.uuid4().hex+'@example.test',currentPassword=PASSWORD)
  self.assertEqual(request('account','PUT',account,cookie=cookie)[0],200)
  with sqlite3.connect(db_path()) as db:change=re.search(r'#change=([^\s]+)',json.loads(db.execute('SELECT payload FROM email_verifications WHERE owner_id=?',(owner,)).fetchone()[0])['text']).group(1)
  self.assertEqual(request('auth/forgot-password','POST',{'email':email})[0],202)
  token=mail_token(email,'reset');new_password='ReplacementPass123'
  self.assertEqual(request('auth/reset-password','POST',{'token':token,'password':new_password})[0],200)
  self.assertEqual(request('auth/reset-password','POST',{'token':token,'password':new_password})[0],400)
  self.assertEqual(request('state',cookie=cookie)[0],401)
  self.assertEqual(request('auth/login','POST',{'email':email,'password':PASSWORD})[0],401)
  self.assertEqual(request('auth/login','POST',{'email':email,'password':new_password})[0],200)
  self.assertEqual(request('auth/verify-email-change','POST',{'token':change})[0],400)
 def test_05_legacy_account_is_preserved_only_after_verification(self):
  email='integration-'+uuid.uuid4().hex+'@example.test';owner='legacy-'+uuid.uuid4().hex;self.owners.append(owner)
  account={'name':'Existing User','email':email,'firm':'Preserve this firm','quiet_start':'22:00','quiet_end':'07:00','defaults':{'frequency':'both','channels':['email'],'relevance_threshold':'high'}}
  with sqlite3.connect(db_path()) as db:db.execute('INSERT INTO accounts(id,data,created_at) VALUES(?,?,?)',(owner,json.dumps(account),'2026-01-01'))
  verified_email,cookie,claimed=signup(email)
  self.assertEqual(claimed,owner);self.assertEqual(request('state',cookie=cookie)[1]['account']['firm'],'Preserve this firm')
 def test_06_email_change_is_single_use_and_keeps_settings_consistent(self):
  email,cookie,owner=self.account();old=request('state',cookie=cookie)[1]['account'];new_email='integration-'+uuid.uuid4().hex+'@example.test';new={**old,'email':new_email}
  self.assertEqual(request('account','PUT',new,cookie=cookie)[0],400)
  self.assertEqual(request('account','PUT',{**new,'currentPassword':PASSWORD},cookie=cookie)[0],200)
  with sqlite3.connect(db_path()) as db:token=re.search(r'#change=([^\s]+)',json.loads(db.execute('SELECT payload FROM email_verifications WHERE owner_id=?',(owner,)).fetchone()[0])['text']).group(1)
  with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(lambda _:request('auth/verify-email-change','POST',{'token':token}),range(2)))
  self.assertEqual(sorted(r[0] for r in results),[200,400])
  self.assertEqual(request('auth/login','POST',{'email':email,'password':PASSWORD})[0],401)
  self.assertEqual(request('auth/login','POST',{'email':new_email,'password':PASSWORD})[0],200)
  with sqlite3.connect(db_path()) as db:self.assertEqual(db.execute("SELECT json_extract(a.data,'$.email')=i.email FROM accounts a JOIN auth_identities i ON a.id=i.owner_id WHERE a.id=?",(owner,)).fetchone()[0],1)
 def test_07_two_reset_links_have_one_winner(self):
  email,_,owner=self.account();tokens=[]
  for _ in range(2):request('auth/forgot-password','POST',{'email':email});tokens.append(mail_token(email,'reset'))
  with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(lambda pair:request('auth/reset-password','POST',{'token':pair[1],'password':'ResetPassword'+str(pair[0])}),enumerate(tokens)))
  self.assertEqual(sorted(r[0] for r in results),[200,400])
 def test_08_account_deletion_revokes_every_session(self):
  email,cookie,owner=self.account();self.assertEqual(request('account','DELETE',{'password':PASSWORD,'confirmation':'DELETE'},cookie=cookie)[0],200)
  self.assertEqual(request('state',cookie=cookie)[0],401)
  self.assertEqual(request('auth/login','POST',{'email':email,'password':PASSWORD})[0],401)
  with sqlite3.connect(db_path()) as db:self.assertEqual(db.execute('SELECT count(*) FROM auth_sessions WHERE owner_id=?',(owner,)).fetchone()[0],0)

if __name__=='__main__':unittest.main(verbosity=2)
