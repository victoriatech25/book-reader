-- =============================================================================
-- 0001_init.sql — 독서 기록 관리 앱 초기 스키마
-- 근거: docs/PRD.md §2 (데이터 모델) · docs/WORKPLAN.md W2
--
-- 설계 요약
--   * book(책) 1 : N reading(독서 시도) — 재독 시 reading 레코드를 추가한다.
--   * 진행률 단위는 percent(전자책 기본) | page(종이책) 둘뿐이다.
--   * 모든 테이블 RLS 활성화. 본인 행만 접근 가능.
--   * 분야 프리셋은 회원가입 트리거에서 사용자별로 복사한다(전역 공유 아님).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 공용 트리거 함수
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — auth.users 확장
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone     text        not null default 'Asia/Seoul',
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'auth.users 1:1 확장. 가입 시 트리거가 자동 생성한다.';

-- -----------------------------------------------------------------------------
-- categories — 분야. 책당 1개(단일 선택). 통계의 분류 축.
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  color      text,
  sort_order int         not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_name_len check (char_length(name) between 1 and 30),
  constraint categories_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  unique (user_id, name)
);

comment on column public.categories.color is
  'null이면 앱이 팔레트에서 자동 배정한다. 사용자가 지정한 경우에만 값이 들어간다.';

-- -----------------------------------------------------------------------------
-- books — 도서 마스터
-- -----------------------------------------------------------------------------
create table public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  title        text        not null,
  subtitle     text,
  authors      text[]      not null default '{}',
  translators  text[]      not null default '{}',
  publisher    text,
  published_on date,
  isbn13       text,
  cover_url    text,
  total_pages  int,
  format       text        not null default 'ebook',
  ownership    text        not null default 'own',
  category_id  uuid        references public.categories (id) on delete set null,
  source       text        not null default 'manual',
  source_ref   jsonb,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint books_title_len   check (char_length(title) between 1 and 300),
  constraint books_format      check (format in ('ebook', 'paper')),
  constraint books_ownership   check (ownership in ('own', 'library', 'subscription', 'borrowed')),
  constraint books_source      check (source in ('manual', 'kakao', 'aladin')),
  constraint books_isbn13      check (isbn13 is null or isbn13 ~ '^[0-9]{13}$'),
  constraint books_total_pages check (total_pages is null or total_pages between 1 and 20000),
  constraint books_memo_len    check (memo is null or char_length(memo) <= 2000)
);

comment on column public.books.total_pages is
  '페이지 단위로 진행률을 기록할 때만 필요하다. 필수 여부는 readings.progress_unit이 강제한다.';
comment on column public.books.source_ref is '외부 API 원본 응답 일부. 재조회·디버깅용.';

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- readings — 한 번의 독서 시도. 재독하면 attempt_no를 올려 새 행을 만든다.
-- -----------------------------------------------------------------------------
create table public.readings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles (id) on delete cascade,
  book_id           uuid        not null references public.books (id) on delete cascade,
  attempt_no        int         not null default 1,
  status            text        not null default 'want',
  progress_unit     text        not null default 'percent',
  current_value     int         not null default 0,
  target_value      int,
  started_at        timestamptz,
  finished_at       timestamptz,
  dropped_at        timestamptz,
  drop_reason       text,
  rating            numeric(2, 1),
  review            text,
  review_is_private boolean     not null default true,
  spoiler           boolean     not null default false,
  due_on            date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (book_id, attempt_no),
  constraint readings_attempt_no  check (attempt_no >= 1),
  constraint readings_status      check (status in ('want', 'reading', 'paused', 'finished', 'dropped')),
  constraint readings_unit        check (progress_unit in ('percent', 'page')),

  -- 단위별 분량 규칙: percent는 항상 100, page는 반드시 값이 있어야 한다.
  constraint readings_percent_target   check (progress_unit <> 'percent' or target_value = 100),
  constraint readings_page_needs_target check (progress_unit <> 'page' or target_value is not null),
  constraint readings_target_positive  check (target_value is null or target_value > 0),
  constraint readings_current_range    check (
    current_value >= 0 and (target_value is null or current_value <= target_value)
  ),

  -- 별점은 0.5 단위 (numeric(2,1)이 소수 1자리를, 아래 검사가 0.5 배수를 강제)
  constraint readings_rating check (
    rating is null or (rating >= 0.5 and rating <= 5.0 and rating * 2 = trunc(rating * 2))
  ),

  -- 한 줄 소감: 길이를 스키마에서 막아 데이터 성격을 유지한다 (PRD §2.3)
  constraint readings_review_len      check (review is null or char_length(review) <= 500),
  constraint readings_drop_reason_len check (drop_reason is null or char_length(drop_reason) <= 300),

  -- 상태와 날짜의 정합성
  constraint readings_started_ts  check (status = 'want' or started_at is not null),
  constraint readings_finished_ts check (status <> 'finished' or finished_at is not null),
  constraint readings_dropped_ts  check (status <> 'dropped' or dropped_at is not null)
);

comment on table public.readings is
  '독서 시도 1건. finished/dropped 이후 다시 읽으면 기존 행을 수정하지 않고 attempt_no+1 행을 만든다.';

create trigger readings_set_updated_at
  before update on public.readings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- progress_logs — 진행 기록. 스트릭·속도·히트맵의 원천 데이터.
-- -----------------------------------------------------------------------------
create table public.progress_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  reading_id uuid        not null references public.readings (id) on delete cascade,
  logged_on  date        not null default current_date,
  value_from int,
  value_to   int         not null,
  minutes    int,
  memo       text,
  created_at timestamptz not null default now(),
  constraint progress_logs_value    check (value_to >= 0 and (value_from is null or value_from >= 0)),
  constraint progress_logs_minutes  check (minutes is null or minutes between 1 and 1440),
  constraint progress_logs_memo_len check (memo is null or char_length(memo) <= 500)
);

-- -----------------------------------------------------------------------------
-- notes — 인용 / 생각 / 질문
-- -----------------------------------------------------------------------------
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  reading_id  uuid        not null references public.readings (id) on delete cascade,
  kind        text        not null default 'quote',
  location    int,
  body        text        not null,
  is_favorite boolean     not null default false,
  created_at  timestamptz not null default now(),
  constraint notes_kind     check (kind in ('quote', 'thought', 'question')),
  constraint notes_body_len check (char_length(body) between 1 and 2000),
  constraint notes_location check (location is null or location >= 0)
);

comment on column public.notes.location is
  '인용 위치. 단위는 소속 readings.progress_unit을 따른다(페이지 또는 %).';

-- -----------------------------------------------------------------------------
-- tags / book_tags — 자유 태그(다중). 검색 축.
-- -----------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  constraint tags_name_len check (char_length(name) between 1 and 30),
  unique (user_id, name)
);

create table public.book_tags (
  book_id uuid not null references public.books (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (book_id, tag_id)
);

-- -----------------------------------------------------------------------------
-- shelves / shelf_books — 임의 컬렉션
-- -----------------------------------------------------------------------------
create table public.shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  name        text        not null,
  description text,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  constraint shelves_name_len check (char_length(name) between 1 and 50),
  constraint shelves_desc_len check (description is null or char_length(description) <= 300),
  unique (user_id, name)
);

create table public.shelf_books (
  shelf_id   uuid not null references public.shelves (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  sort_order int  not null default 0,
  primary key (shelf_id, book_id)
);

-- -----------------------------------------------------------------------------
-- goals — 연간/월간 목표
-- -----------------------------------------------------------------------------
create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  period     text        not null,
  period_key text        not null,
  metric     text        not null default 'books',
  target     int         not null,
  created_at timestamptz not null default now(),
  constraint goals_period check (period in ('year', 'month')),
  constraint goals_metric check (metric in ('books', 'minutes')),
  constraint goals_target check (target > 0),
  constraint goals_period_key check (
    (period = 'year'  and period_key ~ '^[0-9]{4}$') or
    (period = 'month' and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  ),
  unique (user_id, period, period_key, metric)
);

comment on column public.goals.metric is
  '권수 또는 독서 시간(분). 페이지는 제외한다 — 전자책 비중 탓에 실제 독서량을 왜곡한다.';

-- -----------------------------------------------------------------------------
-- 인덱스
-- -----------------------------------------------------------------------------
create index books_user_updated_idx    on public.books (user_id, updated_at desc);
create unique index books_user_isbn_idx on public.books (user_id, isbn13) where isbn13 is not null;
create index books_category_idx        on public.books (category_id);

create index readings_user_status_idx  on public.readings (user_id, status, updated_at desc);
create index readings_book_idx         on public.readings (book_id, attempt_no);
create index readings_finished_idx     on public.readings (user_id, finished_at desc) where finished_at is not null;

create index progress_logs_user_date_idx on public.progress_logs (user_id, logged_on desc);
create index progress_logs_reading_idx   on public.progress_logs (reading_id, logged_on desc);

create index notes_reading_idx  on public.notes (reading_id, created_at desc);
create index notes_user_fav_idx on public.notes (user_id) where is_favorite;

create index book_tags_tag_idx    on public.book_tags (tag_id);
create index shelf_books_book_idx on public.shelf_books (book_id);
create index goals_user_idx       on public.goals (user_id, period, period_key);

-- -----------------------------------------------------------------------------
-- RLS — 전 테이블 활성화. auth.uid()는 (select ...)로 감싸 행마다 재평가되지 않게 한다.
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.books         enable row level security;
alter table public.readings      enable row level security;
alter table public.progress_logs enable row level security;
alter table public.notes         enable row level security;
alter table public.tags          enable row level security;
alter table public.book_tags     enable row level security;
alter table public.shelves       enable row level security;
alter table public.shelf_books   enable row level security;
alter table public.goals         enable row level security;

-- profiles: 본인 행 조회·수정만. insert는 가입 트리거(security definer)가 담당한다.
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_id를 직접 가진 테이블: 본인 행 전권
create policy "categories_own" on public.categories
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "books_own" on public.books
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "readings_own" on public.readings
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "progress_logs_own" on public.progress_logs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notes_own" on public.notes
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tags_own" on public.tags
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "shelves_own" on public.shelves
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals_own" on public.goals
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 조인 테이블: user_id 컬럼을 두지 않고 부모의 소유권을 따라간다.
create policy "book_tags_own" on public.book_tags
  for all
  using (
    exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

create policy "shelf_books_own" on public.shelf_books
  for all
  using (
    exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 가입 트리거 — profile 생성 + 분야 프리셋 12종을 사용자별로 복사
--   전역 공유 행이 아니라 사용자 소유 행으로 넣는다. 이름·색상·순서를 자유롭게
--   고칠 수 있고 RLS가 단일 조건(user_id = auth.uid())으로 통일된다.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );

  insert into public.categories (user_id, name, sort_order)
  select new.id, preset.name, preset.ord
  from (values
    ('문학', 1), ('인문', 2), ('경제경영', 3), ('과학', 4),
    ('기술·IT', 5), ('자기계발', 6), ('에세이', 7), ('역사', 8),
    ('예술', 9), ('종교', 10), ('실용', 11), ('기타', 12)
  ) as preset (name, ord);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- record_progress — 진행 기록을 원자적으로 처리하는 RPC
--   progress_logs insert + readings.current_value 갱신을 한 트랜잭션으로 묶는다.
--   security invoker이므로 RLS가 그대로 적용된다(남의 reading은 조회 자체가 안 됨).
-- -----------------------------------------------------------------------------
create or replace function public.record_progress(
  p_reading_id uuid,
  p_value_to   int,
  p_minutes    int  default null,
  p_memo       text default null,
  p_logged_on  date default null
)
returns public.readings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reading public.readings;
begin
  select * into v_reading
  from public.readings
  where id = p_reading_id
  for update;

  if not found then
    raise exception 'reading %를 찾을 수 없거나 접근 권한이 없습니다', p_reading_id
      using errcode = 'no_data_found';
  end if;

  if v_reading.status in ('finished', 'dropped') then
    raise exception '% 상태의 독서에는 진행을 기록할 수 없습니다', v_reading.status
      using errcode = 'check_violation';
  end if;

  if p_value_to < 0 then
    raise exception '진행 값은 0 이상이어야 합니다' using errcode = 'check_violation';
  end if;

  if v_reading.target_value is not null and p_value_to > v_reading.target_value then
    raise exception '진행 값 %가 전체 분량 %를 넘습니다', p_value_to, v_reading.target_value
      using errcode = 'check_violation';
  end if;

  insert into public.progress_logs (
    user_id, reading_id, logged_on, value_from, value_to, minutes, memo
  )
  values (
    v_reading.user_id,
    p_reading_id,
    coalesce(p_logged_on, current_date),
    v_reading.current_value,
    p_value_to,
    p_minutes,
    p_memo
  );

  -- want/paused 상태에서 진행을 기록하면 자동으로 reading으로 올린다.
  -- 완독 판정은 하지 않는다(명시적 행위로만 처리 — PRD §2.2).
  update public.readings
  set current_value = p_value_to,
      status        = case when status in ('want', 'paused') then 'reading' else status end,
      started_at    = coalesce(started_at, now())
  where id = p_reading_id
  returning * into v_reading;

  return v_reading;
end;
$$;

revoke all on function public.record_progress(uuid, int, int, text, date) from public;
grant execute on function public.record_progress(uuid, int, int, text, date) to authenticated;
