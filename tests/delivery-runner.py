import importlib.util, os, smtplib, unittest
from unittest.mock import patch
os.environ.update(LEGAL_FEED_URL='https://example.invalid',SMTP_HOST='example.invalid',SMTP_USER='test',SMTP_PASSWORD='test',EMAIL_FROM='test@example.invalid')
spec=importlib.util.spec_from_file_location('runner','scripts/run-monitoring.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class DeliveryTests(unittest.TestCase):
 def messages(self):return [dict(id=str(i),to=f'{i}@example.invalid',subject='Test',text='Test only') for i in range(2)]
 def test_refused_recipient_does_not_discard_next_message(self):
  calls=[]
  def api(path,payload=None):
   if path=='deliveries':return self.messages()
   calls.append(payload)
  with patch.object(runner,'api',side_effect=api),patch.object(runner.smtplib,'SMTP') as smtp:
   smtp.return_value.__enter__.return_value.send_message.side_effect=[smtplib.SMTPRecipientsRefused({'0@example.invalid':(550,b'Unknown')}),None]
   self.assertEqual(runner.deliver(),1)
  self.assertEqual([c['success'] for c in calls],[False,True])
 def test_connection_failure_releases_unattempted_claims(self):
  calls=[]
  def api(path,payload=None):
   if path=='deliveries':return self.messages()
   calls.append(payload)
  with patch.object(runner,'api',side_effect=api),patch.object(runner.smtplib,'SMTP',side_effect=OSError('unavailable')):
   with self.assertRaises(OSError):runner.deliver()
  self.assertEqual(len(calls),2);self.assertTrue(all(c['unattempted'] for c in calls))
 def test_provider_cooldown_retries_without_stopping_email_delivery(self):
  results=iter([{'processed':False,'status':'retrying','retry_at':(runner.time.time()+2)*1000},{'processed':True,'status':'ok','updates':0},{'processed':False}]);calls=[]
  def api(path,payload=None):
   calls.append(path)
   return next(results) if path=='monitor' else {}
  with patch.object(runner,'api',side_effect=api),patch.object(runner,'deliver',return_value=0) as delivery,patch.object(runner.time,'sleep') as sleep:
   runner.main()
   self.assertEqual(calls.count('monitor'),3);self.assertIn('cleanup',calls);sleep.assert_called_once();self.assertGreaterEqual(delivery.call_count,4)
if __name__=='__main__':unittest.main(verbosity=2)
