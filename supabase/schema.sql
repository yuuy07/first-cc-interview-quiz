-- Schema v1 — 2026-05-10
-- 面试刷题工具数据库建表 + RLS

-- 数据来源表
create table sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  source_type text not null default 'document',
  description text,
  created_at  timestamptz not null default now()
);

-- 题库表
create table questions (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references sources(id),
  display_order   integer default 0,
  topic           text not null,
  subtopic        text,
  question        text not null,
  answer          text not null,
  choices         jsonb,
  correct_idx     smallint,
  difficulty      smallint default 3,
  tags            jsonb default '[]',
  code_blocks     jsonb default '[]',
  question_type   text default 'quiz',
  created_at      timestamptz not null default now()
);

-- 约束
alter table questions add constraint chk_difficulty check (difficulty between 1 and 5);
alter table questions add constraint chk_question_type check (question_type in ('subjective', 'choice', 'judge', 'interview', 'experience'));

create index idx_questions_topic on questions(topic);
create index idx_questions_source on questions(source_id);
create index idx_questions_tags on questions using gin(tags);

-- 用户进度表
create table user_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) not null,
  question_id     uuid references questions(id) not null,
  status          text default 'new',
  attempt_count   integer default 0,
  last_answer     text,
  last_reviewed   timestamptz,
  next_review     timestamptz,
  session_type    text default 'quiz',
  unique(user_id, question_id, session_type)
);

-- 约束
alter table user_progress add constraint chk_progress_status
  check (status in ('new', 'seen', 'correct', 'wrong', 'skipped'));
alter table user_progress add constraint chk_session_type
  check (session_type in ('quiz', 'mock_interview'));

create index idx_user_progress_user on user_progress(user_id);
create index idx_user_progress_review on user_progress(next_review);

-- RLS
alter table sources enable row level security;
alter table questions enable row level security;
alter table user_progress enable row level security;

create policy "Sources are publicly readable"
  on sources for select using (true);

create policy "Questions are publicly readable"
  on questions for select using (true);

create policy "Users can read own progress"
  on user_progress for select using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on user_progress for update using (auth.uid() = user_id);

create policy "Users can delete own progress"
  on user_progress for delete using (auth.uid() = user_id);
