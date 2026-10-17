// 브라우저 검증: node privacy/tests/run-probes.mjs [시나리오...]
// 정적 서버를 띄우고 헤드리스 Edge로 /privacy/?probe=<시나리오> 를 열어 실제 화면 조작 결과를 수확한다.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './serve.mjs';

const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ALL = ['route-A', 'route-B-key', 'route-C', 'route-D', 'no-player', 'damaged-player', 'wrong-player', 'xss',
  'resume', 'blocked', 'corrupt-progress', 'stale-progress', 'wipe', 'restart-keeps', 'normal-speed'];
const list = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const server = await startServer(0);
const port = server.address().port;

function runEdge(url, profile, extra = []) {
  return new Promise((resolve) => {
    execFile(EDGE, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
      '--virtual-time-budget=60000', ...extra, '--dump-dom', url], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
    (err, stdout) => resolve(stdout || ''));
  });
}

let totalPass = 0, totalFail = 0;
for (const sc of list) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-probe-'));
  const dom = await runEdge(`http://127.0.0.1:${port}/privacy/?probe=${sc}`, profile);
  const m = dom.match(/<pre id="probe-out">([\s\S]*?)<\/pre>/);
  if (!m) { console.log(`✗ ${sc}: 결과 없음 (DOM ${dom.length}자)`); totalFail++; continue; }
  const txt = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const r = JSON.parse(txt);
  const errs = r.errors.length;
  totalPass += r.pass.length;
  totalFail += r.fail.length + errs;
  console.log(`${r.fail.length || errs ? '✗' : '✓'} ${sc}: 통과 ${r.pass.length} · 실패 ${r.fail.length} · 콘솔 오류 ${errs}`);
  r.fail.forEach((f) => console.log('    - ' + f));
  r.errors.forEach((f) => console.log('    ! ' + f));
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge가 잠시 잡고 있을 수 있음 */ }
}

// /privacy (끝 슬래시 없음) 직접 진입 → /privacy/ 로 이동되는지
const res = await fetch(`http://127.0.0.1:${port}/privacy`, { redirect: 'manual' });
const redirectOk = res.status === 301 && res.headers.get('location') === '/privacy/';
console.log(`${redirectOk ? '✓' : '✗'} /privacy → /privacy/ 이동 (${res.status} ${res.headers.get('location')})`);
if (!redirectOk) totalFail++;

server.close();
console.log(`\n합계: 통과 ${totalPass} · 실패/오류 ${totalFail}`);
process.exit(totalFail ? 1 : 0);
