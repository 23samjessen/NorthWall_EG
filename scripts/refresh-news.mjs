import { readFile, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

// Reuse the exact server source parser and its fixed publisher allowlist.
// Never replace a good snapshot with an error response or incomplete source set.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const temporary=await mkdtemp(join(tmpdir(),'northwalleg-news-'));
try {
  const source=await readFile(join(root,'lib/news-source.ts'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const modulePath=join(temporary,'news-source.mjs');
  await writeFile(modulePath,compiled);
  const {fetchNews}=await import(pathToFileURL(modulePath).href);
  const result=await fetchNews();
  if(result.status!=='live'||!result.items.length||!result.fetchedAt){
    console.error('News snapshot not changed: all configured sources must succeed.');
    for(const error of result.errors)console.error(`${error.source}: ${error.code||'unavailable'}`);
    process.exitCode=1;
  } else {
    const snapshot={schemaVersion:1,language:'en',fetchedAt:result.fetchedAt,items:result.items};
    const path=join(root,'lib/news-snapshot.json');
    const pending=path+'.pending';
    await writeFile(pending,JSON.stringify(snapshot,null,2)+'\n');
    await rename(pending,path);
    console.log(JSON.stringify({saved:'lib/news-snapshot.json',items:snapshot.items.length,sources:[...new Set(snapshot.items.map(item=>item.source))],fetchedAt:snapshot.fetchedAt}));
  }
} finally { await rm(temporary,{recursive:true,force:true}); }
