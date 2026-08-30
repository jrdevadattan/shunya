import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const COMPLETE_REQUIREMENTS = [
  ['Windows Setup executable', (name) => /\.exe$/i.test(name)],
  ['Windows full NuGet package', (name) => /-full\.nupkg$/i.test(name)],
  ['Debian x64 package', (name) => /(?:amd64|x86_64).*\.deb$/i.test(name)],
  ['macOS x64 DMG', (name) => /x64/i.test(name) && /\.dmg$/i.test(name)],
  ['macOS x64 ZIP', (name) => /x64/i.test(name) && /\.zip$/i.test(name)],
  ['macOS arm64 DMG', (name) => /arm64/i.test(name) && /\.dmg$/i.test(name)],
  ['macOS arm64 ZIP', (name) => /arm64/i.test(name) && /\.zip$/i.test(name)],
  ['Rescue ISO', (name) => /recovery-rescue-.*x86_64\.iso$/i.test(name)],
  ['Rescue ISO checksum', (name) => /recovery-rescue-.*x86_64\.iso\.sha256$/i.test(name)],
  ['Rescue manifest', (name) => /recovery-rescue-.*x86_64\.manifest\.json$/i.test(name)],
  ['SHA256SUMS', (name) => name === 'SHA256SUMS'],
  ['release manifest', (name) => name === 'release-manifest.json'],
];
const WINDOWS_X64_REQUIREMENTS = COMPLETE_REQUIREMENTS.filter(([label]) => [
  'Windows Setup executable', 'Windows full NuGet package', 'SHA256SUMS', 'release manifest',
].includes(label));

export async function verifyReleaseSet(directory, options = {}) {
  const profile = options.profile ?? 'complete';
  const requirements = profile === 'complete'
    ? COMPLETE_REQUIREMENTS
    : profile === 'windows-x64'
      ? WINDOWS_X64_REQUIREMENTS
      : undefined;
  if (!requirements) throw new Error(`unknown release verification profile: ${profile}`);
  const entries = await readdir(directory);
  const names = [];
  for (const name of entries) {
    if ((await stat(path.join(directory, name))).isFile()) names.push(name);
  }

  const missing = requirements.filter(([, matches]) => !names.some(matches)).map(([label]) => label);
  if (missing.length > 0) throw new Error(`incomplete release set; missing: ${missing.join(', ')}`);

  const manifest = JSON.parse(await readFile(path.join(directory, 'release-manifest.json'), 'utf8'));
  const covered = new Set(manifest.files?.map((file) => file.name));
  const uncovered = names.filter((name) => name !== 'release-manifest.json' && !covered.has(name));
  if (uncovered.length > 0) throw new Error(`release manifest does not cover: ${uncovered.join(', ')}`);
  return names.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const profileIndex = args.indexOf('--profile');
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : 'complete';
  const directory = args.find((argument, index) => argument !== '--profile' && index !== profileIndex + 1);
  if (!directory || !profile) throw new Error('usage: node verify-release-set.mjs [--profile complete|windows-x64] <directory>');
  verifyReleaseSet(path.resolve(directory), { profile })
    .then((names) => console.log(`${profile} release set verified (${names.length} files).`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
