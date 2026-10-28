-- 자사 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run 한 번이면 됩니다.

-- 사용자별 작업 공간(경험·분석·원고)을 통째로 저장
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

drop policy if exists "본인 작업 공간만 조회" on public.workspaces;
create policy "본인 작업 공간만 조회" on public.workspaces
  for select using (auth.uid() = user_id);
drop policy if exists "본인 작업 공간만 생성" on public.workspaces;
create policy "본인 작업 공간만 생성" on public.workspaces
  for insert with check (auth.uid() = user_id);
drop policy if exists "본인 작업 공간만 수정" on public.workspaces;
create policy "본인 작업 공간만 수정" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 아래 세 테이블은 서버(service role)만 읽고 씀. RLS를 켜고 정책을 두지 않아 브라우저에서는 접근 불가.

-- 요금제: pro_until 이 지금보다 뒤면 프로
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pro_until timestamptz
);
alter table public.profiles enable row level security;

-- 하루 AI 사용 횟수
create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.usage enable row level security;

-- 결제 주문
create table if not exists public.payments (
  order_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  status text not null check (status in ('ready', 'done', 'failed')),
  payment_key text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.payments enable row level security;

-- 한도 안이면 1회 차감하고 true, 한도를 넘으면 false (동시에 여러 요청이 와도 정확히 셈)
create or replace function public.consume_ai_credit(p_user uuid, p_day date, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into usage (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = usage.count + 1
    where usage.count < p_limit
  returning count into n;
  return n is not null;
end;
$$;

-- AI 호출이 실패했을 때 1회 되돌림
create or replace function public.refund_ai_credit(p_user uuid, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update usage set count = greatest(count - 1, 0) where user_id = p_user and day = p_day;
$$;

revoke execute on function public.consume_ai_credit(uuid, date, int) from public, anon, authenticated;
revoke execute on function public.refund_ai_credit(uuid, date) from public, anon, authenticated;
