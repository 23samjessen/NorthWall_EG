import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.hostinger-app');
// Only this reproducible build directory is replaced; no runtime data is stored here.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['app', 'components', 'hooks', 'lib', 'public', 'hostinger', 'postcss.config.mjs', 'cloudflare-env.d.ts']) {
  await cp(resolve(root, path), resolve(output, path), { recursive: true });
}
const replace = async (path, oldText, newText) => {
  const file = resolve(output, path); const source = await readFile(file, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Hostinger preparation contract changed: ${path}`);
  await writeFile(file, source.replaceAll(oldText, newText));
};
await replace('lib/workspace-server.ts', "import { env } from 'cloudflare:workers';", "import { env, trustedIdentity } from '../hostinger/runtime-env';");
{
  const file=resolve(output,'lib/workspace-server.ts');const source=await readFile(file,'utf8');
  const start=source.indexOf('export function requestIdentity(request:Request):Identity {');
  const end=source.indexOf('\nfunction bootstrapAllowed',start);
  if(start<0||end<0)throw new Error('The workspace identity adapter contract changed.');
  const identity="export function requestIdentity(_request:Request):Identity {\n  const identity=trustedIdentity();\n  if(!identity)throw new ApiError(401,'sign_in_required','Sign in to access the employee workspace.');\n  return identity;\n}";
  await writeFile(file,source.slice(0,start)+identity+source.slice(end));
}
await replace('components/workspace.tsx', 'Private Site sharing is a separate hosting requirement.', 'Sign-in verification and owner approval are both required.');
await replace('components/workspace.tsx', '/signin-with-chatgpt?return_to=%2Fworkspace', '/sign-in?return_to=%2Fworkspace');
await replace('components/workspace.tsx', '/signout-with-chatgpt?return_to=%2Fworkspace', '/sign-in?mode=logout&return_to=%2Fworkspace');
await cp(resolve(root,'hostinger/site-auth.ts'),resolve(output,'app/chatgpt-auth.ts'));
// This method is used only by the Worker preview. Native Next has no import.meta.env.
await replace('lib/news-service.ts', 'import.meta.env?.DEV', "process.env.NODE_ENV !== 'production'");
const profilePath = resolve(output, 'lib/company-profile.json');
const profile = JSON.parse(await readFile(profilePath, 'utf8'));
{
  const origin = new URL(process.env.APP_ORIGIN || 'https://northwallegy.com');
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) throw new Error('APP_ORIGIN must be an HTTPS origin.');
  profile.website.origin = origin.origin;
}
// PUBLIC_LAUNCH is intentionally opt-in. It must agree at build time and runtime.
profile.website.isReviewDemo = process.env.PUBLIC_LAUNCH !== 'true';
await writeFile(profilePath, JSON.stringify(profile, null, 2) + '\n');
await mkdir(resolve(output, 'app/sign-in'), { recursive: true });
await writeFile(resolve(output, 'app/sign-in/page.tsx'), "import SignIn from '@/hostinger/login-page';\nimport '@/hostinger/login.css';\nexport const dynamic='force-dynamic';\nexport const metadata={title:'Employee sign in | NorthWallEg',robots:{index:false,follow:false}};\nexport default function Page(){return <SignIn/>;}\n");
const compiler = JSON.parse(await readFile(resolve(root, 'tsconfig.json'), 'utf8'));
compiler.exclude = ['node_modules', '.next', 'hostinger/tests'];
compiler.compilerOptions.incremental = false;
await writeFile(resolve(output, 'tsconfig.json'), JSON.stringify(compiler, null, 2) + '\n');
await writeFile(resolve(output, 'next.config.mjs'), "export default {poweredByHeader:false,generateEtags:false,distDir:'.next',serverExternalPackages:['mysql2','nodemailer'],experimental:{cpus:2}};\n");
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await writeFile(resolve(output, 'package.json'), JSON.stringify({name:'northwalleg-hostinger',private:true,type:'module',version:manifest.version,dependencies:manifest.dependencies,devDependencies:manifest.devDependencies}, null, 2) + '\n');
const security = await readFile(resolve(root, 'lib/security-headers.ts'), 'utf8');
await writeFile(resolve(output, 'hostinger/security-controls.mjs'), ts.transpileModule(security, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
await writeFile(resolve(output, 'hostinger-build.json'), JSON.stringify({format:1,publicLaunch:profile.website.isReviewDemo===false,origin:profile.website.origin,preparedAt:new Date().toISOString()}, null, 2) + '\n');
console.log('Prepared the standard Next.js Hostinger application; runtime secrets were not copied.');
