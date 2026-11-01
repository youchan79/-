import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Mic, Pause, Play, Square, Upload } from 'lucide-react';
import { formatDuration, type DocDetail } from '../../lib/api.ts';
import { useApp } from '../../lib/app.tsx';
import { AUDIO_ACCEPT, uploadFiles } from '../../lib/upload.ts';
import { useApiErrorHandler } from '../../components/Modals.tsx';
import { Button } from '../../components/ui.tsx';
import { UploadProgress } from '../AddContent.tsx';

type State = 'idle' | 'recording' | 'paused';

const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

/**
 * 강의 녹음 문서(status = recording) 안에서 녹음한다.
 * 위: 녹음 카드(시작·일시정지·종료), 아래: 실시간 자막. 끝내면 녹음 파일과 자막을 문서에 붙이고 정리를 시작한다.
 */
export function Recorder({ doc, onDone }: { doc: DocDetail; onDone: () => void }) {
  const { showToast, config } = useApp();
  const onError = useApiErrorHandler();
  const audioFileOk = !!config?.media.audioFile || config?.aiMode === 'mock';
  const [state, setState] = useState<State>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(36).fill(0.08));
  const [finalText, setFinalText] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
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

  const stopAll = () => {
    cancelAnimationFrame(raf.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    try {
      speech.current?.stop();
    } catch {
      /* 무시 */
    }
  };
  useEffect(() => stopAll, []);

  // 녹음 중에 창을 닫거나 새로 고치면 녹음이 사라지니 한 번 묻는다
  useEffect(() => {
    if (state === 'idle') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

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

  const send = async (file: File, extra: Record<string, string>) => {
    setProgress(0);
    try {
      await uploadFiles([file], extra, setProgress, `/api/docs/${doc.id}/recording`);
      onDone();
    } catch (e) {
      onError(e);
    } finally {
      setProgress(null);
    }
  };

  const finish = async () => {
    const mr = rec.current;
    if (!mr) return;
    if (!audioFileOk && !transcriptRef.current.length) {
      showToast('아직 받아 적은 자막이 없어요. 조금 더 녹음한 뒤 끝내 주세요.');
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
    stopAll();
    const type = mr.mimeType || 'audio/webm';
    const ext = type.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([new Blob(chunks.current, { type })], `강의 녹음.${ext}`, { type });
    await send(file, { duration: String(elapsedRef.current), transcript: transcriptRef.current.join('\n') });
  };

  const live = state !== 'idle';

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 md:p-4">
      <div className="rounded-2xl border border-line bg-soft px-5 py-6 text-center md:py-8">
        {live ? (
          <>
            <div className="flex items-center justify-between text-[15px]">
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${state === 'recording' ? 'animate-pulse bg-red' : 'bg-muted/50'}`} />
                {state === 'recording' ? '녹음 중' : '잠시 멈춤'}
              </span>
              <span className="tabular-nums text-sub">{formatDuration(elapsed)}</span>
            </div>
            <div className="mt-4 flex h-12 items-end gap-[4px]">
              {levels.map((l, i) => (
                <span key={i} className="flex-1 rounded-sm bg-wave transition-[height]" style={{ height: `${Math.round(l * 100)}%` }} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {state === 'recording' ? (
                <Button variant="outline" onClick={pause}>
                  <Pause size={17} /> 잠시 멈춤
                </Button>
              ) : (
                <Button variant="outline" onClick={resume}>
                  <Play size={17} /> 이어서 녹음
                </Button>
              )}
              <Button onClick={() => void finish()}>
                <Square size={15} fill="currentColor" /> 끝내고 정리하기
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-soft-2">
              <Mic size={24} />
            </span>
            <div className="mt-3 text-[17px] font-semibold">강의 녹음</div>
            <p className="mt-1 text-[15px] text-sub">
              {SpeechRecognitionCtor ? '녹음을 켜면 교수님 말씀이 바로 글자로 적혀요' : audioFileOk ? '녹음이 끝나면 AI가 받아 적어요 (Chrome 권장)' : 'Chrome이나 삼성 인터넷에서 녹음하면 실시간으로 받아 적어요'}
            </p>
            <Button className="mt-4" onClick={() => void start()}>
              <Mic size={17} /> 녹음 시작
            </Button>
            {audioFileOk && (
              <div className="mt-3">
                <button type="button" className="inline-flex items-center gap-1.5 text-[14px] text-sub underline-offset-4 hover:text-ink hover:underline" onClick={() => fileInput.current?.click()}>
                  <Upload size={15} /> 녹음 파일로 올리기
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 min-h-[180px] flex-1">
        {finalText.length === 0 && !interim ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sub">
              <AudioLines size={20} />
            </span>
            <div className="mt-3 text-[17px] font-medium">받아 적은 내용이 아직 없어요</div>
            <p className="mt-1 text-[15px] text-muted">{live ? '말소리가 들리면 여기에 차례로 쌓여요.' : '녹음을 시작하면 여기에 차례로 쌓여요.'}</p>
          </div>
        ) : (
          <div className="space-y-2 px-2 py-3 text-[16px] leading-[1.75]">
            {finalText.map((t, i) => (
              <p key={i} className="text-sub">
                {t}
              </p>
            ))}
            {interim && <p className="text-ink">{interim}</p>}
          </div>
        )}
      </div>
      <p className="pb-1 pt-3 text-center text-[13px] text-muted">강의 녹음은 무료 플랜에서도 횟수 제한 없이 쓸 수 있어요.</p>

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
          await send(f, { duration: String(duration) });
        }}
      />
      <UploadProgress progress={progress} label={progress !== null && progress >= 1 ? 'AI가 녹음을 정리하기 시작했어요' : '녹음을 올리는 중'} />
    </div>
  );
}
