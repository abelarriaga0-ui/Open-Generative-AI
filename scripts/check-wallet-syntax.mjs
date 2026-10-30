import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

const files = ['proxy.js', ...javascriptFiles('lib/wallet'), ...javascriptFiles('app/api/wallet')];
for (const file of files) {
  // Force ESM parsing. Module autodetection can mask a bad JS file in this repo.
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: readFileSync(file, 'utf8'), encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error('Syntax check failed:', file);
    console.error(result.stderr);
    process.exit(1);
  }
}
console.log(`${files.length} wallet/proxy JavaScript files parsed successfully.`);
