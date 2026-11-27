import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export default {
  output:'standalone', distDir:'.next', outputFileTracingRoot:root,
  poweredByHeader:false, generateEtags:false,
  serverExternalPackages:['mysql2','nodemailer'],
  experimental:{cpus:2},
};
