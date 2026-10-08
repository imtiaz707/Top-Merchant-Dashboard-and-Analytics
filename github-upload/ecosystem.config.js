// PM2 process file for the on-prem (standalone) build.
// After `npm run build`, copy static assets next to the standalone server:
//   cp -r .next/static .next/standalone/.next/static
//   cp -r public       .next/standalone/public
// then: pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'merchant-analytics-dashboard',
    script: '.next/standalone/server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '600M',
    env: { NODE_ENV: 'production', PORT: 3000, ASSET_MODE: 'local' },
  }],
};
