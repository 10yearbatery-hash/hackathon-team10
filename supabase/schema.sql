-- 펭귄 모험 서버 설정 (ADR-017). Supabase 대시보드 > SQL Editor에 붙여 넣고 Run을 한 번 누른다.
-- 계정마다 진행 상태 한 줄(family_state)과, 인증 사진·영상 폴더(proofs/<계정 id>/)를 둔다.
-- 행 수준 보안(RLS)으로 자기 계정의 데이터만 읽고 쓸 수 있다.

-- 1. 진행 상태 (단계, 코인 기록, 미션, 선물, 구매 기록을 앱 상태 JSON 그대로 저장)
create table if not exists public.family_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.family_state enable row level security;

drop policy if exists "own state select" on public.family_state;
drop policy if exists "own state insert" on public.family_state;
drop policy if exists "own state update" on public.family_state;
drop policy if exists "own state delete" on public.family_state;
create policy "own state select" on public.family_state for select to authenticated using (auth.uid() = user_id);
create policy "own state insert" on public.family_state for insert to authenticated with check (auth.uid() = user_id);
create policy "own state update" on public.family_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state delete" on public.family_state for delete to authenticated using (auth.uid() = user_id);

-- 2. 인증 사진·영상 (비공개 버킷, 파일 하나 최대 50MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('proofs', 'proofs', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "own proofs select" on storage.objects;
drop policy if exists "own proofs insert" on storage.objects;
drop policy if exists "own proofs update" on storage.objects;
drop policy if exists "own proofs delete" on storage.objects;
create policy "own proofs select" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own proofs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own proofs update" on storage.objects for update to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own proofs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
