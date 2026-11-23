"""Create the standard Next.js upload profile without changing preview source."""

import json


def create_next_profile(files):
    def text(name):
        return files[name][0].decode('utf-8')

    def put(name, value):
        files[name] = (value.encode('utf-8'), 0o644)

    def replace(name, before, after):
        value = text(name)
        if before not in value:
            raise ValueError('Native Next export contract changed: ' + name)
        put(name, value.replace(before, after))

    already_native = False
    if 'hostinger-upload.json' in files:
        already_native = json.loads(text('hostinger-upload.json')).get('profile') == 'hostinger-nextjs'

    if not already_native:
        replace('lib/workspace-server.ts', "import { env } from 'cloudflare:workers';",
                "import { env, trustedIdentity } from '../hostinger/runtime-env';")
        name = 'lib/workspace-server.ts'
        value = text(name)
        start = value.index('export function requestIdentity(request:Request):Identity {')
        end = value.index('\nfunction bootstrapAllowed', start)
        value = value[:start] + """export function requestIdentity(_request:Request):Identity {
  const identity=trustedIdentity();
  if(!identity)throw new ApiError(401,'sign_in_required','Sign in to access the employee workspace.');
  return identity;
}""" + value[end:]
        put(name, value)
        replace('components/workspace.tsx', 'Private Site sharing is a separate hosting requirement.',
                'Sign-in verification and owner approval are both required.')
        replace('components/workspace.tsx', '/signin-with-chatgpt?return_to=%2Fworkspace',
                '/sign-in?return_to=%2Fworkspace')
        replace('components/workspace.tsx', '/signout-with-chatgpt?return_to=%2Fworkspace',
                '/sign-in?mode=logout&return_to=%2Fworkspace')
        replace('lib/news-service.ts', 'import.meta.env?.DEV', "process.env.NODE_ENV !== 'production'")

        # Route handlers verify the session at the data boundary. A Proxy-created
        # identity is never trusted across Next's separate execution contexts.
        for route, methods in [('workspace', ['GET', 'POST']),
                               ('profile-photo', ['GET', 'POST', 'DELETE'])]:
            path = 'app/api/' + route
            source = text(path + '/route.ts')
            put(path + '/business-handlers.ts', source)
            code = "import { withWorkspaceRequest } from '@/hostinger/native/handlers';\n"
            code += "import * as business from './business-handlers';\n"
            code += "export const runtime='nodejs';\nexport const dynamic='force-dynamic';\n"
            for method in methods:
                code += f'export async function {method}(request:Request){{return withWorkspaceRequest(request,business.{method});}}\n'
            put(path + '/route.ts', code)

        original_news = text('app/api/news/route.ts')
        put('app/api/news/business-handlers.ts', original_news)
        put('app/api/news/route.ts', "import { withPublicRequest } from '@/hostinger/native/handlers';\nimport { GET as readNews } from './business-handlers';\nexport const runtime='nodejs';\nexport const dynamic='force-dynamic';\nexport async function GET(request:Request){return withPublicRequest(request,()=>readNews());}\n")

        guards = {
            'app/page.tsx': ('export default function Home() {', 'export default async function Home() { await requireCompanyAccess(\'/\');'),
            'app/en/page.tsx': ('export default function Home() {', 'export default async function Home() { await requireCompanyAccess(\'/en\');'),
            'app/ar/page.tsx': ('export default function Home() {', 'export default async function Home() { await requireCompanyAccess(\'/ar\');'),
            'app/insights/page.tsx': ('export default async function InsightsPage() {', 'export default async function InsightsPage() { await requireCompanyAccess(\'/insights\');'),
            'app/insights/[slug]/page.tsx': ('export default async function InsightGuidePage({ params }: Props) {', 'export default async function InsightGuidePage({ params }: Props) { await requireCompanyAccess(\'/insights\');'),
            'app/[locale]/services/[id]/page.tsx': ('export default async function ServicePage({params}:Props){', 'export default async function ServicePage({params}:Props){ await requireCompanyAccess(\'/\');'),
        }
        for name, (before, after) in guards.items():
            replace(name, before, after)
            put(name, "import { requireCompanyAccess } from '@/hostinger/native/site-auth';\n" + text(name))
        replace('app/insights/[slug]/page.tsx',
                'export async function generateMetadata({ params }: Props): Promise<Metadata> {',
                'export async function generateMetadata({ params }: Props): Promise<Metadata> { await requireCompanyAccess(\'/insights\');')
        replace('app/[locale]/services/[id]/page.tsx',
                'export async function generateMetadata({params}:Props):Promise<Metadata>{',
                'export async function generateMetadata({params}:Props):Promise<Metadata>{ await requireCompanyAccess(\'/\');')
        replace('app/workspace/page.tsx', 'export default function WorkspacePage() {',
                "export default async function WorkspacePage() { await requireChatGPTUser('/workspace');")
        put('app/workspace/page.tsx', "import { requireChatGPTUser } from '@/hostinger/native/site-auth';\n" + text('app/workspace/page.tsx'))

    put('app/chatgpt-auth.ts', "export * from '@/hostinger/native/site-auth';\n")
    put('app/api/auth/[...path]/route.ts', "import { handleAuthRequest } from '@/hostinger/native/handlers';\nexport const runtime='nodejs';\nexport const dynamic='force-dynamic';\nexport const GET=handleAuthRequest;\nexport const POST=handleAuthRequest;\n")
    put('app/sign-in/page.tsx', "import SignIn from '@/hostinger/login-page';\nimport '@/hostinger/login.css';\nexport const runtime='nodejs';\nexport const dynamic='force-dynamic';\nexport const metadata={title:'Employee sign in | NorthWallEg',robots:{index:false,follow:false}};\nexport default function Page(){return <SignIn/>;}\n")
    for path, logout in [('signin-with-chatgpt', False), ('signout-with-chatgpt', True)]:
        put('app/' + path + '/route.ts', "import { NextResponse } from 'next/server';\nimport { safeReturnPath } from '@/hostinger/http.mjs';\nimport { getPublicConfig } from '@/hostinger/native/public-config.mjs';\nexport const dynamic='force-dynamic';\nexport function GET(request:Request){const config=getPublicConfig();const url=new URL(request.url);const target=new URL('/sign-in',config.origin);target.searchParams.set('return_to',safeReturnPath(url.searchParams.get('return_to')));" + ("target.searchParams.set('mode','logout');" if logout else '') + "return NextResponse.redirect(target,303);}\n")
    put('proxy.ts', text('hostinger/native/proxy.ts'))
    files.pop('next.config.ts', None)
    put('next.config.mjs', """import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export default {
  output:'standalone', distDir:'.next', outputFileTracingRoot:root,
  poweredByHeader:false, generateEtags:false,
  serverExternalPackages:['mysql2','nodemailer'],
  experimental:{cpus:2},
};
""")
    compiler = json.loads(text('tsconfig.json'))
    compiler['exclude'] = ['node_modules', '.next', 'hostinger/tests', '.hostinger-app']
    compiler['compilerOptions']['incremental'] = False
    put('tsconfig.json', json.dumps(compiler, indent=2) + '\n')
    package = json.loads(text('package.json'))
    package['scripts'].update({
        'dev': 'next dev --webpack',
        'build': 'node hostinger/build-next.mjs',
        'start': 'node .next/standalone/server.js',
        'build:hostinger': 'node hostinger/build-next.mjs',
        'start:hostinger': 'node .next/standalone/server.js',
        'test:hostinger-render': 'node --test hostinger/tests/native-render.mjs',
    })
    put('package.json', json.dumps(package, indent=2, ensure_ascii=False) + '\n')
    readme = text('hostinger/UPLOAD_NEXT_README.md')
    put('START_HERE_HOSTINGER.md', readme)
    put('UPLOAD_TO_HOSTINGER_FIRST.md', readme)
    put('README.md', readme + '\n\n---\n\n## Original project reference\n\nThe following reference describes the shared preview source and legacy custom-server target. For this exported ZIP, follow the standard Next.js deployment instructions above.\n\n' + text('README.md'))

