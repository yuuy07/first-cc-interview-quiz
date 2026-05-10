/*
Import questions_v2.json to Supabase, replacing all existing questions.
Run from within the frontend/ directory where @supabase/supabase-js is installed.

Usage: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-to-supabase.mjs
*/
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const fs = await import('fs')
  const questions = JSON.parse(fs.readFileSync('../scripts/questions_v2.json', 'utf-8'))

  console.log(`📦 Loading ${questions.length} questions...`)

  // Delete all existing questions
  const { error: delError } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delError) {
    console.error('❌ Delete error:', delError.message)
    // Try alternative: delete all via filter
    const { error: del2 } = await supabase.from('questions').delete().gte('display_order', 0)
    if (del2) {
      console.error('❌ Delete all failed:', del2.message)
      process.exit(1)
    }
  }
  console.log('✅ Cleared existing questions')

  // Get sources
  const { data: sources } = await supabase.from('sources').select('id, name')
  const sourceMap = {}
  for (const s of sources) {
    sourceMap[s.name] = s.id
  }
  console.log(`📚 Sources: ${JSON.stringify(sourceMap)}`)

  // Prepare batch insert
  const BATCH_SIZE = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE)
    const records = batch.map((q, idx) => {
      // Determine question_type
      let questionType = 'subjective'
      if (q.choices && q.choices.length === 2) {
        questionType = 'judge'
      } else if (q.choices && q.choices.length >= 3) {
        questionType = 'choice'
      }

      return {
        display_order: i + idx,
        topic: q.topic,
        subtopic: q.subtopic || null,
        question: q.question,
        answer: q.answer,
        choices: q.choices || null,
        correct_idx: q.correct_idx ?? null,
        difficulty: q.difficulty || 3,
        tags: q.tags || [],
        code_blocks: q.code_blocks || [],
        question_type: questionType,
        source_id: sourceMap[q.source] || null,
      }
    })

    const { error } = await supabase.from('questions').insert(records, { ignoreDuplicates: false })
    if (error) {
      console.error(`❌ Batch ${i / BATCH_SIZE} error:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
    }

    if ((i / BATCH_SIZE) % 5 === 0) {
      process.stdout.write(`\r⏳ ${i}/${questions.length} processed...`)
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted}, Errors: ${errors}`)
}

main().catch(console.error)
