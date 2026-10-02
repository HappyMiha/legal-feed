"""Exercise feed quotas and private approval links against local D1 only."""
import concurrent.futures, json, re, sqlite3, unittest, uuid
from pathlib import Path
from auth_support import BASE, request, signup, clean, db_path

def profile():
 return {'id':str(uuid.uuid4()),'name':'Quota integration fixture','status':'paused','topics':[{'id':'test-topic','title':'Fixture','description':'Local test only','origin':'user','selected':True}],'sources':[{'id':'fedlex','name':'Fedlex','section':'government_federal','type':'law','active':True}],'delivery':{'frequency':'both','channels':['email'],'relevance_threshold':'high'},'created_at':'','updated_at':''}

class FeedLimits(unittest.TestCase):
 def setUp(self):
  self.email,self.cookie,self.owner=signup();self.db=db_path()
 def tearDown(self):clean([self.owner])
 def call(self,path,method='GET',data=None,**kwargs):return request(path,method,data,cookie=self.cookie,**kwargs)
 def quota(self):return self.call('state')[1]['feed_quota']
 def submit(self,amount=10):
  status,data,_=self.call('feed-limit-request','POST',{'requested_limit':amount,'reason':'Monitor additional client matters.'});self.assertEqual(status,201,data)
  with sqlite3.connect(self.db) as db:payload=db.execute('SELECT mail_payload FROM feed_limit_requests WHERE owner_id=? AND status=\'pending\'',(self.owner,)).fetchone()[0]
  message=json.loads(payload);self.assertEqual(message['to'],'info@helveticlens.ch')
  for action in ['approve','reject','custom']:self.assertIn('&action='+action,message['text'])
  token=re.search(r'#token=([a-f0-9]{64})',message['text']).group(1)
  self.assertNotIn(token,json.dumps(data));self.assertNotIn(token,json.dumps(self.call('account/export')[1]))
  return token,data['request']['id']
 def review(self,token,**decision):return request('limit-review/decide','POST',{'token':token,**decision})
 def test_01_atomic_create_duplicate_edit_and_idempotency(self):
  self.assertEqual(self.quota()['limit'],3)
  first=profile();self.assertEqual(self.call('profiles','POST',first)[0],201)
  self.assertEqual(self.call('profiles','POST',profile())[0],201)
  with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(lambda _:self.call('profiles','POST',profile())[0],range(4)))
  self.assertEqual(sorted(results),[201,409,409,409]);self.assertEqual(self.quota()['used'],3)
  self.assertEqual(self.call('profiles/'+first['id']+'/duplicate','POST',{})[0],409)
  self.assertEqual(self.call('profiles','POST',first)[0],200)
  first['name']='Still editable';self.assertEqual(self.call('profiles/'+first['id'],'PUT',first)[0],200)
  account=self.call('state')[1]['account'];account['feed_limit']=900;account['is_admin']=True
  self.assertEqual(self.call('account','PUT',account)[0],200);self.assertEqual(self.quota()['limit'],3)
  self.assertEqual(self.call('profiles/'+first['id'],'DELETE',{'confirmation':first['name']})[0],200)
  self.assertEqual(self.call('profiles','POST',profile())[0],201)
 def test_02_required_fields_and_request_isolation(self):
  self.assertEqual(self.call('feed-limit-request','POST',{'requested_limit':10,'reason':'   '})[0],400)
  self.assertEqual(self.call('feed-limit-request','POST',{'reason':'More clients'})[0],400)
  token,_=self.submit()
  self.assertNotIn('token_hash',self.quota()['request'])
  self.assertEqual(request('feed-limit-request','POST',{'requested_limit':10,'reason':'More clients'})[0],401)
  self.assertEqual(request('limit-review/read','POST',{'token':'0'*64})[0],404)
  self.assertEqual(request('limit-review/read','POST',{'token':token},origin=False)[0],403)
 def test_03_custom_approval_and_scanner_safety(self):
  token,_=self.submit(10)
  self.assertEqual(request('limit-review/decide?token='+token)[0],405)
  self.assertEqual(request('limit-review/read','POST',{'token':token})[0],200)
  self.assertEqual(self.quota()['limit'],3);self.assertEqual(self.quota()['request']['status'],'pending')
  self.assertEqual(self.review(token,decision='approve',approved_limit=3)[0],400)
  status,data,_=self.review(token,decision='approve',approved_limit=7);self.assertEqual(status,200,data)
  self.assertEqual(self.quota()['limit'],7);self.assertEqual(self.quota()['request']['approved_limit'],7)
  self.assertEqual(self.review(token,decision='approve',approved_limit=10)[0],409)
  self.assertEqual(self.review(token,decision='reject')[0],409);self.assertEqual(self.quota()['limit'],7)
  for _ in range(4):self.assertEqual(self.call('profiles','POST',profile())[0],201)
 def test_04_decline_pending_duplicates_and_expiry(self):
  token,_=self.submit()
  self.assertEqual(self.call('feed-limit-request','POST',{'requested_limit':9,'reason':'More clients'})[0],409)
  self.assertEqual(self.review(token,decision='reject')[0],200);self.assertEqual(self.quota()['limit'],3)
  token,id=self.submit(8)
  with sqlite3.connect(self.db) as db:db.execute('UPDATE feed_limit_requests SET expires_at=0 WHERE id=?',(id,))
  self.assertEqual(self.review(token,decision='approve',approved_limit=8)[0],410)
  self.assertEqual(self.quota()['request']['status'],'expired');self.assertEqual(self.quota()['limit'],3)
 def test_05_concurrent_decisions_have_one_winner(self):
  token,_=self.submit(12)
  choices=[{'decision':'approve','approved_limit':6},{'decision':'reject'},{'decision':'approve','approved_limit':9}]
  with concurrent.futures.ThreadPoolExecutor() as pool:results=list(pool.map(lambda choice:self.review(token,**choice),choices))
  self.assertEqual(sorted(x[0] for x in results),[200,409,409])
  winner=next(x[1] for x in results if x[0]==200)
  self.assertEqual(self.quota()['limit'],winner['approved_limit'] if winner['status']=='approved' else 3)
 def test_06_mail_retry_and_token_survives_account_security_changes(self):
  token,id=self.submit()
  with sqlite3.connect(self.db) as db:
   db.execute('PRAGMA foreign_keys=ON');db.execute('DELETE FROM auth_tokens WHERE owner_id=?',(self.owner,))
  self.assertEqual(request('limit-review/read','POST',{'token':token})[0],200)
  env=dict(line.split('=',1) for line in Path('.dev.vars').read_text().splitlines() if '=' in line)
  headers={'Authorization':'Bearer '+env['CRON_SECRET'].strip().strip('"').strip("'")}
  def job(path,data):return request('jobs/'+path,'POST',data,headers=headers)
  code,messages,_=job('deliveries',{});self.assertEqual(code,200);self.assertIn('limit:'+id,[m['id'] for m in messages])
  self.assertEqual(job('ack',{'id':'limit:'+id,'success':False,'error':'Local simulated mail failure'})[0],200)
  with sqlite3.connect(self.db) as db:
   row=db.execute('SELECT mail_status,mail_payload FROM feed_limit_requests WHERE id=?',(id,)).fetchone();self.assertEqual(row[0],'pending');self.assertIn(token,row[1]);db.execute('UPDATE feed_limit_requests SET mail_next_attempt=0 WHERE id=?',(id,))
  self.assertIn('limit:'+id,[m['id'] for m in job('deliveries',{})[1]])
  self.assertEqual(job('ack',{'id':'limit:'+id,'success':True})[0],200)
  with sqlite3.connect(self.db) as db:self.assertEqual(db.execute('SELECT mail_status,mail_payload FROM feed_limit_requests WHERE id=?',(id,)).fetchone(),('sent',''))
  self.assertEqual(self.review(token,decision='approve',approved_limit=10)[0],200)

if __name__=='__main__':unittest.main(verbosity=2)
