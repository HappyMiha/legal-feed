"""Language preferences and translated email flows against local D1; no SMTP sends."""
import json, sqlite3, unittest, urllib.request, uuid
from auth_support import BASE, PASSWORD, request, signup, mail_token, db_path, clean
class Languages(unittest.TestCase):
 def setUp(self):self.owners=[]
 def tearDown(self):clean(self.owners)
 def account(self):
  email,cookie,owner=signup();self.owners.append(owner);return email,cookie,owner
 def html(self,path='/',cookie=''):
  with urllib.request.urlopen(urllib.request.Request(BASE+path,headers={'Cookie':cookie}),timeout=30) as r:return r.read().decode()
 def test_guest_pages_in_every_language(self):
  for locale,title in [('de-CH','Ihr persönlicher'),('fr-CH','Votre fil'),('it-CH','Il tuo feed')]:
   html=self.html(cookie='legalfeed_locale='+locale);self.assertIn('lang="'+locale+'"',html);self.assertIn('value="'+locale+'"',html);self.assertNotIn('Your personal feed of Swiss legal updates.</h1>',html)
   html=self.html('/register','legalfeed_locale='+locale);self.assertIn('lang="'+locale+'"',html);self.assertNotIn('Create your Legal Feed account</h1>',html)
 def test_persisted_locale_is_isolated_and_survives_stale_settings(self):
  email,cookie,owner=self.account();_,other,other_owner=self.account();stale=request('state',cookie=cookie)[1]['account']
  self.assertEqual(stale['locale'],'en');self.assertEqual(request('account/language','PUT',{'locale':'de-CH'},cookie=cookie)[0],200)
  self.assertEqual(request('state',cookie=cookie)[1]['account']['locale'],'de-CH');self.assertEqual(request('state',cookie=other)[1]['account']['locale'],'en')
  self.assertEqual(request('account','PUT',stale,cookie=cookie)[0],200);self.assertEqual(request('state',cookie=cookie)[1]['account']['locale'],'de-CH')
  self.assertIn('lang="de-CH"',self.html('/settings',cookie+'; legalfeed_locale=fr-CH'))
  self.assertEqual(request('account/language','PUT',{'locale':'fr-CH'},cookie=cookie,origin=False)[0],403)
  self.assertEqual(request('account/language','PUT',{'locale':'fr-CH'})[0],401)
  self.assertEqual(request('account/language','PUT',{'locale':'en','owner_id':other_owner},cookie=cookie)[0],400)
  self.assertEqual(request('account/language','PUT',{'locale':'de'},cookie=cookie)[0],400)
  self.assertEqual(request('state',cookie=cookie)[1]['account']['locale'],'de-CH')
 def test_signup_language_survives_verification_in_another_browser_and_localizes_mail(self):
  for locale in ['de-CH','fr-CH','it-CH']:
   email='integration-'+uuid.uuid4().hex+'@example.test'
   status,data,_=request('auth/register','POST',{'name':'Original Weiß','email':email,'password':PASSWORD,'locale':locale});self.assertEqual(status,202,data)
   with sqlite3.connect(db_path()) as db:
    payload=json.loads(db.execute('SELECT m.payload FROM auth_mail m JOIN auth_tokens t ON t.token_hash=m.token_hash WHERE t.email=?',(email,)).fetchone()[0])
   self.assertIn('?lang='+locale+'#token=',payload['text']);self.assertNotEqual(payload['subject'],'Confirm your Legal Feed account')
   status,_,headers=request('auth/verify','POST',{'token':mail_token(email)});self.assertEqual(status,200);cookie=headers['Set-Cookie'].split(';')[0]
   state=request('state',cookie=cookie)[1];self.owners.append(state['account_id']);self.assertEqual(state['account']['locale'],locale);self.assertEqual(state['account']['name'],'Original Weiß')
   request('auth/forgot-password','POST',{'email':email,'locale':'en'})
   with sqlite3.connect(db_path()) as db:
    payload=json.loads(db.execute("SELECT m.payload FROM auth_mail m JOIN auth_tokens t ON t.token_hash=m.token_hash WHERE t.email=? AND t.kind='reset'",(email,)).fetchone()[0])
   self.assertIn('?lang='+locale+'#token=',payload['text']);self.assertNotEqual(payload['subject'],'Reset your Legal Feed password')
if __name__=='__main__':unittest.main(verbosity=2)
