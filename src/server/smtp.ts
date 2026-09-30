import {connect} from 'cloudflare:sockets';
import {Buffer} from 'node:buffer';
import {runtime} from './runtime';

export type MailMessage={id:string;to:string;subject:string;text:string};
export async function sendSmtp(message?:MailMessage){
 const env=runtime();if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASSWORD)throw Error('Email transport unavailable.');
 const socket=connect({hostname:env.SMTP_HOST,port:465},{secureTransport:'on',allowHalfOpen:false});
 const reader=socket.readable.getReader(),writer=socket.writable.getWriter();
 const decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='',bytes=0;
 const reply=async(expected:number[])=>{
  for(let lines=0;lines<100;lines++){
   while(!buffer.includes('\r\n')){const next=await reader.read();if(next.done)throw Error('SMTP disconnected.');bytes+=next.value.length;if(bytes>65536)throw Error('SMTP response too large.');buffer+=decoder.decode(next.value,{stream:true});}
   const at=buffer.indexOf('\r\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+2);
   if(!/^\d{3}[ -]/.test(line))throw Error('Invalid SMTP response.');
   if(line[3]===' '){const code=Number(line.slice(0,3));if(!expected.includes(code))throw Error(`SMTP response ${code}.`);return;}
  }throw Error('SMTP response too long.');
 };
 const command=async(value:string,expected:number[])=>{await writer.write(encoder.encode(value+'\r\n'));await reply(expected);};
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([(async()=>{
   await socket.opened;await reply([220]);await command('EHLO legalfeed.helveticlens.ch',[250]);
   await command('AUTH PLAIN '+Buffer.from(`\0${env.SMTP_USER}\0${env.SMTP_PASSWORD}`).toString('base64'),[235]);
   if(message){
    const from=env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1]||env.EMAIL_FROM||env.SMTP_USER!;
    if(!/^[^\s<>@]+@[^\s<>@]+$/.test(from)||! /^[^\s<>@]+@[^\s<>@]+$/.test(message.to))throw Error('Invalid mail address.');
    await command(`MAIL FROM:<${from}>`,[250]);await command(`RCPT TO:<${message.to}>`,[250,251]);await command('DATA',[354]);
    const text=Buffer.from(message.text,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
    const body=[`From: Legal Feed <${from}>`,`To: ${message.to}`,`Subject: =?UTF-8?B?${Buffer.from(message.subject,'utf8').toString('base64')}?=`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${message.id.replace(/[^a-zA-Z0-9.-]/g,'-')}@legalfeed.helveticlens.ch>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',text].join('\r\n');
    await command(body+'\r\n.',[250]);
   }
   // A failed QUIT cannot turn an already accepted DATA into a retry.
  })(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{void socket.close().catch(()=>{});reject(Error('SMTP timed out.'));},20000);})]);
 }finally{if(timeout)clearTimeout(timeout);reader.releaseLock();writer.releaseLock();await socket.close().catch(()=>{});}
}
