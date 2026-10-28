/** 자소서 글자 수: 공백 포함 / 제외 (이모지·한글 모두 한 글자) */
export function countChars(text: string) {
  const withSpaces = [...text.replace(/\r\n/g, '\n')].length;
  const withoutSpaces = [...text.replace(/\s/g, '')].length;
  return { withSpaces, withoutSpaces };
}

export function uid() {
  return crypto.randomUUID();
}

export function formatDate(ms: number) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ms);
}

export function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 파일을 서버로 보낼 base64 문자열로 읽음 */
export function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
