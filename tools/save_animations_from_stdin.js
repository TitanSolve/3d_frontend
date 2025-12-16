// Usage: paste localStorage content into stdin or pipe it
// Example: node tools/save_animations_from_stdin.js < animations_export.txt
// Or: (in browser) copy(localStorage.getItem('animations.txt')) then run script and paste

const fs = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '..', 'animations.txt');

let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  data = data.trim();
  if (!data) {
    console.error('No input received on stdin. Please pipe the localStorage string into this script.');
    process.exit(1);
  }
  try {
    // Try to pretty-format JSON if possible
    let out = data;
    try {
      const parsed = JSON.parse(data);
      out = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // not JSON, write raw
    }
    fs.writeFileSync(outPath, out, 'utf8');
    console.log('Wrote animations to', outPath);
  } catch (err) {
    console.error('Failed to write file:', err);
    process.exit(1);
  }
});

// If no piped input, read from clipboard isn't possible in Node CLI reliably.
if (process.stdin.isTTY) {
  console.log('Awaiting pasted content (end with Ctrl+D):');
}
