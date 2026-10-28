// logos/ 폴더의 이미지 파일 이름(= 회사 이름)으로 logos/logos.js 대응표를 만듭니다.
// 사용법: networking-day 폴더에서 `node tools/build-logos.mjs`
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'logos');
const files = fs.readdirSync(dir)
  .filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'ko'));
const lines = files.map((f) => `  ${JSON.stringify(f.replace(/\.[^.]+$/, '').normalize('NFC'))}: ${JSON.stringify('logos/' + f)},`);
const head = fs.readFileSync(path.join(dir, 'logos.js'), 'utf8').split('window.ND_LOGOS')[0];
fs.writeFileSync(path.join(dir, 'logos.js'), head + 'window.ND_LOGOS = {\n' + lines.join('\n') + (lines.length ? '\n' : '') + '};\n');
console.log(`logos.js: 회사 ${files.length}곳`);
