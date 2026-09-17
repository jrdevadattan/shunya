// Spawns the real recovery daemon and runs the full recovery flow on the demo
// image, proving the demo works end-to-end (carving + validation + hashing +
// real YARA-X threat detection + report) before the presentation.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const daemon = path.join(repo, 'target/release/recoveryd.exe');
const image = path.join(repo, 'SIH_DEMO_KIT/assets/demo_evidence.raw');
if (!existsSync(daemon)) { console.error('daemon missing:', daemon); process.exit(1); }
if (!existsSync(image)) { console.error('image missing:', image); process.exit(1); }

const workspace = mkdtempSync(path.join(tmpdir(), 'shunya-demo-verify-'));
const child = spawn(daemon, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
const waiters = new Map();
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  for (;;) {
    const nl = buffer.indexOf('\n');
    if (nl < 0) break;
    const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let frame; try { frame = JSON.parse(line); } catch { continue; }
    if (frame.id && waiters.has(frame.id)) { waiters.get(frame.id)(frame); waiters.delete(frame.id); }
  }
});
function rpc(method, params = {}) {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    waiters.set(id, (f) => (f.kind === 'response' ? resolve(f.result) : reject(new Error(`${f.error?.code}: ${f.error?.message}`))));
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const kase = await rpc('case.create', { title: 'SIH Demo Case', operator: 'Demo Operator', referenceNumber: 'SIH-26149-DEMO', organization: 'Team SHUNYA', workspacePath: workspace, notes: 'demo verification' });
  const source = await rpc('source.add_image', { path: image });
  const assess = await rpc('source.assess', { sourceId: source.sourceId });
  console.log('Source assessment:', assess.decision);
  const job = await rpc('job.create', { caseId: kase.caseId, sourceId: source.sourceId, goal: 'recover_everything', preset: 'full' });
  await rpc('job.start', { jobId: job.jobId });
  let status;
  for (let i = 0; i < 120; i++) { status = await rpc('job.status', { jobId: job.jobId }); if (['completed', 'needs_attention', 'failed', 'cancelled'].includes(status.stage)) break; await sleep(500); }
  console.log('Final job stage:', status.stage);
  const page = await rpc('artifact.query', { pageSize: 50 });
  console.log(`\nRecovered ${page.items.length} artifacts:`);
  for (const a of page.items) console.log(`  - ${a.displayName}  ${a.sizeBytes}B  ${a.recoveryState}  threat=${a.threatStatus}  sha256=${(a.sha256 || '').slice(0, 16)}…`);
  const threats = page.items.filter((a) => a.threatStatus === 'potential_threat');
  console.log(`\nYARA-X flagged ${threats.length} artifact(s) as a potential threat: ${threats.map((t) => t.displayName).join(', ') || '(none)'}`);
  const report = await rpc('report.generate', { caseId: kase.caseId });
  console.log('Report written:', report.jsonPath);
  console.log('\nRESULT: ' + (page.items.length >= 6 && threats.length >= 1 ? 'PASS ✅  (files recovered + threat flagged)' : 'REVIEW ⚠️'));
} catch (error) {
  console.error('VERIFY ERROR:', error.message);
  process.exitCode = 1;
} finally {
  child.kill();
}
