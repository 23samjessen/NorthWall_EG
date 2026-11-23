import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { readConfig } from './config.mjs';
import { checkStorage } from './storage.mjs';

let pool,mail;
try{
  if(process.argv.slice(2).some(value=>value!=='--smtp'))throw new Error('Use --smtp only when you want to check the configured mailbox connection. No email is sent.');
  const config=readConfig();pool=mysql.createPool(config.database);
  const storage=await checkStorage(pool);
  const [tables]=await pool.execute("SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('nw_auth_accounts','nw_auth_flows','nw_auth_sessions','nw_auth_limits','nw_auth_events')");
  if(tables.length!==5||tables.some(table=>String(table.engine).toLowerCase()!=='innodb'))throw new Error('Initialize all five authentication tables as InnoDB.');
  const [[owner]]=await pool.execute('SELECT COUNT(*) AS count FROM nw_auth_accounts WHERE email=? AND enabled=1',[config.ownerEmail]);
  if(Number(owner.count)!==1)throw new Error('Provision the configured owner through the private setup command.');
  if(process.argv.includes('--smtp')){mail=nodemailer.createTransport(config.smtp);await mail.verify();}
  console.log(JSON.stringify({configuration:'valid',databaseVersion:storage.version,storage:'ready',maxAllowedPacket:storage.maxAllowedPacket,authenticationTables:'ready',owner:'provisioned',smtp:process.argv.includes('--smtp')?'connection verified; delivery still requires a real sign-in test':'not checked',https:'edge confirmation configured; verify the actual domain separately',publicLaunch:config.publicLaunch},null,2));
}catch{
  console.error('Preflight failed. Check the private environment, initialized InnoDB tables, packet allowance, owner provisioning and optional SMTP settings. Driver details are suppressed to protect credentials.');process.exitCode=1;
}finally{mail?.close();if(pool)await pool.end();}
