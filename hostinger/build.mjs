import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const [command,args,cwd] of [
  [process.execPath,[resolve(root,'hostinger/prepare.mjs')],root],
  [process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'build','--webpack'],resolve(root,'.hostinger-app')],
]) {
  const result=spawnSync(command,args,{cwd,stdio:'inherit',env:{...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
