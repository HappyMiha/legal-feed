"""Local-only helpers. Verification links are read from the isolated test mail queue."""
import glob, json, os, re, sqlite3, urllib.request, urllib.error, uuid
BASE=os.environ.get('LEGAL_FEED_TEST_URL','http://localhost:5173')
assert BASE.startswith(('http://localhost:', 'http://127.0.0.1:')), 'Local test server required.'
PASSWORD='IntegrationPass123'
def db_path():
 return next(p for p in glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite') if sqlite3.connect(p).execute("SELECT name FROM sqlite_master WHERE name='auth_identities'").fetchone())
def request(path,method='GET',data=None,cookie='',origin=True,headers=None):
 h={'Content-Type':'application/json',**(headers or {})}
 if cookie:h['Cookie']=cookie
 if origin:h['Origin']=BASE
 req=urllib.request.Request(BASE+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
 try:r=urllib.request.urlopen(req,timeout=30)
 except urllib.error.HTTPError as error:r=error
 with r:return r.status,json.load(r),r.headers

def mail_token(email,kind='signup'):
 with sqlite3.connect(db_path()) as db:
  row=db.execute('SELECT m.payload FROM auth_mail m JOIN auth_tokens t ON t.token_hash=m.token_hash WHERE t.email=? AND t.kind=? ORDER BY m.rowid DESC LIMIT 1',(email,kind)).fetchone()
 assert row, 'No local verification email queued'
 return re.search(r'#token=([a-f0-9]+)',json.loads(row[0])['text']).group(1)
def signup(email=None):
 email=email or 'integration-'+uuid.uuid4().hex+'@example.test'
 code,data,_=request('auth/register','POST',{'name':'Integration Test','email':email,'password':PASSWORD})
 assert code==202,(code,data)
 token=mail_token(email)
 code,data,h=request('auth/verify','POST',{'token':token})
 assert code==200,(code,data)
 cookie=h['Set-Cookie'].split(';')[0]
 owner=request('state',cookie=cookie)[1]['account_id']
 return email,cookie,owner

def clean(owners):
 with sqlite3.connect(db_path()) as db:
  db.execute('PRAGMA foreign_keys=ON')
  for owner in owners:db.execute('DELETE FROM accounts WHERE id=?',(owner,))
  db.execute("DELETE FROM auth_tokens WHERE email LIKE 'integration-%@example.test'")
  db.execute("DELETE FROM rate_limits WHERE id LIKE 'auth-%'")
