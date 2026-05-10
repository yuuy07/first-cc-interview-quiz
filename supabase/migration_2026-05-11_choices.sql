-- Migration: Add support for choice and judge question types
-- 2026-05-11

-- 1. Drop old constraint
alter table questions drop constraint if exists chk_question_type;

-- 2. Add updated constraint
alter table questions add constraint chk_question_type
  check (question_type in ('subjective', 'choice', 'judge', 'interview', 'experience'));

-- 3. Set default question_type for existing questions
update questions set question_type = 'subjective' where question_type = 'quiz';

-- 4. Index on question_type for filtering
create index if not exists idx_questions_type on questions(question_type);
