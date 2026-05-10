"""
Generate MCQ and T/F choices for all questions using intelligent extraction
from the existing answer content.

Strategy:
1. Parse each answer into distinct factual claims (by ** headings, bullet points, etc.)
2. For MCQ: Pick one claim as correct, use 3 others modified to be wrong
3. For T/F: Pick a definitive statement, decide if it's true or false
"""
import json, re, random

random.seed(42)

# Technical term pairs for generating plausible wrong answers
TERM_SWAPS = [
    # Memory/storage
    (r'\b堆\b', '栈'), (r'\b栈\b', '堆'),
    (r'\bBSS\b', 'Data'), (r'\bData\b', 'BSS'),
    (r'\b全局区\b', '栈区'), (r'\b栈区\b', '全局区'),

    # Scope/lifecycle
    (r'\b全局\b', '局部'), (r'\b局部\b', '全局'),
    (r'\b静态\b', '动态'), (r'\b动态\b', '静态'),

    # OS concepts
    (r'\b用户态\b', '内核态'), (r'\b内核态\b', '用户态'),
    (r'\b用户空间\b', '内核空间'), (r'\b内核空间\b', '用户空间'),
    (r'\b虚拟地址\b', '物理地址'), (r'\b物理地址\b', '虚拟地址'),
    (r'\b虚拟内存\b', '物理内存'), (r'\b物理内存\b', '虚拟内存'),

    # Concurrency
    (r'\b同步\b', '异步'), (r'\b异步\b', '同步'),
    (r'\b阻塞\b', '非阻塞'), (r'\b非阻塞\b', '阻塞'),

    # C/C++
    (r'\b虚函数\b', '纯虚函数'), (r'\b纯虚函数\b', '虚函数'),
    (r'\bmalloc\b', 'calloc'), (r'\bcalloc\b', 'malloc'),
    (r'\bunique_ptr\b', 'shared_ptr'), (r'\bshared_ptr\b', 'unique_ptr'),
    (r'\bnew\b(?![^-])', 'malloc'), (r'\bmalloc\b', 'new'),

    # Networking
    (r'\bTCP\b', 'UDP'), (r'\bUDP\b', 'TCP'),
    (r'\bHTTP\b', 'HTTPS'), (r'\bHTTPS\b', 'HTTP'),

    # OOP
    (r'\b基类\b', '派生类'), (r'\b派生类\b', '基类'),
    (r'\b私有\b', '公有'), (r'\b公有\b', '私有'),

    # FreeRTOS
    (r'\b任务\b', '中断'), (r'\b中断\b', '任务'),
    (r'\b信号量\b', '互斥量'), (r'\b互斥量\b', '信号量'),
    (r'\b队列\b', '信号量'),

    # Linux
    (r'\b字符设备\b', '块设备'), (r'\b块设备\b', '字符设备'),
    (r'\bplatform_driver\b', 'platform_device'), (r'\bplatform_device\b', 'platform_driver'),

    # STM32
    (r'\bGPIO\b', 'AFIO'), (r'\bAFIO\b', 'GPIO'),
    (r'\b串口\b', '并口'), (r'\b并口\b', '串口'),
]

NEGATIONS = [
    ('是', '不是'), ('会', '不会'), ('可以', '不可以'),
    ('需要', '不需要'), ('有', '没有'), ('支持', '不支持'),
    ('必须', '不必'), ('能', '不能'), ('可能', '不可能'),
    ('包括', '不包括'), ('属于', '不属于'),
]


def extract_claims(answer):
    """Extract standalone factual claims from answer text."""
    claims = []

    # Remove markdown code blocks
    text = re.sub(r'```[\s\S]*?```', '', answer)

    # Extract **bold claims** - get text after bold headers until next section
    parts = re.split(r'\n(?=\*\*)', text)
    for part in parts:
        m = re.match(r'\*\*(.+?)\*\*[:：]?\s*(.*)', part, re.DOTALL)
        if m:
            claim = (m.group(1) + '：' + m.group(2).strip()[:80]).strip()
            if 15 < len(claim) < 120:
                claims.append(claim)

    # Extract bullet points (cleaned)
    for m in re.finditer(r'^- (.+)', text, re.MULTILINE):
        claim = m.group(1).strip()
        claim = re.sub(r'\*\*(.*?)\*\*', r'\1', claim)
        if 15 < len(claim) < 100:
            claims.append(claim)

    # Extract numbered items
    for m in re.finditer(r'^\d+[\.\)]\s+(.+)', text, re.MULTILINE):
        claim = m.group(1).strip()
        claim = re.sub(r'\*\*(.*?)\*\*', r'\1', claim)
        if 15 < len(claim) < 100:
            claims.append(claim)

    # Extract table cells
    for m in re.finditer(r'\|([^|]+)\|', text):
        claim = m.group(1).strip()
        if 15 < len(claim) < 80 and not claim.startswith('-'):
            claims.append(claim)

    # Deduplicate
    seen = set()
    unique_claims = []
    for c in claims:
        normalized = c.strip().lower()
        if normalized not in seen and normalized:
            seen.add(normalized)
            unique_claims.append(c.strip())

    return unique_claims


def swap_terms(text):
    """Swap technical terms in text to create a wrong statement."""
    for pattern, replacement in TERM_SWAPS:
        if re.search(pattern, text):
            return re.sub(pattern, replacement, text, count=1)
    return None


def negate(text):
    """Negate a statement."""
    for pos, neg in NEGATIONS:
        if pos in text:
            return text.replace(pos, neg, 1)
    return None


def create_mcq(question, answer, topic):
    """Create MCQ choices from answer content."""
    claims = extract_claims(answer)

    if len(claims) < 3:
        return None, None

    # Pick a claim for the correct answer
    correct = random.choice(claims)

    # Generate wrong options
    wrongs = []

    # Try term swaps on other claims
    shuffled = [c for c in claims if c != correct]
    random.shuffle(shuffled)

    for claim in shuffled[:5]:
        swapped = swap_terms(claim)
        if swapped and swapped != claim and swapped not in wrongs and len(swapped) > 10:
            wrongs.append(swapped)
        if len(wrongs) >= 3:
            break

    # Try negation
    if len(wrongs) < 3:
        for claim in shuffled:
            negated = negate(claim)
            if negated and negated != claim and negated not in wrongs and len(negated) > 10:
                wrongs.append(negated)
            if len(wrongs) >= 3:
                break

    # Use other claims as wrong (they're from different subtopics so still wrong in context)
    if len(wrongs) < 3:
        for claim in shuffled:
            if claim not in wrongs:
                wrongs.append(f"以上说法都不对，{claim}")
            if len(wrongs) >= 3:
                break

    # Ensure exactly 3 wrongs
    while len(wrongs) < 3:
        wrongs.append(f"相关概念与{topic}无关")

    # Shuffle all together
    all_options = [correct] + wrongs
    random.shuffle(all_options)
    correct_idx = all_options.index(correct)

    return all_options, correct_idx


def create_tf(question, answer, topic):
    """Create True/False statement from answer."""
    claims = extract_claims(answer)
    factual = [c for c in claims if 20 < len(c) < 80]

    if not factual:
        return None, None

    stmt = random.choice(factual)
    stmt = re.sub(r'\*\*(.*?)\*\*', r'\1', stmt).strip()

    # 50% true, 50% false
    if random.random() > 0.5:
        return ["正确", "错误"], 0  # true statement

    # Make it false
    false_stmt = swap_terms(stmt) or negate(stmt)
    if false_stmt and false_stmt != stmt:
        return ["正确", "错误"], 1  # false statement

    return ["正确", "错误"], 0


# Main processing
with open('scripts/questions_v2.json') as f:
    qs = json.load(f)

stats = {'mcq': 0, 'tf': 0, 'none': 0}
for q in qs:
    # Skip if already has choices
    if q.get('choices'):
        continue

    # Try MCQ first
    choices, correct_idx = create_mcq(q['question'], q['answer'], q['topic'])

    if choices:
        q['choices'] = choices
        q['correct_idx'] = correct_idx
        stats['mcq'] += 1
    else:
        # Fall back to T/F
        choices, correct_idx = create_tf(q['question'], q['answer'], q['topic'])
        if choices:
            q['choices'] = choices
            q['correct_idx'] = correct_idx
            stats['tf'] += 1
        else:
            stats['none'] += 1

with open('scripts/questions_v2.json', 'w') as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)

print(f"Results:")
print(f"  MCQ: {stats['mcq']}")
print(f"  T/F: {stats['tf']}")
print(f"  None: {stats['none']}")

# Show samples
print("\n=== Sample generated choices ===")
samples = [q for q in qs if q.get('choices')][:5]
for q in samples:
    print(f"\nQ: {q['question']}")
    print(f"Type: {'T/F' if len(q['choices']) == 2 else 'MCQ'} ({len(q['choices'])} options)")
    for i, c in enumerate(q['choices']):
        m = '✓' if i == q['correct_idx'] else '✗'
        print(f"  {m} {c[:70]}")
