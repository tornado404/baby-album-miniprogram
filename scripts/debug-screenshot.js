/**
 * Debug screenshot test - logs to file
 */
const m = require('miniprogram-automator');
const fs = require('fs');
const logFile = 'debug-screenshot.log';

function log(msg) {
  fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n');
  console.log(msg);
}

async function main() {
  fs.writeFileSync(logFile, '=== debug-screenshot ===\n');

  log('1. Connecting...');
  const mp = await m.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  log('2. Connected');

  log('3. Navigating...');
  const page = await mp.reLaunch('/pages/album_home/album_home');
  log('4. Navigated, path: ' + (page ? page.path : 'null'));

  log('5. Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));

  log('6. Taking screenshot...');
  try {
    const ss = await Promise.race([
      mp.screenshot(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout 20s')), 20000))
    ]);
    log('7. Screenshot got data, type: ' + typeof ss + ', length: ' + (ss ? ss.length : 0));
    if (ss && typeof ss === 'string') {
      const buf = Buffer.from(ss, 'base64');
      fs.writeFileSync('debug-screen.png', buf);
      log('8. Saved debug-screen.png, ' + buf.length + ' bytes');
    } else {
      log('8. Invalid screenshot data');
    }
  } catch (e) {
    log('7. Screenshot ERROR: ' + e.message);
    log('Stack: ' + (e.stack ? e.stack.slice(0, 200) : 'none'));
  }

  log('9. Closing...');
  await mp.close();
  log('10. Done');
}

main().catch(e => {
  const msg = 'Fatal: ' + e.message;
  fs.appendFileSync(logFile, msg + '\n');
  console.error(msg);
});