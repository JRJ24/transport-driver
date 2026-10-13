#!/usr/bin/env node
/**
 * Arranca Metro para el dev client anunciando la IP real de la red Wi-Fi.
 *
 * El router cambia la IP de la PC (10.0.0.79 -> 10.0.0.90...) y Windows
 * tiene adaptadores virtuales (VirtualBox 192.168.56.x, WSL, Hyper-V) que Expo
 * puede elegir por error: el telefono no los alcanza y sale
 * "Unable to load script". Aqui se detecta la IP buena en cada arranque.
 *
 * Uso: pnpm dev            (o: node scripts/dev.js -c para limpiar cache)
 */
const os = require('os');
const { spawn } = require('child_process');

const VIRTUAL = /virtualbox|vmware|vethernet|hyper-v|wsl|docker|loopback|bluetooth/i;
const VIRTUAL_RANGES = [/^192\.168\.56\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];

function lanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (VIRTUAL.test(name) || VIRTUAL_RANGES.some((r) => r.test(a.address))) continue;
      // Wi-Fi primero.
      candidates.push({ ip: a.address, score: /wi-?fi|wlan|wireless/i.test(name) ? 0 : 1 });
    }
  }
  candidates.sort((x, y) => x.score - y.score);
  return candidates[0]?.ip;
}

const ip = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || lanIp();
if (!ip) {
  console.error('No encontre una IP de red local. Conecta la PC al Wi-Fi.');
  process.exit(1);
}
console.log(`\n  Metro en http://${ip}:8081  (el telefono debe estar en el mismo Wi-Fi)\n`);

const extra = process.argv.slice(2).filter((a) => /^[-\w=]+$/.test(a)).join(' ');
const child = spawn(`npx expo start --dev-client ${extra}`.trim(), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip },
});
child.on('exit', (code) => process.exit(code ?? 0));
