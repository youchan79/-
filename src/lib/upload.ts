import { ApiError } from './api.ts';
import { imageThumbnail, pdfThumbnail } from './pdf.ts';

/** 파일을 올리고 새 문서 ID를 돌려준다. 진행률을 콜백으로 알린다. */
export async function uploadFiles(
  files: File[],
  extra: Record<string, string> = {},
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f, f.name);
  const first = files[0];
  if (!extra.thumb) {
    const thumb = first.type === 'application/pdf' || first.name.toLowerCase().endsWith('.pdf') ? await pdfThumbnail(first) : first.type.startsWith('image/') ? await imageThumbnail(first) : null;
    if (thumb) fd.append('thumb', thumb);
  }
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/docs/upload');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let json: any = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* 무시 */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json.id);
      else reject(new ApiError(json.error || '업로드에 실패했어요.', xhr.status, json.reason));
    };
    xhr.onerror = () => reject(new ApiError('네트워크 오류로 업로드하지 못했어요.', 0));
    xhr.send(fd);
  });
}

export const DOC_ACCEPT = '.pdf,.pptx,.docx,application/pdf';
export const IMAGE_ACCEPT = 'image/*';
export const AUDIO_ACCEPT = 'audio/*,.m4a,.mp3,.wav,.webm';
