// PNG → webp 사본 만들기(윤리시티 privacy 전용). 원본 PNG는 그대로 두고 같은 자리에 .webp를 쓴다.
//   node privacy/tools/to-webp.mjs assets/school assets/outdoor ... [--q 0.82]
//   경로는 privacy/ 기준. 폴더면 그 안의 .png 전부(preview.png 제외), 파일이면 그 파일만.
// 그림 크기(픽셀)는 바꾸지 않는다 — 코드에 박힌 잘라내기 좌표가 그대로 맞도록.
// 끝나면 js/webp-list.js(게임이 .webp를 고를 목록)를 assets 아래 실제 .webp 파일로 다시 만든다.
// 헤드리스 Edge의 canvas.toBlob('image/webp')로 인코딩(설치 필요 없음). 로컬 서버로 열어 캔버스 보안 제한을 피한다.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tests/serve.mjs';

const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const qi = args.indexOf('--q');
const Q = qi >= 0 ? Number(args.splice(qi, 2)[1]) : 0.82;
const SKIP = /(^|[\\/])(preview|.*-preview)\.png$/;

const files = [];
for (const a of args) {
  const abs = path.join(PRIV, a);
  if (!fs.existsSync(abs)) { console.error('없음: ' + a); process.exitCode = 1; continue; }
  if (fs.statSync(abs).isDirectory()) {
    for (const n of fs.readdirSync(abs)) if (n.endsWith('.png') && !SKIP.test(n)) files.push(path.posix.join(a.replace(/\\/g, '/'), n));
  } else if (a.endsWith('.png')) files.push(a.replace(/\\/g, '/'));
}

function edge(url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-webp-'));
  return new Promise((resolve) => {
    execFile(EDGE, ['--headless', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--virtual-time-budget=60000', '--dump-dom', url],
      { maxBuffer: 512 * 1024 * 1024, timeout: 180000 }, (err, stdout) => {
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge가 잠시 잡고 있을 수 있음 */ }
        resolve(stdout || '');
      });
  });
}

const kb = (n) => Math.round(n / 1024).toLocaleString() + 'KB';
let before = 0, after = 0;
if (files.length) {
  const server = await startServer(0);
  const port = server.address().port;
  for (let i = 0; i < files.length; i += 6) { // 한 번에 6장씩(출력이 너무 커지지 않게)
    const batch = files.slice(i, i + 6);
    const url = `http://127.0.0.1:${port}/privacy/tools/webp-page.html?q=${Q}&` + batch.map((f) => 'f=' + encodeURIComponent(f)).join('&');
    const dom = await edge(url);
    const m = dom.match(/<pre id="webp-out">([\s\S]*?)<\/pre>/);
    if (!m) { console.error('✗ 결과 없음(빈 출력): ' + batch.join(', ')); process.exitCode = 1; continue; }
    for (const r of JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))) {
      if (r.error) { console.error('✗ ' + r.f + ': ' + r.error); process.exitCode = 1; continue; }
      const src = path.join(PRIV, r.f), dst = src.replace(/\.png$/, '.webp');
      const buf = Buffer.from(r.data, 'base64'), size = fs.statSync(src).size;
      if (buf.length >= size) { console.log(`- ${r.f}: webp가 더 커서 건너뜀(${kb(size)} → ${kb(buf.length)})`); if (fs.existsSync(dst)) fs.rmSync(dst); continue; }
      fs.writeFileSync(dst, buf);
      before += size; after += buf.length;
      console.log(`✓ ${r.f} ${r.w}×${r.h}: ${kb(size)} → ${kb(buf.length)}`);
    }
  }
  server.close();
}

// 게임이 .webp를 고를 목록: assets 아래 .png 옆에 .webp가 있는 것
const list = [];
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.webp') && fs.existsSync(p.replace(/\.webp$/, '.png'))) list.push(path.relative(PRIV, p).replace(/\\/g, '/').replace(/\.webp$/, '.png'));
  }
})(path.join(PRIV, 'assets'));
list.sort();
fs.writeFileSync(path.join(PRIV, 'js', 'webp-list.js'),
  '/* tools/to-webp.mjs가 만든 목록 — 손으로 고치지 말 것. 여기 있는 .png는 같은 자리의 .webp를 먼저 쓴다 */\n' +
  'window.PRIVACY_WEBP = ' + JSON.stringify(Object.fromEntries(list.map((k) => [k, 1])), null, 1) + ';\n');
if (files.length) console.log(`\n합계: ${kb(before)} → ${kb(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% 감소) · 목록 ${list.length}장`);
else console.log('목록만 다시 만듦: ' + list.length + '장');
