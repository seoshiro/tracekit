import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const [baseArg, expectedCommit] = process.argv.slice(2);
if (!baseArg || !expectedCommit || !/^[a-f0-9]{40}$/.test(expectedCommit))
  throw new Error('Usage: node scripts/verify-release.mjs HTTPS_BASE_URL COMMIT_SHA');
const base = new URL(baseArg);
if (base.protocol !== 'https:') throw new Error('Release verification requires HTTPS.');
const response = await fetch(new URL('release-manifest.json', base), { cache: 'no-store' });
if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
const manifest = await response.json();
if (
  manifest.schemaVersion !== 1 ||
  manifest.project !== 'tracekit' ||
  manifest.commit !== expectedCommit
)
  throw new Error('Published commit does not match expected source.');
const local = JSON.parse(await readFile('dist/release-manifest.json', 'utf8'));
if (
  local.commit !== expectedCommit ||
  JSON.stringify(local.files) !== JSON.stringify(manifest.files)
)
  throw new Error('Published assets do not match the local build of the expected source commit.');
if (!Array.isArray(manifest.files) || manifest.files.length < 3 || manifest.files.length > 100)
  throw new Error('Invalid manifest file list.');
for (const entry of manifest.files) {
  if (
    typeof entry.path !== 'string' ||
    !/^[a-zA-Z0-9_./-]+$/.test(entry.path) ||
    entry.path.includes('..') ||
    entry.path.startsWith('/')
  )
    throw new Error('Unsafe manifest path.');
  const url = new URL(entry.path, base);
  if (!url.href.startsWith(base.href)) throw new Error('Asset escaped base path.');
  const file = await fetch(url, { cache: 'no-store' });
  if (!file.ok) throw new Error(`${entry.path}: HTTP ${file.status}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || hash !== entry.sha256)
    throw new Error(`Asset mismatch: ${entry.path}`);
  console.log(`SHA-256 OK ${entry.path} (${bytes.length} bytes)`);
}
console.log(
  `VERIFIED ${manifest.commit}: ${manifest.files.length} published assets match manifest.`,
);
