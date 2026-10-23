import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
async function files(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await files(file)));
    else if (item.name !== 'release-manifest.json') result.push(file);
  }
  return result;
}
let commit = process.env.GITHUB_SHA;
if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    commit = 'local-uncommitted';
  }
}
const entries = [];
for (const file of (await files(root)).sort()) {
  const bytes = await readFile(file);
  entries.push({
    path: path.relative(root, file).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  path.join(root, 'release-manifest.json'),
  JSON.stringify({ schemaVersion: 1, project: 'tracekit', commit, files: entries }, null, 2) + '\n',
);
console.log(`Release manifest: ${entries.length} files, commit ${commit}`);
