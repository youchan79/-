import { Solar, Lunar, LunarYear } from 'lunar-javascript';

export type Element = '목' | '화' | '토' | '금' | '수';
export const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];

const GAN_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const ZHI_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
const GAN_ELEMENT: Record<string, Element> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};
const ZHI_ELEMENT: Record<string, Element> = {
  寅: '목', 卯: '목', 巳: '화', 午: '화', 辰: '토', 戌: '토', 丑: '토', 未: '토', 申: '금', 酉: '금', 亥: '수', 子: '수',
};
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);
const YANG_ZHI = new Set(['子', '寅', '辰', '午', '申', '戌']);
const ZODIAC: Record<string, string> = {
  子: '쥐', 丑: '소', 寅: '호랑이', 卯: '토끼', 辰: '용', 巳: '뱀', 午: '말', 未: '양', 申: '원숭이', 酉: '닭', 戌: '개', 亥: '돼지',
};
const TEN_GOD_KO: Record<string, string> = {
  比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재',
  七杀: '편관', 正官: '정관', 偏印: '편인', 正印: '정인',
};

const ganjiKo = (gz: string) => (gz ? `${GAN_KO[gz[0]] ?? ''}${ZHI_KO[gz[1]] ?? ''}` : '');

export interface BirthInput {
  name: string;
  gender: 'M' | 'F';
  calendar: 'solar' | 'lunar';
  leap: boolean;
  date: string; // YYYY-MM-DD (입력한 달력 기준)
  time: string | null; // HH:MM, 모르면 null
}

export interface Pillar {
  key: 'time' | 'day' | 'month' | 'year';
  label: string;
  gan: string;
  zhi: string;
  ganKo: string;
  zhiKo: string;
  ganElement: Element;
  zhiElement: Element;
  ganYang: boolean;
  zhiYang: boolean;
  ganTenGod: string;
  zhiTenGod: string;
}

export interface DaYun {
  ganzhi: string;
  ganzhiKo: string;
  startAge: number;
  startYear: number;
}

export interface Chart {
  solarDate: string;
  lunarDate: string;
  timeKnown: boolean;
  zodiac: string;
  age: number;
  pillars: Pillar[];
  elementCounts: Record<Element, number>;
  dayMaster: { gan: string; ko: string; element: Element; yang: boolean };
  daYun: DaYun[];
  currentDaYun: DaYun | null;
}

/**
 * 한국 표준시(동경 135도)와 서울 실제 태양시 차이(약 30분)를 보정한다.
 * 1954-03-21 ~ 1961-08-09에는 표준시가 동경 127.5도였으므로 보정하지 않는다.
 * 1987, 1988년 서머타임 기간은 1시간을 추가로 뺀다.
 */
function correctionMinutes(y: number, m: number, d: number, h: number, mi: number): number {
  const t = Date.UTC(y, m - 1, d, h, mi);
  const between = (a: number[], b: number[]) => t >= Date.UTC(a[0], a[1] - 1, a[2], a[3] ?? 0) && t < Date.UTC(b[0], b[1] - 1, b[2], b[3] ?? 0);
  let minutes = -30;
  if (between([1954, 3, 21], [1961, 8, 10])) minutes = 0;
  if (between([1987, 5, 10, 2], [1987, 10, 11, 3]) || between([1988, 5, 8, 2], [1988, 10, 9, 3])) minutes -= 60;
  return minutes;
}

export class BirthInputError extends Error {}

export function validateBirthInput(body: any): BirthInput {
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 20) : '';
  const gender = body?.gender === 'F' ? 'F' : body?.gender === 'M' ? 'M' : null;
  const calendar = body?.calendar === 'lunar' ? 'lunar' : 'solar';
  const leap = calendar === 'lunar' && body?.leap === true;
  const date = typeof body?.date === 'string' ? body.date : '';
  const time = typeof body?.time === 'string' && body.time ? body.time : null;
  if (!gender) throw new BirthInputError('성별을 선택해 주세요.');
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dm) throw new BirthInputError('생년월일 8자리를 입력해 주세요.');
  const y = Number(dm[1]);
  const thisYear = new Date().getFullYear();
  if (y < 1920 || y > thisYear) throw new BirthInputError('생년월일을 다시 확인해 주세요.');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BirthInputError('태어난 시간을 다시 확인해 주세요.');
  return { name: name || '나', gender, calendar, leap, date, time };
}

export function computeChart(input: BirthInput): Chart {
  const [y, m, d] = input.date.split('-').map(Number);
  const [hh, mm] = input.time ? input.time.split(':').map(Number) : [12, 0];

  // 1) 입력 달력 → 양력 날짜
  let solarY: number, solarM: number, solarD: number;
  if (input.calendar === 'lunar') {
    if (input.leap) {
      const leapMonth = LunarYear.fromYear(y).getLeapMonth();
      if (leapMonth !== m) throw new BirthInputError(`${y}년에는 윤${m}월이 없습니다.`);
    }
    let lunar;
    try {
      lunar = Lunar.fromYmd(y, input.leap ? -m : m, d);
    } catch {
      throw new BirthInputError('음력 날짜를 다시 확인해 주세요.');
    }
    const s = lunar.getSolar();
    solarY = s.getYear();
    solarM = s.getMonth();
    solarD = s.getDay();
  } else {
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      throw new BirthInputError('없는 날짜입니다. 생년월일을 다시 확인해 주세요.');
    }
    solarY = y;
    solarM = m;
    solarD = d;
  }

  // 2) 태양시 보정 (시간을 알 때만)
  let cy = solarY, cm = solarM, cd = solarD, ch = hh, cmi = mm;
  if (input.time) {
    const shifted = new Date(Date.UTC(solarY, solarM - 1, solarD, hh, mm) + correctionMinutes(solarY, solarM, solarD, hh, mm) * 60_000);
    cy = shifted.getUTCFullYear();
    cm = shifted.getUTCMonth() + 1;
    cd = shifted.getUTCDate();
    ch = shifted.getUTCHours();
    cmi = shifted.getUTCMinutes();
  }

  const solar = Solar.fromYmdHms(cy, cm, cd, ch, cmi, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  ec.setSect(1); // 23시(보정 후) 이후는 다음 날 일주

  const raw: Array<{ key: Pillar['key']; label: string; gan: string; zhi: string; tgGan: string; tgZhi: string[] }> = [
    { key: 'time', label: '시주', gan: ec.getTimeGan(), zhi: ec.getTimeZhi(), tgGan: ec.getTimeShiShenGan(), tgZhi: ec.getTimeShiShenZhi() },
    { key: 'day', label: '일주', gan: ec.getDayGan(), zhi: ec.getDayZhi(), tgGan: '', tgZhi: ec.getDayShiShenZhi() },
    { key: 'month', label: '월주', gan: ec.getMonthGan(), zhi: ec.getMonthZhi(), tgGan: ec.getMonthShiShenGan(), tgZhi: ec.getMonthShiShenZhi() },
    { key: 'year', label: '년주', gan: ec.getYearGan(), zhi: ec.getYearZhi(), tgGan: ec.getYearShiShenGan(), tgZhi: ec.getYearShiShenZhi() },
  ];

  const pillars: Pillar[] = raw
    .filter((p) => input.time || p.key !== 'time')
    .map((p) => ({
      key: p.key,
      label: p.label,
      gan: p.gan,
      zhi: p.zhi,
      ganKo: GAN_KO[p.gan],
      zhiKo: ZHI_KO[p.zhi],
      ganElement: GAN_ELEMENT[p.gan],
      zhiElement: ZHI_ELEMENT[p.zhi],
      ganYang: YANG_GAN.has(p.gan),
      zhiYang: YANG_ZHI.has(p.zhi),
      ganTenGod: p.key === 'day' ? '본인' : TEN_GOD_KO[p.tgGan] ?? p.tgGan,
      zhiTenGod: TEN_GOD_KO[p.tgZhi?.[0]] ?? '',
    }));

  const elementCounts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } as Record<Element, number>;
  for (const p of pillars) {
    elementCounts[p.ganElement]++;
    elementCounts[p.zhiElement]++;
  }

  const dayGan = ec.getDayGan();
  const now = new Date();
  let age = now.getFullYear() - solarY;
  if (now.getMonth() + 1 < solarM || (now.getMonth() + 1 === solarM && now.getDate() < solarD)) age--;

  const yun = ec.getYun(input.gender === 'M' ? 1 : 0);
  const daYun: DaYun[] = yun
    .getDaYun(10)
    .slice(1)
    .map((dy: any) => ({
      ganzhi: dy.getGanZhi(),
      ganzhiKo: ganjiKo(dy.getGanZhi()),
      startAge: dy.getStartAge(),
      startYear: dy.getStartYear(),
    }));
  const thisYear = now.getFullYear();
  const currentDaYun = [...daYun].reverse().find((dy) => dy.startYear <= thisYear) ?? null;

  const birthLunar = input.calendar === 'lunar' ? null : Solar.fromYmd(solarY, solarM, solarD).getLunar();
  const lunarDate =
    input.calendar === 'lunar'
      ? `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}${input.leap ? ' (윤달)' : ''}`
      : `${birthLunar.getYear()}.${String(Math.abs(birthLunar.getMonth())).padStart(2, '0')}.${String(birthLunar.getDay()).padStart(2, '0')}${birthLunar.getMonth() < 0 ? ' (윤달)' : ''}`;

  return {
    solarDate: `${solarY}.${String(solarM).padStart(2, '0')}.${String(solarD).padStart(2, '0')}`,
    lunarDate,
    timeKnown: !!input.time,
    zodiac: ZODIAC[ec.getYearZhi()],
    age,
    pillars,
    elementCounts,
    dayMaster: { gan: dayGan, ko: GAN_KO[dayGan], element: GAN_ELEMENT[dayGan], yang: YANG_GAN.has(dayGan) },
    daYun,
    currentDaYun,
  };
}

/* ---------- 무료 미리보기 문구 (규칙 기반, AI 비용 없음) ---------- */

export const DAY_MASTER_TEXT: Record<string, { title: string; summary: string; keywords: string[] }> = {
  甲: {
    title: '곧게 자라는 큰 나무',
    summary:
      '한번 정한 방향으로 꾸준히 뻗어 나가는 사람입니다. 앞에 서서 길을 내는 일이 자연스럽고, 주변에서도 기대는 사람이 많습니다. 다만 꺾이지 않으려는 마음이 강해서 고집으로 보일 때가 있습니다.',
    keywords: ['추진력', '책임감', '자존심'],
  },
  乙: {
    title: '어디서든 뿌리내리는 풀과 덩굴',
    summary:
      '부드러워 보이지만 쉽게 꺾이지 않는 사람입니다. 상황을 읽고 맞춰 가는 힘이 좋아서 사람 사이에서 기회를 잘 잡습니다. 겉으로 드러내지 않는 끈기가 가장 큰 무기입니다.',
    keywords: ['적응력', '끈기', '섬세함'],
  },
  丙: {
    title: '모두를 비추는 태양',
    summary:
      '있는 그대로 드러내고 표현하는 사람입니다. 밝은 에너지로 분위기를 바꾸고, 숨기는 것을 싫어해 솔직하다는 말을 많이 듣습니다. 금방 뜨거워지는 만큼 식는 속도도 빠를 수 있습니다.',
    keywords: ['열정', '표현력', '솔직함'],
  },
  丁: {
    title: '어둠을 밝히는 등불',
    summary:
      '가까운 사람을 오래 따뜻하게 챙기는 사람입니다. 한 가지에 깊이 몰입하는 집중력이 있고, 겉은 차분해도 속에는 뜨거운 열정을 품고 있습니다. 감정을 안으로 삭이다 지칠 때가 있습니다.',
    keywords: ['배려', '집중력', '내면의 열정'],
  },
  戊: {
    title: '흔들리지 않는 큰 산',
    summary:
      '말보다 존재감으로 믿음을 주는 사람입니다. 웬만한 일에는 동요하지 않고 넓게 품어 주어 사람들이 모여듭니다. 한번 자리 잡으면 잘 움직이지 않아 변화가 필요한 시기에 늦어질 수 있습니다.',
    keywords: ['신뢰', '포용력', '묵직함'],
  },
  己: {
    title: '곡식을 키우는 기름진 땅',
    summary:
      '실속을 챙기면서도 주변을 돌보는 사람입니다. 현실 감각이 좋아 계획을 구체적으로 만들고 끝까지 챙깁니다. 신경 쓸 것이 많아 걱정을 사서 하는 편입니다.',
    keywords: ['실속', '꼼꼼함', '돌봄'],
  },
  庚: {
    title: '단단한 바위와 원석',
    summary:
      '옳다고 생각하면 바로 결단하는 사람입니다. 의리가 강하고 맺고 끊음이 분명해 위기에 강합니다. 말이 직설적이라 의도와 다르게 상대가 상처받을 수 있습니다.',
    keywords: ['결단력', '의리', '원칙'],
  },
  辛: {
    title: '빛나는 보석',
    summary:
      '감각이 예민하고 기준이 높은 사람입니다. 디테일을 놓치지 않아 결과물이 깔끔하고, 스스로를 가꾸는 데도 공을 들입니다. 자존심이 상하는 상황을 잘 견디지 못합니다.',
    keywords: ['미적 감각', '예리함', '완벽주의'],
  },
  壬: {
    title: '멀리 흐르는 큰 강과 바다',
    summary:
      '생각의 스케일이 크고 자유로운 사람입니다. 아는 것이 많고 흐름을 읽는 눈이 있어 판을 크게 봅니다. 한곳에 묶이는 것을 답답해해서 관심사가 자주 바뀔 수 있습니다.',
    keywords: ['지혜', '자유로움', '큰 그림'],
  },
  癸: {
    title: '조용히 스며드는 비와 이슬',
    summary:
      '드러나지 않게 주변을 바꾸는 사람입니다. 감수성과 직관이 뛰어나 사람의 속마음을 잘 알아챕니다. 생각이 많아 결정을 미루거나 혼자 고민을 쌓아 둘 때가 있습니다.',
    keywords: ['직관', '감수성', '조용한 영향력'],
  },
};

const ELEMENT_MANY: Record<Element, string> = {
  목: '목(나무) 기운이 강해 새로 시작하고 키워 나가는 힘이 좋습니다. 일을 벌이는 만큼 마무리를 챙기면 결과가 커집니다.',
  화: '화(불) 기운이 강해 표현력과 열정이 넘칩니다. 마음이 급해질 때 한 박자 쉬어 가면 실수가 줄어듭니다.',
  토: '토(흙) 기운이 강해 안정감 있고 믿음직합니다. 변화가 필요한 순간을 미루지 않는 것이 숙제입니다.',
  금: '금(쇠) 기운이 강해 판단이 빠르고 원칙이 분명합니다. 말의 온도를 조금 낮추면 사람이 더 따릅니다.',
  수: '수(물) 기운이 강해 생각이 깊고 흐름을 잘 읽습니다. 고민은 줄이고 실행을 늘릴 때 운이 열립니다.',
};

const ELEMENT_NONE: Record<Element, string> = {
  목: '목(나무) 기운이 없어 새 출발에 시간이 걸리는 편입니다. 시작을 도와주는 사람과 환경이 중요합니다.',
  화: '화(불) 기운이 없어 열정을 겉으로 드러내는 데 서툽니다. 나를 알리는 연습이 기회를 부릅니다.',
  토: '토(흙) 기운이 없어 기반을 다지는 데 신경 써야 합니다. 꾸준한 루틴이 운을 붙잡아 줍니다.',
  금: '금(쇠) 기운이 없어 맺고 끊는 결정이 어려울 수 있습니다. 기준을 미리 정해 두면 편해집니다.',
  수: '수(물) 기운이 없어 쉬어 가는 시간을 놓치기 쉽습니다. 충분한 휴식이 판단력을 지켜 줍니다.',
};

export function previewText(chart: Chart) {
  const dm = DAY_MASTER_TEXT[chart.dayMaster.gan];
  const notes: string[] = [];
  const entries = ELEMENTS.map((e) => [e, chart.elementCounts[e]] as const);
  const max = Math.max(...entries.map(([, c]) => c));
  if (max >= 3) {
    for (const [e, c] of entries) if (c === max) notes.push(ELEMENT_MANY[e]);
  }
  for (const [e, c] of entries) if (c === 0) notes.push(ELEMENT_NONE[e]);
  if (notes.length === 0) notes.push('다섯 가지 기운이 고르게 퍼져 있어 어느 한쪽으로 치우치지 않는 균형 잡힌 사주입니다.');
  return {
    dayMasterTitle: dm.title,
    dayMasterSummary: dm.summary,
    keywords: dm.keywords,
    elementNotes: notes.slice(0, 2),
  };
}

/** 풀이의 중심 연도. 10월부터는 다음 해 운세를 본다. */
export function targetYear(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const year = kst.getUTCMonth() >= 9 ? kst.getUTCFullYear() + 1 : kst.getUTCFullYear();
  const ganzhi: string = Solar.fromYmd(year, 6, 1).getLunar().getYearInGanZhi();
  return { year, ganzhi, ganzhiKo: ganjiKo(ganzhi), label: `${year}년 ${ganjiKo(ganzhi)}년` };
}

export function reportSections(now = new Date()) {
  const ty = targetYear(now);
  return [
    { title: '타고난 성격과 숨은 기질', hint: '남들이 모르는 나의 진짜 모습' },
    { title: '재물운과 돈이 모이는 방식', hint: '돈이 들어오는 시기와 새는 구멍' },
    { title: '연애운과 잘 맞는 사람', hint: '끌리는 사람과 오래 가는 사람' },
    { title: '직업운과 적성', hint: '나에게 맞는 일과 일하는 방식' },
    { title: '건강과 생활 리듬', hint: '약한 부분과 기운을 채우는 습관' },
    { title: `${ty.label} 운세`, hint: '다가오는 해의 기회와 조심할 달' },
    { title: '10년 대운의 흐름', hint: '지금 대운과 다음 대운이 바꾸는 것' },
    { title: '지금 해 볼 것', hint: '풀이를 바탕으로 한 구체적인 조언' },
  ];
}

export function chartToPromptText(name: string, gender: 'M' | 'F', birthTime: string | null, chart: Chart): string {
  const lines: string[] = [];
  lines.push(`이름: ${name}`);
  lines.push(`성별: ${gender === 'M' ? '남' : '여'}, 만 ${chart.age}세, ${chart.zodiac}띠`);
  lines.push(`양력 ${chart.solarDate} / 음력 ${chart.lunarDate} / 태어난 시간: ${birthTime ?? '모름 (시주 없이 풀이)'}`);
  lines.push('사주팔자 (천간 / 지지, 괄호 안은 오행과 십신):');
  for (const p of chart.pillars) {
    lines.push(
      `- ${p.label}: ${p.gan}${p.zhi} ${p.ganKo}${p.zhiKo} | 천간 ${p.ganKo}(${p.ganYang ? '양' : '음'}${p.ganElement}, ${p.ganTenGod}) | 지지 ${p.zhiKo}(${p.zhiElement}, ${p.zhiTenGod})`,
    );
  }
  lines.push(`일간(본인): ${chart.dayMaster.ko} (${chart.dayMaster.yang ? '양' : '음'}${chart.dayMaster.element})`);
  lines.push(`오행 개수: ${ELEMENTS.map((e) => `${e} ${chart.elementCounts[e]}`).join(', ')}`);
  lines.push(`대운: ${chart.daYun.map((d) => `${d.startAge}세(${d.startYear}) ${d.ganzhiKo}`).join(', ')}`);
  if (chart.currentDaYun) lines.push(`현재 대운: ${chart.currentDaYun.ganzhiKo} (${chart.currentDaYun.startYear}년 시작)`);
  return lines.join('\n');
}
