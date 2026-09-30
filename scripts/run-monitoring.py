#!/usr/bin/env python3
"""Background ingestion and authenticated SMTP outbox transport. No browser session required."""
import json, os, smtplib, ssl, time, urllib.request, urllib.error
from email.message import EmailMessage
from email.utils import formatdate

origin = os.environ['LEGAL_FEED_URL'].rstrip('/')

def api(path, payload=None, timeout=160):
    headers = {'Authorization': 'Bearer ' + os.environ['CRON_SECRET'], 'Content-Type': 'application/json'}
    bypass = os.environ.get('SITES_SERVICE_TOKEN')
    if bypass:
        headers['OAI-Sites-Authorization'] = 'Bearer ' + bypass
    request = urllib.request.Request(origin + '/api/jobs/' + path, data=json.dumps(payload or {}).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)

def deliver():
    messages = api('deliveries')
    if not messages:
        print('No email deliveries due.')
        return 0
    pending = list(messages)
    failures = 0
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.environ.get('SMTP_PORT', '587')), timeout=40) as smtp:
            smtp.ehlo(); smtp.starttls(context=context); smtp.ehlo()
            smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
            for item in messages:
                message = EmailMessage()
                message['From'] = os.environ['EMAIL_FROM']
                message['To'] = item['to']
                message['Subject'] = ' '.join(item['subject'].splitlines())
                message['Date'] = formatdate(localtime=False)
                message['Message-ID'] = f"<{item['id'].replace(':', '.')}@legal-feed.helveticlens.ch>"
                message.set_content(item['text'])
                pending.remove(item)
                try:
                    smtp.send_message(message)
                except smtplib.SMTPRecipientsRefused as error:
                    api('ack', {'id': item['id'], 'success': False, 'error': type(error).__name__})
                    failures += 1
                    continue
                except (smtplib.SMTPException, OSError) as error:
                    api('ack', {'id': item['id'], 'success': False, 'error': type(error).__name__})
                    raise
                # A failed acknowledgement does not make an accepted SMTP send a failure.
                for attempt in range(3):
                    try:
                        api('ack', {'id': item['id'], 'success': True})
                        break
                    except Exception:
                        if attempt == 2:
                            raise
                        time.sleep(2 ** attempt)
    except Exception:
        for item in pending:
            try:
                api('ack', {'id': item['id'], 'success': False, 'unattempted': True, 'error': 'Transport unavailable before send'})
            except Exception:
                pass  # The lease will expire; scheduler history retains this failure.
        raise
    print(f'Processed {len(messages)} queued messages; {failures} refused recipients.')
    return failures

def main():
    failures = 0
    def deliver_safely():
        nonlocal failures
        try:
            failures += deliver()
        except Exception as error:
            failures += 1
            print('Email transport failed:', type(error).__name__)
    deliver_safely()
    completed = 0
    deadline = time.monotonic() + 20 * 60
    while completed < int(os.environ.get('MONITOR_BATCH_SIZE', '40')) and time.monotonic() < deadline:
        result = api('monitor')
        if result.get('processed'):
            completed += 1
        print(json.dumps({key:result[key] for key in ('processed','source','status','updates','idle','retry_at') if key in result}), flush=True)
        deliver_safely()
        retry_at = result.get('retry_at')
        if retry_at:
            delay = max(1, retry_at / 1000 - time.time())
            if delay > 120 or time.monotonic() + delay >= deadline:
                break  # Longer cooldowns resume on the next scheduled run.
            while delay > 0:
                pause = min(60, delay)
                time.sleep(pause)
                delay -= pause
                deliver_safely()
        elif not result.get('processed'):
            break
    api('cleanup')
    if failures:
        raise RuntimeError(f'{failures} email delivery failures; source monitoring completed.')

if __name__ == '__main__':
    main()
