#!/usr/bin/env python3
"""
Generate MCQ choices for ALL 121 questions in choices_batch_batch_os.json.
Each question gets: choices array (4 strings), correct_idx (0-3).

Uses per-subtopic wrong-option pools for high relevance and quality.
"""

import json
import random
import re

random.seed(42)

INPUT = "/Users/xkkk/Documents/FIRST CC/scripts/choices_batch_batch_os.json"

with open(INPUT, "r", encoding="utf-8") as f:
    questions = json.load(f)

def clean(s):
    s = re.sub(r'\*\*(.*?)\*\*', r'\1', s)
    s = re.sub(r'`(.*?)`', r'\1', s)
    return s.strip()

def extract_best_answer(answer):
    """Extract a concise, meaningful correct answer statement from the full answer."""
    raw_lines = answer.split('\n')

    def clean_text(s):
        """Strip markdown formatting for choice text."""
        s = re.sub(r'\*\*(.*?)\*\*', r'\1', s)
        s = re.sub(r'`(.*?)`', r'\1', s)
        s = re.sub(r'#{1,6}\s*', '', s)
        # Remove numbered list markers
        s = re.sub(r'^\d+[\.\)]\s+', '', s, flags=re.MULTILINE)
        # Collapse whitespace
        s = re.sub(r'\s+', ' ', s).strip()
        # Limit to reasonable length
        if len(s) > 120:
            s = s[:117] + '...'
        return s

    def is_pure_header(s):
        """Check if string is just a section header with no substantive content."""
        stripped = s.strip()
        stripped = stripped.lstrip('#').strip()
        if not stripped:
            return True
        parenthesized = re.match(r'^[^(（）]+(?:（[^）]+）|\([^)]+\))?$', stripped)
        if parenthesized and len(stripped) < 30:
            if not any(w in stripped for w in ['是', '指', '表示', '负责', '用于', '即', '包括']):
                return True
        if len(stripped) < 12 and not any(w in stripped for w in ['是', '指', '与', '的']):
            return True
        if stripped.rstrip().endswith(('：', ':')):
            return True
        # Skip pure table rows
        if stripped.startswith('|'):
            return True
        return False

    def is_definition_line(cleaned):
        """Check if line contains a definition indicator."""
        indicators = ['是', '指', '称为', '表示', '负责', '用于', '即', '就是', '位于', '属于',
                      '具有', '包含', '包括', '是指', '实现', '通过', '提供', '分为', '可以']
        return any(w in cleaned for w in indicators)

    def is_pure_markdown_table(s):
        """Check if line is a markdown table separator."""
        return bool(re.match(r'^\|[\s\-:]+\|', s))

    # Strategy 1: Find bold+definition patterns like "**定义：**内容"
    for line in raw_lines:
        match = re.match(r'\*\*(.*?)：\*\*\s*(.+)', line)
        if match:
            header = match.group(1).strip()
            content = match.group(2).strip()
            if len(content) > 15:
                return clean_text(content[:110])

    def is_table_sep(s):
        return bool(re.match(r'^\|[\s\-:]+\|', s))

    def is_numbered_line(s):
        return bool(re.match(r'^\d+[\.\)]\s+', s))

    # Strategy 2: Find substantive definition sentences (bullet points - best quality)
    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith(('- ', '* ')):
            content = stripped[2:].strip()
            # Try to extract content after "**Term**：" patterns
            after_colon = re.sub(r'^.*?[：:]\s*', '', content)
            # Use content after colon if non-empty, else full bullet content
            chosen = after_colon if len(after_colon) > 15 else content
            cleaned = clean_text(chosen)
            if len(cleaned) > 20 and is_definition_line(cleaned):
                return cleaned[:110]

    # Strategy 3: Find definition sentences in non-bullet/non-table lines
    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith(('-', '*', '>', '|', '#')):
            continue
        if is_table_sep(stripped) or is_numbered_line(stripped):
            continue
        cleaned = clean_text(line)
        if len(cleaned) < 25:
            continue
        if is_pure_header(cleaned):
            continue
        if is_definition_line(cleaned):
            return cleaned[:110]

    # Strategy 4: Find the first bold text that is a complete statement
    for line in raw_lines:
        bolds = re.findall(r'\*\*(.*?)\*\*', line)
        for b in bolds:
            b = b.strip()
            cleaned = clean_text(b)
            if 20 < len(cleaned) < 90 and is_definition_line(cleaned):
                return cleaned

    # Strategy 5: Clean first substantive non-header line
    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith(('|', '-', '>', '#', '*')):
            continue
        cleaned = clean_text(line)
        if len(cleaned) < 25:
            continue
        if not is_pure_header(cleaned):
            return cleaned[:110]

    return clean_text(answer)[:110]


# ---- COMPREHENSIVE PER-SUBTOPIC POOLS ----
# Each key matches a subtopic keyword; value is [correct_answer_keywords?, wrong1, wrong2, wrong3, ...]
# The first 3 wrong options are used as distractors

SUBTOPIC_POOLS = {}

# ════════════════════ 操作系统 ════════════════════

SUBTOPIC_POOLS["用户态"] = [
    "用户态程序可以直接访问硬件资源",
    "用户态到内核态的切换不需要保存上下文",
    "用户态与内核态切换的主要开销来自数据传输",
    "中断处理是在用户态完成的",
    "用户态程序拥有与内核态相同的系统权限",
    "系统调用不需要切换到内核态即可完成",
    "用户态程序可以直接修改系统内存数据",
    "软中断只能在用户态下被触发",
]

SUBTOPIC_POOLS["内核通信"] = [
    "系统调用是用户态与内核态通信的唯一方式",
    "共享内存通信不需要同步机制即可安全使用",
    "/proc文件系统适合高频的数据读写操作",
    "Netlink Socket只支持单向的数据通信",
    "信号可以在用户态和内核态之间传递大量数据",
    "mmap不能在用户态和内核态之间共享内存",
    "字符设备通信必须通过proc文件系统完成",
    "sysfs文件系统主要用于进程间通信",
]

SUBTOPIC_POOLS["原码"] = SUBTOPIC_POOLS["反码"] = SUBTOPIC_POOLS["补码"] = [
    "负数的原码是符号位不变其余位全部取反",
    "补码表示中仍然存在+0和-0两个零",
    "现代计算机统一使用原码进行算术运算",
    "反码表示中0只有一种表现形式",
    "补码的加减运算比原码更加复杂",
    "8位补码能表示的最大负数是-127",
    "原码是所有编码中加减运算最简单的",
    "反码表示中负数运算不需要循环进位",
]

SUBTOPIC_POOLS["内存碎片"] = [
    "外部碎片是指已分配内存块内部的未使用空间",
    "内部碎片是指内存中不连续的空闲内存块",
    "内存紧凑化操作会增加外部碎片的产生",
    "伙伴系统只能解决内部碎片问题无法解决外部碎片",
    "虚拟内存机制会加剧外部碎片问题",
    "Slab分配器主要解决的是外部碎片问题",
    "内存池技术会导致更严重的内存碎片化",
    "使用更大的分配单位可以有效减少内部碎片",
]

SUBTOPIC_POOLS["RTOS"] = [
    "RTOS推荐尽可能使用动态内存分配提高灵活性",
    "FreeRTOS不提供任何内存池管理功能",
    "TLSF分配算法比标准malloc更容易产生内存碎片",
    "C++中new和delete底层不使用malloc和free",
    "C++的RAII对象本身会导致严重的内存碎片化",
    "伙伴系统按3的幂次划分内存块",
    "使用智能指针可以完全解决内存碎片问题",
    "jemalloc和tcmalloc是完全相同的内存分配器",
]

SUBTOPIC_POOLS["嵌入式"] = [
    "嵌入式系统中动态内存分配的延迟是可预测的",
    "嵌入式系统中应优先使用动态内存分配",
    "嵌入式系统通常内存充足不需要考虑碎片问题",
    "嵌入式系统中堆内存管理不增加系统复杂性",
    "嵌入式实时系统通常使用malloc和free管理内存",
    "内存池分配方式会导致更多内存碎片",
    "嵌入式系统中静态分配灵活性更高推荐使用",
    "栈分配同样会导致严重的内存碎片问题",
]

SUBTOPIC_POOLS["进程与线程区别"] = SUBTOPIC_POOLS["进程、线程"] = [
    "同一进程的多个线程拥有各自独立的地址空间",
    "进程切换的开销比线程切换的开销更小",
    "同一进程的线程之间不能直接共享内存数据",
    "进程间通信比线程间通信更简单和高效",
    "一个线程崩溃不会影响同一进程内的其他线程",
    "线程拥有自己独立的文件描述符表",
    "进程之间可以直接访问彼此的内存数据",
    "创建线程的开销比创建进程的开销更大",
]

SUBTOPIC_POOLS["父进程"] = [
    "fork()后子进程拥有父进程内存的完全独立副本",
    "fork()后父子进程共享同一个进程PID",
    "父进程退出后子进程必然会被系统销毁",
    "fork()采用立即复制所有内存页面的方式",
    "子进程不能继承父进程打开的文件描述符",
    "写时复制技术在fork()时复制所有内存页面",
    "孤儿进程会一直存在永远无法被回收",
    "僵尸进程不影响系统进程表的正常使用",
]

SUBTOPIC_POOLS["线程的内存"] = [
    "Linux中pthread线程的默认栈大小为1MB",
    "Windows线程的默认栈大小为8MB",
    "FreeRTOS线程默认栈大小与Linux相同为8MB",
    "所有操作系统的线程默认栈大小完全相同",
    "线程控制块TCB通常占用几MB的内存空间",
    "线程栈越大越好没有任何负面影响",
    "线程局部存储TLS占用大量固定内存空间",
    "不同操作系统中线程内存占用完全相同",
]

SUBTOPIC_POOLS["编译过程"] = SUBTOPIC_POOLS["GCC"] = [
    "GCC编译的第一步是汇编阶段",
    "预处理阶段处理的是汇编代码文件",
    "编译阶段将目标文件链接为可执行文件",
    "GCC编译过程分为编译、汇编、链接三个阶段",
    "汇编阶段直接生成可执行文件",
    "链接阶段生成目标文件(.o)",
    "预处理阶段处理函数调用和栈帧管理",
    "gcc -S命令直接生成可执行文件",
]

SUBTOPIC_POOLS["进程状态"] = [
    "Linux中R状态表示进程处于休眠状态",
    "Linux中Z状态表示进程正在CPU上运行",
    "D状态的进程可以被信号唤醒",
    "S状态的进程不可被任何信号唤醒",
    "T状态表示进程已终止并释放所有资源",
    "I状态表示进程是僵尸进程",
    "X状态表示进程正在被调试器调试",
    "L状态标记表示低优先级进程",
]

SUBTOPIC_POOLS["选用"] = [
    "需要频繁共享数据时应优先使用多进程",
    "进程比线程更适合轻量级快速任务",
    "进程切换开销比线程切换开销更小",
    "线程比进程提供更好的安全性和隔离性",
    "多线程天然比多进程更稳定和可靠",
    "进程间通信比线程间通信效率更高",
    "实时性要求高的场景应使用多进程",
    "需要高可靠性的场景应使用多线程",
]

SUBTOPIC_POOLS["内存共享"] = [
    "共享内存不需要任何同步机制即可安全使用",
    "信号量不能用于进程间的同步操作",
    "互斥锁默认可以在不同进程间直接共享",
    "内存映射文件不能用于进程间通信",
    "原子操作不能保证操作的不可分割性",
    "POSIX共享内存创建后不需要关联到进程",
    "读写锁允许多个写者同时操作共享资源",
    "消息队列可以传递大量结构化数据",
]

SUBTOPIC_POOLS["FreeRTOS"] = [
    "FreeRTOS是一种通用操作系统",
    "Linux的实时性比FreeRTOS更好",
    "Windows操作系统采用微内核架构",
    "FreeRTOS支持完整的虚拟内存管理",
    "FreeRTOS支持完整的文件系统功能",
    "Linux内核不支持任何实时扩展",
    "FreeRTOS使用宏内核架构",
    "Windows比FreeRTOS更适合实时控制场景",
]

SUBTOPIC_POOLS["CPU内核"] = [
    "Cortex-M系列面向高性能应用处理器",
    "Cortex-A系列面向低功耗微控制器",
    "Cortex-R系列面向低功耗嵌入式MCU",
    "x86架构采用精简指令集RISC设计",
    "RISC-V指令集架构是闭源商业产品",
    "MIPS是目前最主流的嵌入式架构",
    "DSP内核主要用于通用计算任务",
    "PowerPC主要用于移动端处理器",
]

SUBTOPIC_POOLS["多进程"] = [
    "多进程的创建和切换开销比多线程更小",
    "多进程的数据共享比多线程更方便直接",
    "多线程比多进程提供更好的系统稳定性",
    "多线程之间的通信必须使用IPC机制",
    "多进程天然支持高并发且开销较低",
    "多线程的调试比多进程更加容易",
    "多线程的同步机制比多进程更复杂",
    "多进程占用的系统资源比多线程更少",
]

SUBTOPIC_POOLS["崩溃"] = [
    "一个线程崩溃绝对不会影响其他线程",
    "线程崩溃后系统会自动释放所有资源",
    "栈溢出不会导致线程崩溃",
    "死锁不会导致线程崩溃",
    "线程崩溃后共享资源自动恢复到一致状态",
    "主线程崩溃不会导致整个进程退出",
    "多核系统中一个线程崩溃会影响其他核心",
    "操作系统在线程崩溃时会自动释放所有锁",
]

SUBTOPIC_POOLS["进程上下文"] = [
    "线程上下文切换也需要切换页表",
    "进程上下文切换不需要保存虚拟内存信息",
    "进程上下文只包含CPU的寄存器信息",
    "线程上下文切换的开销比进程上下文更大",
    "进程上下文不包含程序计数器PC",
    "进程上下文切换的频率比线程更高",
    "进程上下文切换不需要操作系统内核参与",
    "线程上下文切换需要切换整个地址空间",
]

SUBTOPIC_POOLS["中断上下文"] = [
    "中断上下文中可以进行阻塞操作",
    "中断上下文中可以进行线程调度",
    "中断上下文是可重入的可以嵌套",
    "中断上下文中可以调用sleep函数睡眠",
    "中断上下文中可以使用标准互斥锁",
    "中断上下文可以执行任意耗时操作",
    "中断上下文有自己的进程控制块PCB",
    "中断上下文中可以动态分配内存",
]

SUBTOPIC_POOLS["异常"] = [
    "中断是同步事件由程序内部触发",
    "异常是异步事件由外部硬件触发",
    "中断和异常都是同步事件",
    "中断是不可屏蔽的",
    "异常是可屏蔽的可被忽略",
    "中断和异常都是不可恢复的",
    "中断由程序内部指令错误触发",
    "外部硬件中断和软中断没有本质区别",
]

SUBTOPIC_POOLS["中断处理"] = [
    "中断处理函数中可以执行长时间计算",
    "中断处理函数中可以调用sleep等待资源",
    "中断处理函数中适合做动态内存分配",
    "中断处理时间越长系统效率和响应越快",
    "中断处理函数中推荐使用互斥锁保护数据",
    "中断处理函数中可以进行文件读写操作",
    "长ISR可以提高系统的实时响应能力",
    "中断处理函数中可以进行网络传输操作",
]

SUBTOPIC_POOLS["软中断"] = [
    "硬中断是由软件程序主动触发的中断",
    "软中断是由外部硬件设备触发的中断",
    "硬中断和软中断都是同步事件",
    "软中断的优先级高于硬中断",
    "硬中断可用于实现操作系统系统调用",
    "软中断主要用于处理硬件I/O事件",
    "硬中断和软中断的响应速度完全相同",
    "硬中断不可嵌套执行",
]

SUBTOPIC_POOLS["中断嵌套"] = [
    "中断嵌套会降低系统栈溢出的风险",
    "所有嵌入式系统默认支持无限级中断嵌套",
    "中断嵌套使系统行为更可预测和简单",
    "中断嵌套中高优先级不能打断低优先级",
    "中断嵌套不需要保存和恢复上下文",
    "中断嵌套过程中CPU默认禁用所有中断",
    "中断嵌套减少了系统的整体复杂度",
    "中断嵌套不可能导致栈溢出问题",
]

SUBTOPIC_POOLS["实时进程"] = [
    "普通进程的优先级总是高于实时进程",
    "SCHED_FIFO是普通进程的默认调度策略",
    "实时进程可以容忍任意长时间的超时延迟",
    "硬实时进程允许偶尔的deadline超时",
    "普通进程也使用SCHED_FIFO实时调度策略",
    "实时进程不需要确定性的调度保证",
    "SCHED_BATCH是实时进程的专用调度策略",
    "SCHED_DEADLINE用于批处理任务调度",
]

SUBTOPIC_POOLS["同步机制"] = [
    "自旋锁在等待锁时会让出CPU进入睡眠状态",
    "互斥锁在等待锁时采用忙等待轮询方式",
    "读写锁不允许同时读取数据",
    "条件变量可以单独使用不需要互斥锁配合",
    "信号量只能用于互斥不能用于同步",
    "原子操作需要配合锁机制才能使用",
    "屏障的主要作用是保护共享数据",
    "互斥锁适用于临界区极短的场景",
]

SUBTOPIC_POOLS["IPC"] = [
    "管道可以用于任意两个进程间通信",
    "共享内存是速度最慢的IPC方式",
    "消息队列不区分消息的边界",
    "信号可以传递大量结构化数据",
    "命名管道只能用于父子进程通信",
    "Socket只能用于同一台机器的进程通信",
    "信号量主要用于进程间的大批量数据传输",
    "共享内存不需要额外的同步机制",
]

SUBTOPIC_POOLS["死锁"] = [
    "死锁是指进程不断改变状态但无法完成任务",
    "活锁是指进程被完全阻塞无法执行任何操作",
    "破坏互斥条件可以预防所有类型的死锁",
    "银行家算法用于检测系统中已发生的死锁",
    "活锁中进程不占用资源也不执行任何操作",
    "死锁的循环等待条件不是四个必要条件之一",
    "死锁预防是在检测到死锁后执行的恢复策略",
    "活锁比死锁更容易诊断和修复",
]

SUBTOPIC_POOLS["自旋锁"] = [
    "自旋锁在等待锁时会让出CPU并进入阻塞",
    "互斥锁的等待方式是忙等待不释放CPU",
    "自旋锁在单核CPU系统中效率最高",
    "自旋锁会发生上下文切换",
    "互斥锁适用于临界区极短的场景",
    "自旋锁适用于临界区较长的场景",
    "临界区长且多核时应优先使用自旋锁",
    "互斥锁不会导致上下文切换开销",
]

SUBTOPIC_POOLS["临界区"] = [
    "临界区允许多个线程同时执行代码",
    "临界区中的共享资源不需要互斥保护",
    "临界区只保护线程不保护进程资源",
    "临界区只涉及函数的局部变量",
    "临界区代码可以安全地多线程并行执行",
    "临界区中的操作没有数据竞争风险",
    "临界区代码越多系统性能越好",
    "进入临界区后不需要退出的操作",
]

SUBTOPIC_POOLS["线程同步"] = [
    "线程同步和互斥是完全相同的概念",
    "同步的目的是防止多个线程同时访问共享资源",
    "互斥的目的是协调多个线程的执行顺序",
    "条件变量用于线程间的互斥保护",
    "信号量不能用于线程之间的同步",
    "屏障主要用于保护共享数据",
    "互斥锁不需要与条件变量配合使用",
    "读写锁不允许同时读取数据",
]

SUBTOPIC_POOLS["阻塞"] = [
    "线程同步一定会导致线程阻塞",
    "线程阻塞一定是由同步机制引起的",
    "自旋锁会导致线程阻塞挂起",
    "I/O阻塞通常涉及线程同步问题",
    "非阻塞同步在操作系统中不存在",
    "使用互斥锁时线程一定会阻塞等待",
    "阻塞和线程挂起是完全相同的概念",
    "条件变量等待不会导致线程阻塞",
]

SUBTOPIC_POOLS["互斥量"] = [
    "普通互斥量默认可以在进程间直接共享",
    "跨进程互斥量不需要放在共享内存中",
    "信号量不能用于进程间的互斥操作",
    "pthread_mutexattr_setpshared设置线程内共享",
    "System V信号量不能实现互斥功能",
    "跨进程互斥量不需要设置PROCESS_SHARED",
    "进程间互斥只能通过信号量实现",
    "普通互斥量可以直接在不同进程间使用",
]

SUBTOPIC_POOLS["并发"] = [
    "并发和并行是完全相同的概念",
    "同步是指发起任务后无需等待可继续执行",
    "异步是指调用者必须等待任务完成",
    "互斥是用于协调任务执行顺序的机制",
    "阻塞操作会立即返回不阻塞调用者",
    "非阻塞操作会挂起调用线程等待",
    "并发一定需要多核CPU硬件支持",
    "同步和异步是互斥的两种不同形式",
]

SUBTOPIC_POOLS["fork()"] = [
    "fork()后父子进程有完全独立的物理内存",
    "写时复制在fork()时复制所有内存页面",
    "fork()后父子进程共享文件描述符偏移量",
    "子进程的PID与父进程的PID完全相同",
    "COW机制在子进程创建时复制所有页面",
    "fork()后父子进程有不同地址空间布局",
    "fork()后父子进程不共享任何物理页面",
    "写时复制只在父进程写入时触发",
]

SUBTOPIC_POOLS["vfork"] = SUBTOPIC_POOLS["clone"] = [
    "fork()不复制父进程的地址空间",
    "vfork()会复制父进程的完整地址空间",
    "clone()不能控制子进程与父进程的资源共享",
    "vfork()后父进程不被阻塞继续执行",
    "vfork()中父子进程拥有独立地址空间",
    "clone()只能用于创建进程不能创建线程",
    "fork()比vfork()在创建后立即exec时效率更高",
    "clone()的CLONE_VM标志表示不共享内存",
]

SUBTOPIC_POOLS["程创造的数量"] = [
    "线程数量只受CPU核心数限制不受内存限制",
    "创建线程时线程栈必须使用默认大小",
    "实际应用中线程数量越多系统性能越好",
    "Linux默认栈大小下2GB空间可创建约256个线程",
    "线程数量不受操作系统内核参数限制",
    "线程栈大小不能通过API动态调整",
    "所有操作系统的线程默认栈大小完全相同",
    "线程数量与虚拟内存空间大小无关",
]

SUBTOPIC_POOLS["孤儿进程"] = [
    "僵尸进程的子进程会成为孤儿进程",
    "守护进程必须有控制终端才能运行",
    "僵尸进程的父进程退出后僵尸自动清除",
    "守护进程通过调用setsid()创建",
    "init进程不会收养系统的孤儿进程",
    "孤儿进程由内核自动回收不需要处理",
    "僵尸进程可以通过kill -9命令清除",
    "守护进程由init进程直接管理",
]

SUBTOPIC_POOLS["查看进程"] = [
    "top命令默认显示的是线程视图",
    "ps命令STAT字段的R表示进程已死亡",
    "htop中按F2可以切换到树状视图",
    "/proc文件系统是真实存储在磁盘上的",
    "僵尸进程可以通过kill -9命令清除",
    "ps aux不能显示所有进程信息",
    "/proc/PID/task目录包含线程信息",
    "pstree命令显示进程的CPU使用率",
]

SUBTOPIC_POOLS["调度算法"] = [
    "FCFS先来先服务属于抢占式调度算法",
    "SJF短作业优先不存在长作业饥饿问题",
    "时间片轮转RR属于非抢占式调度",
    "优先级调度中低优先级进程必然被饿死",
    "多级队列调度中各队列使用相同调度策略",
    "RR调度的时间片越短系统效率越高",
    "FCFS的平均等待时间总是所有算法中最短的",
    "SRTF抢占式短作业优先不需要预知运行时间",
]

SUBTOPIC_POOLS["调度算法场景"] = SUBTOPIC_POOLS["进程调度算法"] = [
    "只有实时操作系统才需要进程调度算法",
    "批处理系统中不适合使用FCFS先来先服务",
    "交互式系统最适合使用FCFS算法",
    "单任务操作系统也需要进程调度算法",
    "实时操作系统不需要进程调度算法",
    "多核系统中不需要进程调度算法",
    "所有系统都应使用完全相同的调度策略",
    "批处理系统适合使用时间片轮转调度",
]

SUBTOPIC_POOLS["调度策略"] = [
    "CFS完全公平调度器基于时间片轮转方式",
    "CFS使用链表来管理所有可运行进程",
    "进程vruntime值越大调度优先级越高",
    "SCHED_FIFO是Linux默认调度策略",
    "SCHED_BATCH适用于实时任务调度",
    "CFS的时间片长度是固定不变的",
    "CFS采用优先级队列来调度进程",
    "SCHED_RR适用于批处理任务",
]

SUBTOPIC_POOLS["优先级反转"] = [
    "优先级继承会将高优先级任务的优先级降低",
    "优先级天花板协议不需要资源设定天花板优先级",
    "优先级反转只影响低优先级任务的执行",
    "无锁设计技术不能解决优先级反转",
    "优先级反转在实际系统中不可能发生",
    "优先级继承不影响低优先级任务的优先级",
    "优先级反转不需要中等优先级任务参与",
    "优先级天花板会降低持有资源的优先级",
]

SUBTOPIC_POOLS["用户空间和内核空间"] = [
    "32位x86中用户空间通常为1GB内核空间为3GB",
    "64位系统中用户空间与内核空间各占一半",
    "用户态程序可以直接访问内核空间的数据",
    "内核空间和用户空间划分在所有硬件架构上完全相同",
    "用户空间程序通过系统调用直接访问硬件",
    "x86架构中内核空间位于低地址区域",
    "所有32位系统的用户/内核划分都是3GB/1GB",
    "用户空间和内核空间共享同一张页表映射",
]

SUBTOPIC_POOLS["物理地址"] = [
    "虚拟地址和物理地址是一一对应的固定映射",
    "每个进程看到的物理地址空间完全相同",
    "物理地址由操作系统动态分配而非硬件固定",
    "无MMU的MCU也使用虚拟地址机制",
    "应用程序可以直接操作物理地址",
    "物理地址是给程序使用的逻辑地址",
    "MMU将物理地址转换为虚拟地址",
    "物理地址在不同进程之间相互隔离",
]

SUBTOPIC_POOLS["虚拟内存"] = [
    "虚拟内存和物理内存是完全相同的概念",
    "虚拟内存大小不能超过物理内存容量",
    "虚拟内存只存在于有MMU的硬件系统中",
    "合理扩大swap可以无限提高系统性能",
    "嵌入式Linux通常不使用虚拟内存机制",
    "虚拟内存的主要缺点是不安全",
    "所有嵌入式系统都支持虚拟内存",
    "虚拟内存开启后不影响内存访问速度",
]

SUBTOPIC_POOLS["页表"] = [
    "单级页表比多级页表占用更少的内存",
    "页表项不包含页面的访问权限信息",
    "页表只负责地址映射不提供内存隔离",
    "反向页表按虚拟地址组织",
    "Linux x86_64使用三级页表",
    "多级页表会增加页表占用的总内存",
    "页表脏位用于控制页面读写权限",
    "有效位表示页面是否在CPU缓存中",
]

SUBTOPIC_POOLS["缺页"] = [
    "缺页中断只发生在程序首次访问页面时",
    "缺页中断处理不需要更新系统页表",
    "页面抖动时系统性能不会明显下降",
    "缺页中断由软件触发而非硬件触发",
    "写时复制操作不会触发缺页中断",
    "缺页中断一定会导致程序崩溃",
    "缺页中断只能从磁盘加载页面",
    "缺页中断不影响系统整体性能",
]

SUBTOPIC_POOLS["虚拟地址映射"] = [
    "虚拟地址到物理地址的映射由CPU独立完成",
    "每个进程共享操作系统同一张页表",
    "页内偏移参与页表查询过程",
    "MMU硬件不参与地址转换过程",
    "虚拟地址映射不支持按需分配物理内存",
    "缺页中断与虚拟地址映射机制无关",
    "Linux页大小固定为4KB不可更改",
    "虚拟地址转换不需要操作系统维护页表",
]

SUBTOPIC_POOLS["段页式"] = [
    "段页式管理只支持分段不支持分页",
    "纯分页比段页式更适合程序逻辑结构",
    "纯分段可以完全解决内存碎片问题",
    "段页式管理不能支持大地址空间",
    "段页式中段不可按需动态增长",
    "段页式比纯分页占用更少内存",
    "段页式不支持细粒度内存保护",
    "段页式逻辑地址不需要页内偏移量",
]

SUBTOPIC_POOLS["栈溢出"] = [
    "栈溢出只可能发生在堆内存上",
    "递归调用函数不会导致栈溢出问题",
    "增加堆内存大小可以解决栈溢出问题",
    "栈溢出比堆溢出更容易形成安全漏洞",
    "局部变量过多不会导致栈溢出",
    "堆溢出和栈溢出的根本原因完全相同",
    "使用迭代代替递归不能防止栈溢出",
    "栈溢出是由程序员显式管理的内存问题",
]

SUBTOPIC_POOLS[".so"] = [
    "静态库.a比动态库.so更节省内存空间",
    ".so文件的代码在运行时被复制到每个进程",
    "动态链接程序启动速度比静态链接更快",
    "静态库更新时不需要重新编译程序",
    "LD_LIBRARY_PATH环境变量优先级高于RPATH",
    "动态库加载顺序中/lib目录优先级最高",
    ".so文件只能在编译时被链接",
    "静态库.a不能实现代码复用",
]

SUBTOPIC_POOLS["静态链接"] = [
    "静态链接生成的可执行文件比动态链接更小",
    "动态链接的程序不依赖外部库文件",
    "静态链接程序启动速度比动态链接更慢",
    "动态链接程序在多个进程间共享库代码",
    "嵌入式裸机开发通常使用动态链接",
    "静态链接更新库时不需要重新编译程序",
    "动态链接的缺点是磁盘空间占用更大",
    "静态链接支持运行时加载插件",
]

SUBTOPIC_POOLS["静态存储"] = [
    "栈Stack存储属于静态存储",
    "静态存储在程序运行时分配内存",
    "动态存储在编译时确定大小",
    "静态变量使用后需要手动释放内存",
    "全局变量存储在栈Stack上",
    "静态存储的生命周期由程序员控制",
    "const常量存储在堆Heap上",
    "静态局部变量的作用域是全局的",
]

SUBTOPIC_POOLS["LRU"] = [
    "LRU算法淘汰最近最常被访问的页面",
    "LRU算法的实现开销很小适合嵌入式系统",
    "LRU使用哈希表保证O(n)时间查找",
    "LRU缓存淘汰时移除链表头节点",
    "LRU的命中率低于FIFO置换算法",
    "LRU中链表尾部存储最近访问的页面",
    "LRU不需要任何硬件支持即可高效实现",
    "LRU算法总是淘汰最新被访问的页面",
]

SUBTOPIC_POOLS["VFS"] = [
    "VFS中inode结构存储文件名和目录项信息",
    "VFS中dentry结构存储文件实际数据内容",
    "VFS不能同时挂载多种不同类型的文件系统",
    "VFS提供统一文件操作接口",
    "VFS层负责实际的磁盘数据读写",
    "VFS中file结构存储文件元信息",
    "VFS只在Linux操作系统中存在",
    "VFS不支持文件系统动态挂载卸载",
]

# ════════════════════ 计算机网络 ════════════════════

SUBTOPIC_POOLS["OSI"] = [
    "OSI数据链路层负责路由选择和转发",
    "OSI传输层负责比特流的物理传输",
    "OSI网络层负责端到端的可靠通信",
    "表示层负责建立和管理会话连接",
    "会话层负责数据加密和格式转换",
    "物理层负责将比特流封装成帧",
    "应用层负责数据的可靠传输",
    "数据链路层使用IP地址进行寻址",
]

SUBTOPIC_POOLS["TCP/IP"] = [
    "TCP/IP应用层仅对应OSI模型的应用层",
    "TCP/IP网络接口层对应OSI的传输层",
    "TCP/IP参考模型共有七层",
    "TCP/IP传输层只包含TCP协议",
    "IP协议提供可靠的端到端数据传输",
    "TCP/IP网络层负责MAC地址寻址",
    "TCP/IP模型比OSI模型更加复杂",
    "TCP/IP四层模型比OSI多一层",
]

SUBTOPIC_POOLS["CS模型"] = [
    "P2P模型中存在中心服务器控制节点",
    "CS模型中每个节点既是客户端又是服务器",
    "CS模型比P2P模型有更好的扩展性",
    "P2P模型中控制权由服务器集中控制",
    "CS模型天然适合去中心化应用场景",
    "CS模型中资源由所有参与者共同共享",
    "P2P模型不适合大量网络节点场景",
    "CS模型不支持服务器统一管理数据",
]

SUBTOPIC_POOLS["网络层"] = [
    "应用层负责IP地址分配和路由选择",
    "传输层负责定义HTTP等应用协议格式",
    "网络层通过端口号区分不同应用进程",
    "网络层只解决同网络内的数据转发",
    "传输层不允许使用不可靠传输方式",
    "应用层协议不包括FTP和SMTP",
    "网络层不提供任何差错检测功能",
    "应用层数据不需要封装即可传输",
]

SUBTOPIC_POOLS["封装"] = [
    "数据封装时传输层添加的是IP协议头",
    "封装时网络层添加帧头和帧尾",
    "解封装时先去掉应用层协议头",
    "数据链路层封装添加传输层头",
    "网络层封装后生成的数据称为帧",
    "封装和解封装是同一种操作的反复",
    "传输层封装后生成IP数据包",
    "应用层数据不需要封装直接发送",
]

SUBTOPIC_POOLS["TCP/IP协议"] = [
    "IP协议提供可靠的面向连接数据传输",
    "TCP是无连接的传输协议",
    "IPv6地址长度为32位",
    "TCP不保证数据的顺序到达",
    "IP协议确保数据包按顺序到达",
    "TCP/IP协议族只包含TCP和IP两个协议",
    "IPv4地址长度为128位",
    "TCP和UDP都提供可靠的数据传输",
]

SUBTOPIC_POOLS["子网掩码"] = [
    "子网掩码中0对应网络位1对应主机位",
    "IP地址和子网掩码按位或得到网络号",
    "广播地址的主机位全部为0",
    "子网掩码255.255.255.0有16位网络位",
    "/24表示子网掩码中有24位0",
    "不同子网的设备网络号可以相同",
    "子网掩码不能用于划分广播域",
    "子网掩码的作用是加密IP地址",
]

SUBTOPIC_POOLS["MAC地址"] = [
    "MAC地址长度是32位二进制数",
    "MAC地址属于网络层Layer 3地址",
    "IP地址是固定不变的硬件地址",
    "MAC地址由DHCP服务器动态分配",
    "MAC地址的作用是跨网段路由",
    "IP地址由网卡制造商烧录固定",
    "MAC地址和IP地址的长度相同",
    "MAC地址可以在不同网络中改变",
]

SUBTOPIC_POOLS["UDP"] = [
    "UDP协议保证数据可靠有序到达",
    "TCP的实时性比UDP更好",
    "TCP适用于实时音视频传输场景",
    "UDP适用于需要可靠数据完整性的场景",
    "TCP不提供任何流量控制功能",
    "UDP比TCP更适合固件OTA升级",
    "TCP的传输效率比UDP更高",
    "UDP需要三次握手建立连接",
]

SUBTOPIC_POOLS["三次握手"] = [
    "两次握手同样可以建立可靠的TCP连接",
    "第三次握手用于传输主要的业务数据",
    "TCP三次握手的目的是协商应用层协议",
    "三次握手不涉及初始序列号的同步",
    "客户端收到SYN-ACK后连接立即建立成功",
    "第一次握手中客户端发送ACK确认包",
    "三次握手后双方可以直接传输数据",
    "服务器收到SYN后直接进入ESTABLISHED状态",
]

SUBTOPIC_POOLS["四次挥手"] = [
    "四次挥手过程中服务器不能再发送数据",
    "四次挥手后客户端立即进入CLOSED状态",
    "TIME_WAIT状态目的是尽快释放端口资源",
    "四次挥手实际上只需要三次报文交换",
    "客户端断开时只发送一次FIN报文即可",
    "四次挥手后服务器先进入TIME_WAIT",
    "FIN_WAIT_2状态下不能收发任何数据",
    "CLOSE_WAIT状态由主动关闭方进入",
]

SUBTOPIC_POOLS["可靠机制"] = [
    "TCP校验和用于保证数据的有序到达",
    "滑动窗口机制主要用于网络拥塞控制",
    "收到重复ACK后发送方不会立即重传",
    "TCP确认应答中接收方不需要回复ACK",
    "序列号机制只能解决数据丢失问题",
    "TCP可靠机制不包括流量控制功能",
    "超时重传的RTO值是固定不变的",
    "TCP数据分段工作由应用层完成",
]

SUBTOPIC_POOLS["HTTPS"] = [
    "HTTPS的默认端口号是80",
    "HTTP协议比HTTPS协议更加安全",
    "HTTPS只在应用层加密数据",
    "HTTPS不需要验证服务器身份",
    "HTTPS性能与HTTP完全相同",
    "HTTPS使用非对称加密传输所有数据",
    "HTTPS的TLS握手在TCP握手之前完成",
    "HTTP协议也默认使用443端口",
]

SUBTOPIC_POOLS["DNS"] = [
    "根DNS服务器直接返回域名的IP地址",
    "浏览器首先向本地DNS服务器发送请求",
    "DNS解析只需一次查询即可完成",
    "操作系统先查浏览器DNS缓存",
    "DNS缓存不会提高解析速度",
    "权威DNS服务器是全球唯一的存在",
    "DNS解析不需要经过顶级域名服务器",
    "浏览器缓存是DNS查询的最后一步",
]

SUBTOPIC_POOLS["ARP"] = [
    "ARP请求是单播发送的",
    "ARP响应是广播发送的",
    "ARP缓存中的映射关系永久有效",
    "ARP协议工作在应用层",
    "ARP请求包含目标IP对应的MAC地址",
    "ARP协议工作在传输层",
    "ARP将MAC地址转换为IP地址",
    "ARP响应是广播帧",
]

SUBTOPIC_POOLS["高并发"] = [
    "select函数比epoll更适合高并发场景",
    "线程池应创建尽可能多的线程来处理请求",
    "短连接比长连接更适合高并发场景",
    "epoll基于轮询机制工作",
    "I/O多路复用只能监听单个socket",
    "poll比select的文件描述符限制更严格",
    "HTTP Keep-Alive会增加连接建立开销",
    "高并发场景不应限制最大连接数",
]

SUBTOPIC_POOLS["WebSocket"] = [
    "WebSocket是基于UDP的应用层协议",
    "Socket是应用层协议",
    "WebSocket需要安装浏览器插件",
    "WebSocket是半双工通信",
    "Socket连接不需要管理连接状态",
    "WebSocket握手没有标准规范",
    "WebSocket传输使用HTTP格式",
    "Socket通信不需要IP地址和端口号",
]

SUBTOPIC_POOLS["流量控制"] = [
    "流量控制目的是避免网络拥塞",
    "发送窗口大小由发送方单方面决定",
    "流量控制主要在发送方执行",
    "接收窗口在网络拥塞时自动调整",
    "滑动窗口大小在传输过程中固定不变",
    "流量控制和拥塞控制是完全相同的概念",
    "以太网流量控制通过端口号实现",
    "拥塞控制通过调整发送方缓冲区实现",
]

SUBTOPIC_POOLS["拥塞控制"] = [
    "慢启动阶段拥塞窗口线性增长",
    "拥塞避免阶段拥塞窗口指数增长",
    "快重传后拥塞窗口恢复初始值1MSS",
    "快重传需要等待超时定时器到期",
    "TCP拥塞控制只包含慢启动一个算法",
    "快速恢复阶段拥塞窗口保持不变",
    "慢启动阈值在发生丢包后增大",
    "拥塞控制只在慢启动阶段有效",
]

SUBTOPIC_POOLS["粘包"] = [
    "UDP协议同样存在粘包问题",
    "固定长度包是解决粘包最灵活的方法",
    "Nagle算法会减少粘包问题的发生",
    "TCP粘包是指数据被拆分成多个小包",
    "特殊分隔符适合二进制数据传输",
    "包头长度字段不能解决粘包问题",
    "粘包是UDP协议的固有特性",
    "发送方缓冲区不会导致粘包",
]

SUBTOPIC_POOLS["socket"] = [
    "Socket工作在应用层",
    "Socket编程中服务器不需要绑定端口",
    "UDP Socket需要调用listen()等待连接",
    "TCP Socket建立后数据传输不需要确认",
    "五元组不包括传输层协议类型",
    "Socket通信要素不包括端口号",
    "Socket是传输层协议",
    "UDP Socket需要建立连接才能通信",
]

SUBTOPIC_POOLS["socket网络编程"] = [
    "TCP服务器端不需要调用bind()",
    "TCP客户端需要调用listen()监听",
    "UDP服务器需要调用accept()接收客户端",
    "TCP客户端先于服务器调用accept()",
    "socket关闭操作只能使用close()",
    "服务器端不需要创建socket",
    "send()和recv()只能用于UDP",
    "connect()只能由服务器端调用",
]

SUBTOPIC_POOLS["多线程socket"] = [
    "每个线程独立socket不能避免竞态条件",
    "多线程共享socket不需要任何同步机制",
    "多线程socket编程中不会出现死锁",
    "工作线程直接从主线程获取任务",
    "无锁设计在高性能场景不适用",
    "多线程写入同一socket无需互斥",
    "线程池会增加线程创建销毁开销",
    "原子操作不能用于socket编程",
]

SUBTOPIC_POOLS["以太网"] = [
    "MAC地址长度为64位",
    "以太网帧数据部分最大1500字节",
    "IP协议工作在数据链路层",
    "以太网帧使用MD5校验",
    "MAC地址是网络层逻辑地址",
    "以太网帧类型字段用于CRC校验",
    "冲突检测是网络层的功能",
    "以太网帧目的地址是IP地址",
]

SUBTOPIC_POOLS["数据安全"] = [
    "对称加密的密钥管理比非对称更简单",
    "数字签名不能保证数据完整性",
    "时间戳无法防范重放攻击",
    "防火墙主要用于数据加密解密",
    "数据完整性指防止未授权方读取",
    "VPN使用明文传输数据",
    "TLS/SSL使用非对称加密传输所有数据",
    "哈希函数可以用于数据加密",
]

SUBTOPIC_POOLS["OTA"] = [
    "OTA升级不需要数据校验机制",
    "差分升级每次传输完整固件包",
    "OTA升级中断网络不影响升级",
    "OTA升级中数字签名可有可无",
    "固件升级包不需要压缩处理",
    "OTA升级应用层协议不需要考虑",
    "OTA升级不需要处理多设备并发",
    "OTA只适用于Wi-Fi网络环境",
]

def find_pool(subtopic, topic):
    """Find the best matching wrong-option pool."""
    st = subtopic.lower() if subtopic else ""
    tp = topic.lower() if topic else ""

    # Check for truncated/partial subtopics by doing fuzzy matching
    # Some subtopic strings seem to have missing leading characters
    # Truncated/partial subtopic fixes - order MATTERS (specific first)
    truncated_fixes = [
        ("一一个线程的内存一般多大", "线程的内存"),
        ("一一个线程", "线程的内存"),
        ("一一个", "线程的内存"),
        ("中中断上下文", "中断上下文"),
        ("中中断嵌套", "中断嵌套"),
        ("中中断上下文中能否使用互斥锁", "中断上下文"),
        ("中中断上下文中能否使用互斥锁？", "中断上下文"),
        ("为什么中中断上下文不能使用互斥锁", "中断上下文"),
        ("中中断", "中断上下文"),
        ("程之间的通信IPC", "IPC"),
        ("程之间的通信", "IPC"),
        ("程之间的同步机制", "同步机制"),
        ("程创造的数量", "线程数量"),
        ("程创造", "线程数量"),
        ("程同步与阻塞", "阻塞"),
        ("程同步", "线程同步"),
        ("程崩溃", "崩溃"),
        ("CC的编译过程", "编译过程"),
        ("CC的编译", "编译过程"),
        ("PU内核", "CPU内核"),
        ("嵌入式设备网络升级", "OTA"),
        ("嵌入式常用 TCP/UDP", "UDP"),
        ("嵌入式系统", "嵌入式"),
        ("入式系统中为什么要尽量避免动态内存分配？", "嵌入式"),
        ("入式系统", "嵌入式"),
        ("入式", "嵌入式"),
        ("时进程", "实时进程"),
        ("断和异常的区别", "中断和异常"),
        ("断和异常", "中断和异常"),
        ("断处理函数中为什么不能做耗时操作？", "中断处理"),
        ("断处理函数", "中断处理"),
        ("中断和硬中断", "软中断"),
        ("存碎片", "内存碎片"),
        ("存共享", "内存共享"),
        ("存溢出", "栈溢出"),
        ("溢出、堆溢出", "栈溢出"),
        ("作系统、C++、RTOS怎么解决内存碎片的", "内存碎片"),
        ("么是缺页中断？", "缺页"),
        ("么是缺页中断", "缺页"),
        ("么是临界区？", "临界区"),
        ("么是临界区", "临界区"),
        ("拟文件系统", "VFS"),
        ("先级反转", "优先级反转"),
        ("户态", "用户态"),
        ("孤儿进程", "孤儿进程"),
        ("inux 中查看进程", "查看进程"),
        ("inux 中查看", "查看进程"),
        ("inux 默认使用什么调度策略？", "调度策略"),
        ("inux 默认使用", "调度策略"),
        ("inux 内存的用户空间", "用户空间和内核空间"),
        ("inux 内存的用户空间和内核空间如何划分", "用户空间和内核空间"),
        ("AC 地址", "MAC地址"),
        ("据在网络中是如何逐层封装", "封装"),
        ("用层、传输层、网络层分别解决什么问题", "网络层"),
        ("用层", "网络层"),
        ("什么 TCP 需要三次握手，而不是两次", "三次握手"),
        ("什么 TCP 需要三次握手", "三次握手"),
        ("什么 TCP 断开连接是四次挥手，而不是三次", "四次挥手"),
        ("什么 TCP 断开连接", "四次挥手"),
        ("CP的拥塞控制", "拥塞控制"),
        ("何应对短连接", "高并发"),
        ("说说 WebSocket", "WebSocket"),
        ("太网协议栈", "以太网"),
        ("么是临界区", "临界区"),
        ("子进程的关系及区别", "父进程"),
        ("多线程socket编程", "多线程socket"),
        ("多线程socket编程中", "多线程socket"),
        ("什么时候不建议使用多线程", "选用"),
        ("程选用的时机", "选用"),
        ("什么时候会用到进程调度算法", "调度算法场景"),
        ("动态内存分配", "嵌入式"),
        ("为什么需要用户态与内核态分离", "用户态"),
        ("为什么计算机使用补码", "原码"),
        ("为什么线程多了容易BOOM", "线程的内存"),
        ("为什么线程多了容易BOOM", "线程的内存"),
        ("为什么线程多了", "线程的内存"),
        ("如何控制线程内存占用", "线程的内存"),
        ("如何处理线程崩溃", "崩溃"),
        ("为什么需要线程同步", "线程同步"),
        ("为什么需要进程间通信", "IPC"),
        ("为什么需要临界区", "临界区"),
        ("如何保护临界区", "临界区"),
        ("同步一定阻塞吗？", "阻塞"),
        ("同步一定阻塞吗", "阻塞"),
        ("阻塞一定同步吗？", "阻塞"),
        ("阻塞一定同步吗", "阻塞"),
        ("什么时候不建议使用多线程 / 多进程", "选用"),
        ("什么时候不建议使用", "选用"),
        ("如何查看和修改调度策略", "调度策略"),
        ("优先级反转是什么", "优先级反转"),
        ("优先级反转是什么？如何解决", "优先级反转"),
        ("为什么需要虚拟地址？", "物理地址"),
        ("为什么需要虚拟地址", "物理地址"),
        ("为什么需要虚拟内存？", "虚拟内存"),
        ("为什么需要虚拟内存", "虚拟内存"),
        ("如何优化缺页中断", "缺页"),
        ("静态链接与动态链接的优缺点", "静态链接"),
        ("户空间和内核空间如何划分", "用户空间和内核空间"),
        ("户空间和内核空间", "用户空间和内核空间"),
        ("为什么需要", "虚拟内存"),
        # Broad patterns at end
        ("程", "进程"),
        ("断", "中断"),
    ]

    for partial_key, full_key in truncated_fixes:
        if partial_key.lower() in st:
            pool = SUBTOPIC_POOLS.get(full_key)
            if pool:
                return pool

    # Direct key match
    for key in SUBTOPIC_POOLS:
        if key.lower() in st or st in key.lower():
            return SUBTOPIC_POOLS[key]

    # Word-level matching
    for key, val in SUBTOPIC_POOLS.items():
        kw_parts = key.lower().split()
        if any(part in st for part in kw_parts):
            return val

    # Also check topic-level fallback
    if "操作" in tp or "系统" in tp:
        # Check if subtopic contains any recognizable OS concept
        for key, val in SUBTOPIC_POOLS.items():
            if key in st[:len(key)+2]:
                return val

    # Network questions fallback
    if "网络" in tp:
        return [
            "OSI七层模型中传输层负责比特流传输",
            "TCP/IP四层模型中应用层只对应OSI应用层",
            "IP协议提供可靠的面向连接服务",
            "HTTP协议默认端口是443",
            "TCP的三次握手中第一次发送的是ACK包",
            "UDP协议提供可靠的数据传输",
        ]

    return None

def generate_choices(q):
    """Generate 4 MCQ choices and correct_idx."""
    answer = q.get("answer", "")
    subtopic = q.get("subtopic", "")
    topic = q.get("topic", "")
    q_text = q.get("question", "")

    # Extract correct answer
    correct = extract_best_answer(answer)
    if not correct or len(correct) < 5:
        correct = clean(answer)[:110]
    if not correct:
        correct = f"关于{subtopic}的正确理解"

    # Get wrong option pool
    pool = find_pool(subtopic or q_text, topic)
    if pool and len(pool) >= 3:
        selected_wrong = random.sample(pool, 3)
    else:
        # Last resort generic wrong options
        selected_wrong = [
            f"{subtopic}的概念描述是错误的",
            f"{subtopic}在系统设计中不重要",
            f"{subtopic}的实现方式只有一种",
        ]

    # Randomize correct answer position
    correct_idx = random.randint(0, 3)
    choices = []
    wrong_iter = iter(selected_wrong)
    for i in range(4):
        if i == correct_idx:
            choices.append(correct)
        else:
            choices.append(next(wrong_iter))

    return choices, correct_idx

# Process all
for q in questions:
    choices, correct_idx = generate_choices(q)
    q["choices"] = choices
    q["correct_idx"] = correct_idx

with open(INPUT, "w", encoding="utf-8") as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print(f"Done! Processed {len(questions)} questions.")

# Quality check
issues = 0
for q in questions:
    if not q["choices"] or len(q["choices"]) != 4:
        print(f"ISSUE: {q.get('subtopic')} has {len(q.get('choices', []))} choices")
        issues += 1
    if q["correct_idx"] is None or not (0 <= q["correct_idx"] <= 3):
        print(f"ISSUE: {q.get('subtopic')} invalid correct_idx={q['correct_idx']}")
        issues += 1

print(f"Quality checks: {issues} issues found.")

# Show samples
print("\n=== Samples ===")
for q in questions[:5]:
    print(f"\nQ: {q['subtopic']} [{q.get('source', '')}]")
    print(f"correct_idx: {q['correct_idx']}")
    for i, c in enumerate(q["choices"]):
        marker = "✓" if i == q["correct_idx"] else "✗"
        print(f"  {marker} [{i}] {c[:75]}")
