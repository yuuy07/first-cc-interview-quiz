-- Interview sessions
create table interview_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  status              text not null default 'in_progress'
                      check (status in ('in_progress','completed','cancelled','pending')),
  jd_text             text not null,
  company             text,
  resume_text         text,
  topics              text[] not null,
  duration            int not null default 30,
  generated_questions jsonb,
  total_score         numeric(4,1),
  summary             text,
  created_at          timestamptz default now()
);

alter table interview_sessions enable row level security;
create policy "Users can manage own sessions"
  on interview_sessions for all
  using (auth.uid() = user_id);

-- Interview responses
create table interview_responses (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references interview_sessions on delete cascade not null,
  question        text not null,
  expected_answer text,
  topic           text not null,
  user_answer     text not null,
  ai_score        int not null check (ai_score between 1 and 10),
  ai_feedback     text,
  ai_followup     text,
  user_followup   text,
  order_num       int not null,
  created_at      timestamptz default now()
);

alter table interview_responses enable row level security;
create policy "Users can manage own responses"
  on interview_responses for all
  using (exists (
    select 1 from interview_sessions where id = session_id and user_id = auth.uid()
  ));
