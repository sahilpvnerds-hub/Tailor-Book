const fs = require('fs');

for (const f of ['package-lock.json', 'yarn.lock']) {
  try {
    fs.unlinkSync(f);
  } catch (_) {}
}

if (!/pnpm\//.test(process.env.npm_config_user_agent || '')) {
  console.error('Use pnpm instead');
  process.exit(1);
}
