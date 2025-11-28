// Minimal zero-dependency test runner
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname);
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.js'));

let passed = 0;
let failed = 0;

(async () => {
  for (const file of files) {
    try {
      await require(path.join(testsDir, file));
      console.log(`ok - ${file}`);
      passed++;
    } catch (err) {
      console.error(`not ok - ${file}: ${err && err.stack ? err.stack : err}`);
      failed++;
    }
  }
  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
})();

