"""
Minimal, aggressive approach: generate short MCQ/TF options by extracting
only the FIRST LINE of key facts from answers, keeping options SHORT.
"""
import json, re, random

random.seed(42)

SWAP_MAP = {
    '堆': '栈', '栈': '堆',
    'BSS': 'Data', 'Data': 'BSS',
    '全局': '局部', '局部': '全局',
    '静态': '动态', '动态': '静态',
    '用户态': '内核态', '内核态': '用户态',
    '虚拟': '物理', '物理': '虚拟',
    '同步': '异步', '异步': '同步',
    '阻塞': '非阻塞', '非阻塞': '阻塞',
    '虚函数': '纯虚函数', '纯虚函数': '虚函数',
    '基类': '派生类', '派生类': '基类',
    'TCP': 'UDP', 'UDP': 'TCP',
    '任务': '中断', '中断': '任务',
    '信号量': '互斥量', '互斥量': '信号量',
}


def pick_short(text):
    """Pick the first short sentence from text."""
    # Remove markdown
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    # Take first line or sentence
    text = text.split('\n')[0].split('。')[0].split('；')[0]
    # Clean
    text = re.sub(r'^[\d]+[\.\)]\s*', '', text)
    text = text.strip().strip('：:,- ').strip()
    return text[:60]


def extract_short_facts(answer):
    """Extract very short, clean factual statements."""
    text = re.sub(r'```[\s\S]*?```', '', answer)
    facts = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith(('---', '|--', '```')):
            continue
        if line.startswith('- '):
            f = pick_short(line[2:])
            if 10 <= len(f) <= 55:
                facts.append(f)
        m = re.match(r'\d+[\.\)]\s+(.+)', line)
        if m:
            f = pick_short(m.group(1))
            if 10 <= len(f) <= 55:
                facts.append(f)
    # Deduplicate
    seen = set()
    return [f for f in facts if not (f.lower() in seen or seen.add(f.lower()))]


def make_wrong(text):
    """Make a wrong version of text by swapping one concept."""
    for a, b in SWAP_MAP.items():
        if a in text:
            return text.replace(a, b, 1)
        if b in text:
            return text.replace(b, a, 1)
    # Negate
    for w in ['是', '会', '可以', '需要', '有', '支持', '必须', '属于']:
        if w in text:
            return text.replace(w, f'不{w}', 1)
    return None


# Process
with open('scripts/questions_v2.json') as f:
    qs = json.load(f)

stats = {'mcq': 0, 'tf': 0, 'fallback': 0}

for q in qs:
    if q.get('choices'):
        continue

    facts = extract_short_facts(q['answer'])

    if len(facts) >= 5:
        # MCQ with "以下说法错误的是" format (1 wrong, 3 correct)
        random.shuffle(facts)
        # Pick one to make wrong
        to_corrupt = facts[0]
        wrong = make_wrong(to_corrupt)
        if wrong and wrong != to_corrupt and len(wrong) >= 10:
            options = [wrong] + facts[1:4]  # 1 wrong + 3 correct
            random.shuffle(options)
            correct_idx = options.index(wrong)
            q['choices'] = options
            q['correct_idx'] = correct_idx
            stats['mcq'] += 1
        else:
            q['choices'] = [facts[0], facts[1], facts[2], facts[3]]
            q['correct_idx'] = 0
            stats['fallback'] += 1
    elif len(facts) >= 2:
        # T/F
        f = facts[0]
        if random.random() > 0.5:
            q['choices'] = [f, make_wrong(f) or f + '（错误）']
            q['correct_idx'] = 0
        else:
            w = make_wrong(f)
            q['choices'] = [w if w else f + '（错误）', f]
            q['correct_idx'] = 1
        stats['tf'] += 1
    else:
        q['choices'] = [f"关于{q['topic']}的正确描述", "以上描述有误"]
        q['correct_idx'] = 0
        stats['fallback'] += 1

with open('scripts/questions_v2.json', 'w') as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)

print(f"MCQ: {stats['mcq']}, T/F: {stats['tf']}, Fallback: {stats['fallback']}")
print(f"Total: {stats['mcq'] + stats['tf'] + stats['fallback']}")

# Show clean samples
print("\n=== Clean samples ===")
for q in qs[:8]:
    dtype = 'MCQ' if len(q['choices']) >= 3 else 'T/F'
    print(f"\nQ: {q['question'][:50]}")
    print(f"Type: {dtype}")
    for i, c in enumerate(q['choices']):
        m = '✓' if i == q['correct_idx'] else '✗'
        print(f"  {m} {c}")
