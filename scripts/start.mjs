if (process.env.NORTHWALL_RUNTIME === 'hostinger') {
  await import('../hostinger/server.mjs');
} else {
  await import('./production-host-check.mjs');
}
