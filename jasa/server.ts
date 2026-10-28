import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { api } from './server/api.ts';
import { config } from './server/config.ts';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use('/api', api);

if (process.env.NODE_ENV === 'production') {
  // 빌드 결과: dist-server/server.js 옆의 ../dist 에 화면 파일이 있음
  const dist = path.resolve(import.meta.dirname, '..', 'dist');
  app.use(express.static(dist, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(config.port, () => {
  console.log(`자사 실행 중 → http://localhost:${config.port}`);
  if (!config.geminiApiKey) console.warn('⚠ GEMINI_API_KEY가 없어서 AI 기능이 꺼져 있어요. .env 파일을 확인하세요.');
  if (!config.supabase) console.log('ℹ Supabase 설정이 없어 로컬 모드(로그인 없음)로 실행합니다.');
});
