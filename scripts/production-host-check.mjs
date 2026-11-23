// The delivered build is a Worker module, not a standalone Node server.
// An accidental generic npm deployment must not expose gateway-trusting APIs.
console.error('This revision runs on Cloudflare Worker hosting with a trusted identity gateway.');
console.error('For the Hostinger Node application, configure NORTHWALL_RUNTIME=hostinger and the private settings before building and starting.');
console.error('Read docs/HOSTINGER_AND_DOMAIN.md before deploying to Hostinger.');
console.error('For a built local-only preview, use npm run preview:worker.');
process.exitCode = 78;
