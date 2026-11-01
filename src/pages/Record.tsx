import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, Upload } from 'lucide-react';
import { formatDuration } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { AUDIO_ACCEPT } from '../lib/upload.ts';
import { AppShell } from '../components/AppShell.tsx';
import { Button } from '../components/ui.tsx';
import { UploadProgress, useUploader } from './AddContent.tsx';

type State = 'idle' | 'recording' | 'paused';

const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export default function Record() {
  const { showToast, config } = useApp();
  const audioFileOk = !!config?.media.audioFile || config?.aiMode === 'mock';
  const { progress, run } = useUploader();
  const [state, setState] = useState<State>('idle');
  const [title, setTitle] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(36).fill(0.08));
  const [finalText, setFinalText] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const speech = useRef<any>(null);
  const raf = useRef<number>(0);
  const timer = useRef<number>(0);
  const stateRef = useRef<State>('idle');
  const transcriptRef = useRef<string[]>([]);
  const elapsedRef = useRef(0);
  stateRef.current = state;

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      try {
        speech.current?.stop();
      } catch {
        /* 무시 */
      }
    },
    [],
  );

  const startSpeech = () => {
    if (!SpeechRecognitionCtor) return;
    const sr = new SpeechRecognitionCtor();
    sr.lang = 'ko-KR';
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e: any) => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const stamp = `[${formatDuration(elapsedRef.current).padStart(5, '0')}]`;
          transcriptRef.current = [...transcriptRef.current, `${stamp} ${r[0].transcript.trim()}`];
          setFinalText(transcriptRef.current);
        } else tmp += r[0].transcript;
      }
      setInterim(tmp);
    };
    sr.onend = () => {
      if (stateRef.current === 'recording') {
        try {
          sr.start();
        } catch {
          /* 이미 시작됨 */
        }
      }
    };
    try {
      sr.start();
      speech.current = sr;
    } catch {
      /* 무시 */
    }
  };

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const mr = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.start(1000);
      rec.current = mr;

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const loop = (t: number) => {
        raf.current = requestAnimationFrame(loop);
        if (t - last < 110) return;
        last = t;
        analyser.getByteFrequencyData(data);
        const avg = data.slice(2, 60).reduce((a, b) => a + b, 0) / 58 / 255;
        setLevels((l) => [...l.slice(1), stateRef.current === 'recording' ? Math.max(0.08, Math.min(1, avg * 2.2)) : 0.08]);
      };
      raf.current = requestAnimationFrame(loop);

      timer.current = window.setInterval(() => {
        if (stateRef.current === 'recording') {
          elapsedRef.current += 1;
          setElapsed(elapsedRef.current);
        }
      }, 1000);
      setState('recording');
      startSpeech();
    } catch {
      showToast('마이크를 쓸 수 없어요. 브라우저 설정에서 마이크 권한을 허용해 주세요.');
    }
  };

  const pause = () => {
    rec.current?.pause();
    try {
      speech.current?.stop();
    } catch {
      /* 무시 */
    }
    setState('paused');
  };

  const resume = () => {
    rec.current?.resume();
    setState('recording');
    stateRef.current = 'recording';
    startSpeech();
  };

  const finish = async () => {
    const mr = rec.current;
    if (!mr) return;
    if (!audioFileOk && !transcriptRef.current.length) {
      showToast('아직 받아 적은 자막이 없어요. 조금 더 녹음한 뒤 종료해 주세요.');
      return;
    }
    setState('idle');
    stateRef.current = 'idle';
    try {
      speech.current?.stop();
    } catch {
      /* 무시 */
    }
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
    });
    cancelAnimationFrame(raf.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    const type = mr.mimeType || 'audio/webm';
    const ext = type.includes('mp4') ? 'm4a' : 'webm';
    const blob = new Blob(chunks.current, { type });
    const file = new File([blob], `${title.trim() || '강의 녹음'}.${ext}`, { type });
    await run([file], { title: title.trim(), duration: String(elapsedRef.current), transcript: transcriptRef.current.join('\n') });
  };

  return (
    <AppShell title="강의 녹음">
      <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-8 pt-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="수업 이름 (예: 일반생물학 4주차)"
          className="w-full bg-transparent text-[24px] font-semibold tracking-tight outline-none placeholder:text-muted/70"
        />

        <div className="mt-6 rounded-[24px] border border-line p-5 md:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px]">
              <span className={`h-2.5 w-2.5 rounded-full ${state === 'recording' ? 'animate-pulse bg-red' : 'bg-muted/50'}`} />
              {state === 'recording' ? '녹음 중' : state === 'paused' ? '일시정지' : '녹음 대기'}
            </div>
            <div className="text-[15px] tabular-nums text-muted">{formatDuration(elapsed)}</div>
          </div>
          <div className="mt-5 flex h-14 items-end gap-[5px]">
            {levels.map((l, i) => (
              <span key={i} className="flex-1 rounded-sm bg-wave transition-[height]" style={{ height: `${Math.round(l * 100)}%`, opacity: state === 'idle' ? 0.35 : 1 }} />
            ))}
          </div>

          <div className="mt-6 h-[220px] overflow-y-auto rounded-2xl bg-soft p-4 text-[15px] leading-[1.75]">
            {finalText.length === 0 && !interim ? (
              <p className="text-muted">
                {SpeechRecognitionCtor
                  ? '녹음을 시작하면 실시간 자막이 여기에 쌓여요. 이 자막으로 요약과 퀴즈를 만들어요.'
                  : audioFileOk
                    ? '이 브라우저는 실시간 자막을 지원하지 않아요. 녹음이 끝나면 AI가 받아 적어요. (Chrome 권장)'
                    : '이 브라우저는 실시간 자막을 지원하지 않아요. Chrome이나 삼성 인터넷에서 녹음해 주세요.'}
              </p>
            ) : (
              <>
                {finalText.map((t, i) => (
                  <p key={i} className="text-sub">
                    {t}
                  </p>
                ))}
                {interim && <p className="text-ink">{interim}</p>}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {state === 'idle' && (
              <Button size="lg" onClick={() => void start()}>
                <Mic size={18} /> 녹음 시작
              </Button>
            )}
            {state === 'recording' && (
              <Button size="lg" variant="outline" onClick={pause}>
                <Pause size={18} /> 일시정지
              </Button>
            )}
            {state === 'paused' && (
              <Button size="lg" variant="outline" onClick={resume}>
                <Play size={18} /> 이어서 녹음
              </Button>
            )}
            {state !== 'idle' && (
              <Button size="lg" onClick={() => void finish()}>
                <Square size={16} fill="currentColor" /> 종료하고 정리하기
              </Button>
            )}
          </div>
        </div>

        {audioFileOk && (
        <div className="mt-6 flex items-center justify-center gap-2 text-[14px] text-muted">
          이미 녹음한 파일이 있나요?
          <button type="button" className="inline-flex items-center gap-1 font-medium text-ink underline-offset-2 hover:underline" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> 녹음 파일 올리기
          </button>
        </div>
        )}
        <p className="mt-2 text-center text-[13px] text-muted">강의 녹음은 무료 플랜에서도 횟수 제한 없이 쓸 수 있어요.</p>
        <input
          ref={fileInput}
          type="file"
          accept={AUDIO_ACCEPT}
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const duration = await new Promise<number>((resolve) => {
              const a = new Audio();
              a.preload = 'metadata';
              a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
              a.onerror = () => resolve(0);
              a.src = URL.createObjectURL(f);
            });
            void run([f], { title: title.trim(), duration: String(duration) });
          }}
        />
        <UploadProgress progress={progress} />
      </div>
    </AppShell>
  );
}
