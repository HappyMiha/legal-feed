import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
await mkdir('.wrangler',{recursive:true});
const config={name:'legal-feed-local',compatibility_date:'2026-09-01',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:resolve('drizzle')}]};
await writeFile('.wrangler/local.json',JSON.stringify(config));
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--persist-to','.wrangler/state','--config','.wrangler/local.json'],{stdio:'inherit',env:{...process.env,CI:'true',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
if(result.error)throw result.error;
process.exit(result.status??1);
