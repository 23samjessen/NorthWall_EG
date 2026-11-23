import mysql from 'mysql2/promise';
import { readConfig } from './config.mjs';
import { createStorage, initializeSchema, checkStorage } from './storage.mjs';
import { createAuthService, initializeAuthSchema } from './auth/index.mjs';

/** A terminal-only prompt: credentials never enter arguments, files, logs or Git. */
async function secretPrompt(label){
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Use an interactive private terminal for owner provisioning.');
  process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function finish(error){process.stdin.off('data',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');if(error)reject(error);else resolve(value);value='';}
    function input(buffer){for(const char of buffer.toString('utf8')){if(char==='\u0003'){finish(new Error('Provisioning cancelled.'));return;}if(char==='\r'||char==='\n'){finish();return;}if(char==='\u007f'||char==='\b')value=[...value].slice(0,-1).join('');else if(char>=' '&&value.length<512)value+=char;}}
    process.stdin.on('data',input);
  });
}

let pool;
try{
  const allowed=new Set(['--schema-only','--recover-owner','--cleanup']);
  if(process.argv.slice(2).some(value=>!allowed.has(value))||process.argv.slice(2).length>1)throw new Error('Use no flag, --schema-only, --recover-owner or --cleanup. Never pass a password as an argument.');
  const config=readConfig();pool=mysql.createPool(config.database);
  if(process.argv.includes('--cleanup')){
    const auth=createAuthService({pool,origin:config.origin,secret:config.secret,ownerEmail:config.ownerEmail,sendCode:async()=>{throw new Error('Maintenance does not send mail.');},getInvitation:async()=>null});
    await auth.cleanup();console.log('Expired authentication data and events older than the configured 30-day retention were pruned in bounded batches.');
  }else{
    await initializeSchema(pool);await initializeAuthSchema(pool);await checkStorage(pool);
    console.log('Workspace, private-photo and authentication tables are initialized. Existing records were preserved.');
    if(!process.argv.includes('--schema-only')){
      const storage=createStorage(pool);
      const record=await storage.DB.prepare('SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?').bind('main').first();
      const owner=record?JSON.parse(record.payload).users.find(user=>user.id==='owner'):null;
      if(owner&&(!owner.userId||owner.sample||owner.email?.toLowerCase()!==config.ownerEmail||owner.role!=='admin'))throw new Error('The imported owner needs a reviewed identity mapping before provisioning. No account was changed.');
      const recover=process.argv.includes('--recover-owner');
      console.log(`${recover?'Recovering':'Provisioning'} the configured owner. A temporary password expires after 24 hours and must be replaced after email verification.`);
      let password=await secretPrompt('Temporary owner password (hidden): ');
      let confirmation=await secretPrompt('Confirm temporary password (hidden): ');
      if(password!==confirmation)throw new Error('Passwords did not match. No account was changed.');
      const auth=createAuthService({pool,origin:config.origin,secret:config.secret,ownerEmail:config.ownerEmail,sendCode:async()=>{throw new Error('Offline provisioning does not send mail.');},getInvitation:async()=>null});
      const result=await auth.createOwner(config.ownerEmail,password,{temporary:true,name:'Sam Jessen',...(owner?{userId:owner.userId}:{}),replace:recover});
      password='';confirmation='';
      console.log(`Owner ${result.created?'created':'recovered'} for ${result.email}. Email verification and a new password are required before workspace access.`);
    }
  }
}catch(error){
  const safe=error instanceof Error&&['StorageError','AuthError','Error'].includes(error.name)&&!('sql' in error)&&!('sqlMessage' in error)?error.message:'Setup could not be completed. Check the private server configuration.';
  console.error(safe);process.exitCode=1;
}finally{if(pool)await pool.end();}
