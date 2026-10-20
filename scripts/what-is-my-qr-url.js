// Prints the URLs the QR codes will encode, plus the IPv4 phones should hit.
// Run:   node scripts/what-is-my-qr-url.js
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

const http = require('http');

function getIPv4() {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)();
    socket.connect(80, '8.8.8.8');
    socket.on('connect', function () {
      resolve(socket.localAddress);
      socket.destroy();
    });
    socket.on('error', () => resolve('?'));
  });
}

(async () => {
  const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  const lan = await getIPv4();
  console.log('\nQR Attendance · what your phone will scan\n');
  console.log('APP_URL (from .env):    ', appUrl || '<unset — fall back to request origin>');
  console.log('Detected local IPv4:    ', lan);
  console.log('\nBest URL for phones on the same Wi-Fi:');
  console.log(`  http://${lan}:3000`);
  console.log('\nMake sure APP_URL above matches that (or update .env).');
  console.log('Then scan a session QR — it will point phones at APP_URL.\n');
})();
