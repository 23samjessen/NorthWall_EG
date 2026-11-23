/** Standard Next.js upload build; no production credentials are needed to compile. */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublicConfig } from './native/public-config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const profile=JSON.parse(await readFile(resolve(root,'hostinger-upload.json'),'utf8'));
if(profile.profile!=='hostinger-nextjs')throw new Error('Run this build from the exported standard Next.js upload project.');
const origin=new URL(process.env.APP_ORIGIN||'https://northwallegy.com');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.port||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_ORIGIN must be one canonical HTTPS origin without a path or port.');
if(process.env.PUBLIC_LAUNCH!==undefined&&!['true','false'].includes(process.env.PUBLIC_LAUNCH))throw new Error('PUBLIC_LAUNCH must be true or false.');
const settings={origin:origin.origin,publicLaunch:process.env.PUBLIC_LAUNCH==='true'};
// Validate exactly the same explicit values that runtime will accept; URL
// normalization alone would hide a supplied default port or empty origin.
getPublicConfig(process.env,settings);
await writeFile(resolve(root,'hostinger/native/build-settings.json'),JSON.stringify(settings,null,2)+'\n');
const companyPath=resolve(root,'lib/company-profile.json');
const company=JSON.parse(await readFile(companyPath,'utf8'));
company.website.origin=settings.origin;company.website.isReviewDemo=!settings.publicLaunch;
await writeFile(companyPath,JSON.stringify(company,null,2)+'\n');
await writeFile(resolve(root,'hostinger-build.json'),JSON.stringify({format:2,profile:'hostinger-nextjs',...settings,preparedAt:new Date().toISOString()},null,2)+'\n');
console.log('Building the standard Next.js application at the project root.');
const built=spawnSync(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{
  cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},
});
if(built.error)throw built.error;
if(built.status!==0)process.exit(built.status||1);

const standalone=resolve(root,'.next/standalone');
await readFile(resolve(standalone,'server.js'));
await mkdir(resolve(standalone,'.next'),{recursive:true});
await cp(resolve(root,'public'),resolve(standalone,'public'),{recursive:true});
await cp(resolve(root,'.next/static'),resolve(standalone,'.next/static'),{recursive:true});
await cp(resolve(root,'hostinger-build.json'),resolve(standalone,'hostinger-build.json'));
// Keep the private maintenance CLI usable from the deployed application folder.
// Do not copy source-local env files, tests, or any runtime records.
for(const name of ['config.mjs','storage.mjs','schema.sql','setup.mjs','check.mjs','mail.mjs','http.mjs','auth','native']){
  await mkdir(resolve(standalone,'hostinger'),{recursive:true});
  await cp(resolve(root,'hostinger',name),resolve(standalone,'hostinger',name),{
    recursive:true,
    filter:(path)=>!/(?:^|[\\/])(?:\.env[^\\/]*|\.dev\.vars[^\\/]*|tests)(?:[\\/]|$)/.test(path),
  });
}

// Next may trace .env files. Credentials belong only in Hostinger environment
// settings; remove any such copies from this generated output, never the source.
async function removePrivateCopies(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,item.name);
    if(item.name.startsWith('.env')||item.name.startsWith('.dev.vars')){
      await rm(path,{recursive:true,force:true});continue;
    }
    if(item.isSymbolicLink()){
      const target=await realpath(path);
      const rel=relative(standalone,target);
      if(rel==='..'||rel.startsWith('..'+sep))throw new Error('Standalone output contains a link outside the deployment folder.');
    }else if(item.isDirectory())await removePrivateCopies(path);
  }
}
await removePrivateCopies(standalone);
console.log('Next.js output verified: .next/standalone/server.js');
console.log('Public and static assets included. Native sign-in and workspace routes compiled.');
console.log('Production environment files were not included in the deployment output.');

