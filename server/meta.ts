import crypto from 'node:crypto';
import type { Request } from 'express';
import { config } from './config.ts';
import { parseCookies } from './auth.ts';

const sha256 = (v: string) => crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

/**
 * 메타 전환 API(서버 이벤트). 브라우저 픽셀과 같은 event_id를 보내 중복 집계를 막는다.
 * req가 없으면(월간 자동 결제처럼 사용자 없이 일어난 결제) action_source를 system_generated로 보낸다.
 * META_CAPI_TOKEN이 없으면 아무것도 하지 않는다.
 */
export async function sendServerEvent(
  req: Request | null,
  p: { eventName: 'Purchase' | 'CompleteRegistration'; eventId: string; email: string; value?: number; sourceUrl?: string; userId?: string },
) {
  const { pixelId, capiToken, testEventCode, graphVersion } = config.meta;
  if (!pixelId || !capiToken) return;
  const cookies: Record<string, string> = req ? parseCookies(req) : {};
  const ip = req ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress : undefined;
  const externalId = p.userId ?? req?.user?.id ?? req?.anonId;
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: p.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: p.eventId,
        action_source: req ? 'website' : 'system_generated',
        event_source_url: req ? p.sourceUrl || (config.appUrl ? config.appUrl + '/' : undefined) : undefined,
        user_data: {
          em: [sha256(p.email)],
          client_ip_address: ip,
          client_user_agent: req?.headers['user-agent'],
          fbp: cookies._fbp,
          fbc: cookies._fbc,
          external_id: externalId ? [sha256(externalId)] : undefined,
        },
        custom_data: p.value !== undefined ? { currency: 'KRW', value: p.value } : undefined,
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;
  try {
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(capiToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('[meta] 전환 API 실패', res.status, await res.text());
  } catch (e) {
    console.error('[meta] 전환 API 오류', e);
  }
}
