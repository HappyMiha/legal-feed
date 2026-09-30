"""Run against local dev server and local D1. Never seed production."""
import concurrent.futures, glob, json, os, sqlite3, unittest, urllib.request, urllib.error, uuid
from auth_support import BASE, request, signup, clean, db_path
COOKIE=''
def call(path,method='GET',data=None,auth=True,origin=True):
 status,value,_=request(path,method,data,cookie=COOKIE if auth else '',origin=origin)
 return status,value

class ProductionAPI(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  global COOKIE
  _,COOKIE,cls.test_owner=signup()
  status,state=call('state');assert status==200,state
  cls.owner=state['account_id'];cls.ids=[]
  files=glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
  cls.db=next(p for p in files if sqlite3.connect(p).execute("SELECT name FROM sqlite_master WHERE name='profiles'").fetchone())
 def profile(self):
  p={'id':str(uuid.uuid4()),'name':'Integration test','status':'paused','topics':[{'id':'test-topic','title':'Test legal topic','description':'API test only','origin':'user','selected':True}], 'sources':[{'id':'fedlex','name':'Fedlex','section':'government_federal','type':'law','active':True}],'delivery':{'frequency':'both','channels':['email'],'relevance_threshold':'high','digest_day':'monday','digest_time':'07:00'},'created_at':'','updated_at':''}
  status,value=call('profiles','POST',p);self.assertEqual(status,201,value);self.ids.append(p['id']);return value
 @classmethod
 def tearDownClass(cls):
  with sqlite3.connect(cls.db) as db:
   db.execute('PRAGMA foreign_keys=ON')
   for id in cls.ids:db.execute('DELETE FROM profiles WHERE id=?',(id,))
   db.execute("DELETE FROM accounts WHERE id='integration-other'")
  clean([cls.test_owner])
 def test_01_authentication_and_csrf(self):
  self.assertEqual(call('state',auth=False)[0],401)
  self.assertEqual(call('topics','POST',{'input':'test'},origin=False)[0],403)
  self.assertEqual(call('jobs/monitor','POST',{})[0],401)
 def test_02_validation(self):
  self.assertEqual(call('profiles','POST',{})[0],400)
  p=self.profile();p['sources']=[{'id':'signal','name':'Private','section':'signal','type':'rss','active':True,'url':'https://127.0.0.1/internal'}]
  self.assertEqual(call('profiles/'+p['id'],'PUT',p)[0],400)
 def test_03_isolation(self):
  p=self.profile();foreign_id=str(uuid.uuid4())
  with sqlite3.connect(self.db) as db:
   db.execute('PRAGMA foreign_keys=ON')
   db.execute("INSERT OR IGNORE INTO accounts(id,data,created_at) VALUES('integration-other','{}','2026-01-01')")
   p['id']=foreign_id;db.execute("INSERT INTO profiles(id,owner_id,data,status) VALUES(?,'integration-other',?,'paused')",(foreign_id,json.dumps(p)))
  self.assertEqual(call('profiles/'+foreign_id,'DELETE',{'confirmation':p['name']})[0],404)
  self.assertEqual(call('profiles/'+foreign_id,'PUT',p)[0],404)
  self.assertNotIn(foreign_id,[x['id'] for x in call('state')[1]['profiles']])
 def test_04_updates_are_atomic_and_exported(self):
  p=self.profile();id=str(uuid.uuid4());u={'id':id,'profile_id':p['id'],'headline':'Integration fixture','read':False,'saved':False,'note':'','hidden':False,'topic_ids':[],'published_at':'2026-01-01'}
  with sqlite3.connect(self.db) as db:db.execute('INSERT INTO updates(id,owner_id,profile_id,canonical_url,data,source_text,discovered_at) VALUES(?,?,?,?,?,?,?)',(id,self.owner,p['id'],'https://example.com/test/'+id,json.dumps(u),'Integration fixture, never production.','2026-01-01'))
  with concurrent.futures.ThreadPoolExecutor() as pool:
   results=list(pool.map(lambda patch:call('updates/'+id,'PATCH',patch),[{'read':True},{'saved':True},{'note':'Persistent private note'}]))
  self.assertTrue(all(s==200 for s,_ in results),results)
  data=call('updates/'+id)[1];self.assertTrue(data['read']);self.assertTrue(data['saved']);self.assertEqual(data['note'],'Persistent private note')
  self.assertEqual(call('updates/'+id,'PATCH',{'owner_id':'other'})[0],400)
  call('updates/'+id,'PATCH',{'feedback':'not_relevant'});self.assertTrue(call('updates/'+id)[1]['hidden'])
  call('updates/'+id,'PATCH',{'feedback':'relevant'});self.assertFalse(call('updates/'+id)[1]['hidden'])
  self.assertIn(id,[u['id'] for u in call('account/export')[1]['updates']])
  self.assertEqual(call('profiles/'+p['id'],'DELETE',{'confirmation':p['name']})[0],200)
  self.assertEqual(call('updates/'+id)[0],404)
 def test_05_duplicate_and_confirmation(self):
  p=self.profile();status,copy=call('profiles/'+p['id']+'/duplicate','POST',{});self.assertEqual(status,201);self.ids.append(copy['id']);self.assertNotEqual(copy['id'],p['id'])
  self.assertEqual(call('profiles/'+p['id'],'DELETE',{'confirmation':'wrong'})[0],400)
 def test_06_settings_password(self):
  account=call('state')[1]['account'];account['firm']='Integration test firm';self.assertEqual(call('account','PUT',account)[0],200)
  self.assertEqual(call('state')[1]['account']['firm'],'Integration test firm')
  global COOKIE
  result,password_data,response_headers=request('account/password','POST',{'currentPassword':'IntegrationPass123','newPassword':'IntegrationPass123'},cookie=COOKIE)
  self.assertEqual(result,200,password_data)
  COOKIE=response_headers['Set-Cookie'].split(';')[0]
  self.assertTrue(call('state')[1]['account']['has_password'])
  self.assertNotIn('password_hash',call('account/export')[1]['account'])
  self.assertEqual(call('account','DELETE',{'password':'wrong','confirmation':'DELETE'})[0],400)

if __name__=='__main__':unittest.main(verbosity=2)
