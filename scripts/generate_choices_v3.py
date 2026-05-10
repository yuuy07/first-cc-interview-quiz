"""
Generate MCQ and T/F choices with short, clean options.
Cuts each option to a single clear statement (max 60 chars).
"""
import json, re, random

random.seed(42)

TECH_PAIRS = [
    ('堆', '栈'), ('BSS', 'Data'), ('Data', 'BSS'),
    ('全局', '局部'), ('静态', '动态'),
    ('用户态', '内核态'), ('虚拟地址', '物理地址'),
    ('同步', '异步'), ('阻塞', '非阻塞'),
    ('虚函数', '纯虚函数'),
    ('unique_ptr', 'shared_ptr'),
    ('TCP', 'UDP'), ('HTTP', 'HTTPS'),
    ('基类', '派生类'), ('私有', '公有'),
    ('任务', '中断'), ('信号量', '互斥量'),
    ('字符设备', '块设备'),
    ('malloc', 'calloc'),
]


def clean(text):
    """Remove markdown, trim to short clean sentence."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    # Take first sentence
    text = text.split('。')[0].split('\n')[0]
    text = text.strip().strip('：:,-').strip()
    # Remove leading numbering
    text = re.sub(r'^[\d]+[\.\)]\s*', '', text)
    return text[:70]


def extract_facts(answer):
    """Extract short, clean factual statements from answer."""
    text = re.sub(r'```[\s\S]*?```', '', answer)
    facts = []

    for line in text.split('\n'):
        line = line.strip()
        # Skip headers and structure
        if not line or line.startswith('---') or line.startswith('|--') or line.startswith('```'):
            continue

        # Bullet points
        if line.startswith('- '):
            fact = clean(line[2:])
            if 8 < len(fact) < 70:
                facts.append(fact)

        # Numbered items
        m = re.match(r'\d+[\.\)]\s+(.+)', line)
        if m:
            fact = clean(m.group(1))
            if 8 < len(fact) < 70:
                facts.append(fact)

        # Bold claims
        m = re.match(r'\*\*(.+?)\*\*[:：]?\s*(.*)', line)
        if m:
            fact = clean(m.group(2) if m.group(2) else m.group(1))
            if 8 < len(fact) < 70:
                facts.append(fact)

    # Also extract from markdown tables
    table_cells = re.findall(r'\|([^|]+)\|', text)
    for cell in table_cells:
        cell = clean(cell)
        if 8 < len(cell) < 50 and not cell.startswith('-'):
            facts.append(cell)

    # Deduplicate
    seen = set()
    unique = []
    for f in facts:
        low = f.lower().strip()
        if low not in seen and len(low) > 5:
            seen.add(low)
            unique.append(f)
    return unique


def make_wrong(fact):
    """Create one plausible wrong version of a fact."""
    for a, b in TECH_PAIRS:
        if a in fact and b not in fact:
            result = fact.replace(a, b, 1)
            if result != fact and result.strip():
                return result
        if b in fact and a not in fact:
            result = fact.replace(b, a, 1)
            if result != fact and result.strip():
                return result

    # Try negation
    for pos, neg in [('是', '不是'), ('会', '不会'), ('可以', '不能'),
                     ('需要', '不需要'), ('有', '没有'), ('支持', '不支持'),
                     ('必须', '不必'), ('属于', '不属于')]:
        if pos in fact:
            return fact.replace(pos, neg, 1)

    return None


# Load questions
with open('scripts/questions_v2.json') as f:
    qs = json.load(f)

stats = {'mcq': 0, 'tf': 0, 'none': 0}

for q in qs:
    if q.get('choices'):
        continue

    facts = extract_facts(q['answer'])

    if len(facts) < 4:
        # Generate T/F
        if facts:
            f = random.choice(facts)
            # 50/50 true/false
            if random.random() > 0.5:
                w = make_wrong(f)
                q['choices'] = [f, clean(w) if w else f + '（错误表述）']
                q['correct_idx'] = 0
            else:
                wrong = make_wrong(f)
                q['choices'] = [wrong if wrong else f + '（错误表述）', f]
                q['correct_idx'] = 1
            stats['tf'] += 1
        else:
            # Emergency fallback
            q['choices'] = [q['subtopic'] or q['topic'], '以上说法有误']
            q['correct_idx'] = 0
            stats['none'] += 1
        continue

    # Generate MCQ - pick 1 correct + 3 wrong
    random.shuffle(facts)
    correct = facts[0]

    wrongs = []
    for f in facts[1:]:
        w = make_wrong(f)
        if w and w != correct and w not in wrongs:
            wrongs.append(w)
            if len(wrongs) >= 3:
                break

    # If not enough wrongs, use unrelated facts as wrong
    if len(wrongs) < 3:
        for f in facts[1:]:
            if f not in wrongs:
                wrongs.append(f)
                if len(wrongs) >= 3:
                    break

    # Fill remaining with generic wrong options
    while len(wrongs) < 3:
        wrongs.append(f"关于{q['topic']}的理解存在偏差")

    # Shuffle
    options = [correct] + wrongs[:3]
    random.shuffle(options)
    correct_idx = options.index(correct)

    q['choices'] = options
    q['correct_idx'] = correct_idx
    stats['mcq'] += 1

# Save
with open('scripts/questions_v2.json', 'w') as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)

print(f"MCQ: {stats['mcq']}, T/F: {stats['tf']}, None: {stats['none']}")
print(f"Total: {stats['mcq'] + stats['tf'] + stats['none']}")

# Show samples
print("\n=== Samples ===")
for q in qs[:5]:
    print(f"\nQ: {q['question']}")
    for i, c in enumerate(q['choices']):
        m = '✓' if i == q['correct_idx'] else '✗'
        print(f"  {m} {c[:60]}")
