import { spawnSync } from 'node:child_process';

const allowedAdvisories = new Set([
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (!result.stdout?.trim()) {
  console.error(result.stderr || 'npm audit returned no JSON output');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error('Unable to parse npm audit JSON:', error);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};

function leafAdvisories(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return [];

  const leaves = [];
  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      leaves.push(...leafAdvisories(via, seen));
    } else if (via && typeof via === 'object') {
      leaves.push(via);
    }
  }
  return leaves;
}

const blocking = [];
const accepted = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;

  const leaves = leafAdvisories(name);
  if (!leaves.length) {
    blocking.push({ name, reason: 'high/critical vulnerability has no resolvable advisory leaf' });
    continue;
  }

  const unknownLeaves = leaves.filter((leaf) => !allowedAdvisories.has(leaf.url));
  if (unknownLeaves.length) {
    blocking.push({
      name,
      reason: unknownLeaves.map((leaf) => `${leaf.title ?? 'unknown advisory'} (${leaf.url ?? 'no URL'})`).join('; '),
    });
  } else {
    accepted.push(name);
  }
}

if (blocking.length) {
  console.error('Blocking high/critical production dependency advisories detected:');
  for (const item of blocking) console.error(`- ${item.name}: ${item.reason}`);
  process.exit(1);
}

if (accepted.length) {
  console.warn('Known temporary build-tool advisory exception detected. See SECURITY_EXCEPTIONS.md.');
  console.warn(`Affected dependency graph nodes: ${[...new Set(accepted)].sort().join(', ')}`);
}

console.log('Production dependency audit guard passed: no unapproved high/critical advisory detected.');
