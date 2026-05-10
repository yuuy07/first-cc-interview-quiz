import json

with open('/Users/xkkk/Documents/FIRST CC/scripts/choices_batch_linux_remaining.json') as f:
    questions = json.load(f)

CHOICES = {
    # ======= 嵌入式Linux应用 =======

    # Q0: Linux常见指令
    0: ([
        "ls 用于列出目录内容",
        "dircmp 用于比较两个目录",
        "attrib 用于修改文件权限",
        "tracert 用于测试网络连通性"
    ], 0),

    # Q1: 系统调用（System Call）的实现
    1: ([
        "通过软中断或syscall指令从用户态切换到内核态",
        "系统调用与普通函数调用的开销完全相同",
        "参数通过全局变量直接传递给内核函数",
        "内核态可以直接访问用户空间任意数据"
    ], 0),

    # Q2: thread_create() 创建线程的基本流程
    2: ([
        "内核分配TCB保存线程ID、状态和寄存器上下文",
        "线程创建后立即抢占CPU执行",
        "线程共享独立的地址空间和独立的文件描述符表",
        "pthread_create返回线程ID后才分配栈空间"
    ], 0),

    # Q3: 线程分离（Detach）与 join 的区别
    3: ([
        "join阻塞调用线程等待目标线程结束并获取返回值",
        "detach后线程结束必须手动调用free释放资源",
        "join和detach可以在线程创建后任意切换多次",
        "detach的线程退出后主线程必须调用join回收资源"
    ], 0),

    # Q4: 守护进程（Daemon）的创建
    4: ([
        "守护进程通过fork+setsid脱离终端独立运行",
        "守护进程创建时不需要修改工作目录",
        "守护进程可以依赖终端的标准输入输出",
        "创建守护进程只需fork一次即可完成"
    ], 0),

    # Q5: 管道（pipe）和命名管道（FIFO）的区别
    5: ([
        "匿名管道只能在有亲缘关系的进程间通信",
        "命名管道只能在父子进程间使用",
        "管道是全双工通信，两端同时读写",
        "FIFO创建后自动持久化到文件系统永不删除"
    ], 0),

    # Q6: 消息队列（message queue）基本使用
    6: ([
        "消息队列容量有限，满队列时发送可能阻塞",
        "POSIX消息队列不支持消息优先级",
        "System V消息队列只能按类型过滤消息",
        "消息队列中的数据必须以固定长度发送"
    ], 0),

    # Q7: socketpair() 与管道的区别
    7: ([
        "socketpair支持全双工双向通信",
        "socketpair只能用于网络协议通信",
        "管道默认支持双向读写操作",
        "socketpair需要在文件系统中创建节点"
    ], 0),

    # Q8: 阻塞和非阻塞 socket 区别
    8: ([
        "阻塞socket在操作未完成时挂起调用线程",
        "非阻塞socket会阻塞等待直到数据到达",
        "非阻塞socket读写永远返回成功",
        "阻塞socket适合高并发服务器场景"
    ], 0),

    # Q9: select、poll、epoll 的区别与使用场景
    9: ([
        "select使用固定大小FD_SETSIZE的位数组传递fd",
        "epoll在每次调用时都需要重新注册所有fd",
        "poll使用固定大小1024的数组限制连接数",
        "select比epoll更适合海量高并发连接场景"
    ], 0),

    # Q10: LT（水平触发）和 ET（边沿触发）区别
    10: ([
        "LT模式只要fd可读epoll_wait就会反复通知",
        "ET模式触发一次后不读完数据会再次触发",
        "LT模式比ET模式更适合高并发场景",
        "ET模式下读写可以使用阻塞I/O"
    ], 0),

    # Q11: 设计一个高并发 TCP 服务
    11: ([
        "epoll采用事件驱动机制，复杂度O(1)适合高并发",
        "高并发服务器应该每个连接创建一个独立线程处理",
        "select支持无限数量的文件描述符监听",
        "epoll_wait每次只能返回一个就绪事件"
    ], 0),

    # Q12: 客户端断线检测方法
    12: ([
        "心跳机制通过定期交换心跳包检测断线",
        "read返回-1表示对端正常关闭连接",
        "TCP keepalive默认探测间隔为30秒",
        "EPOLLERR事件与EPOLLIN事件含义相同"
    ], 0),

    # Q13: Linux 下实现定时任务
    13: ([
        "cron通过crontab文件配置周期性任务",
        "at命令用于执行周期性重复任务",
        "POSIX定时器timer_create只能在用户空间使用",
        "sleep循环适合高精度工业级定时场景"
    ], 0),

    # Q14: timerfd 与 signal timer 区别
    14: ([
        "timerfd通过文件描述符集成I/O多路复用",
        "signal timer永远不触发信号处理函数",
        "timerfd只能用于单线程同步等待",
        "signal timer是Linux独有的定时器接口"
    ], 0),

    # Q15: 实现高精度周期任务
    15: ([
        "使用TIMER_ABSTIME绝对时间避免累积误差",
        "clock_nanosleep不阻塞线程适合高并发场景",
        "高精度周期任务可以直接在中断处理函数中睡眠",
        "SCHED_OTHER调度策略实时精度优于SCHED_FIFO"
    ], 0),

    # Q16: Linux 下操作 GPIO/UART/SPI/I2C
    16: ([
        "GPIO可通过/dev/gpiochipN字符设备和gpiod库操作",
        "UART配置通过echo重定向不用ioctl",
        "SPI是半双工通信不能同时收发",
        "GPIO sysfs接口是Linux5.10之后推荐的新接口"
    ], 0),

    # Q17: 线程访问硬件寄存器的处理
    17: ([
        "自旋锁在短时间内轮询锁避免上下文切换开销",
        "多线程访问寄存器完全不需要同步保护",
        "原子操作适合长时间持有锁的复杂操作",
        "互斥锁只能在中断上下文使用不能在进程上下文使用"
    ], 0),

    # Q18: 日志系统设计：保证性能与可靠性
    18: ([
        "异步日志将日志写入缓冲区再后台刷入存储",
        "日志轮转策略让日志文件无限增长不分割",
        "重要日志应全部采用异步写入不保证可靠性",
        "环形缓冲区日志在掉电时永远不会丢失"
    ], 0),

    # ======= 嵌入式Linux驱动 =======

    # Q19: 驱动程序与应用程序的区别
    19: ([
        "驱动程序运行在内核态可访问硬件寄存器",
        "驱动出错一般只影响自身进程不会崩溃系统",
        "应用程序可以直接通过物理地址访问硬件",
        "驱动程序不需要注册file_operations结构"
    ], 0),

    # Q20: 内核模块（module）及加载/卸载
    20: ([
        "insmod直接加载.ko文件不自动处理依赖关系",
        "modprobe加载模块前不需要查看已加载模块",
        "rmmod卸载模块时内核不检查引用计数",
        "内核模块卸载后设备仍然可以正常使用驱动"
    ], 0),

    # Q21: module_init()/module_exit() 的作用
    21: ([
        "module_init宏注册模块加载时的初始化函数",
        "module_init/module_exit不可以用自定义函数名",
        "init_module函数在模块卸载时被调用",
        "module_exit注册的函数在模块加载时执行"
    ], 0),

    # Q22: 内核模块与用户态程序交互
    22: ([
        "字符设备通过/dev接口和file_operations与用户交互",
        "ioctl只能传输大数据块不能传控制命令",
        "sysfs属性文件只能被内核模块读取不能写入",
        "netlink套接字只能用于网络设备驱动通信"
    ], 0),

    # Q23: 为什么内核模块不能直接使用标准C库函数
    23: ([
        "内核态有独立的内存分配接口kmalloc和kfree",
        "内核模块可以直接调用printf输出调试信息",
        "内核模块可以直接malloc分配内存不需要特殊接口",
        "内核态和用户态共享完全相同的虚拟地址空间"
    ], 0),

    # Q24: 字符设备的基本操作接口
    24: ([
        "字符设备核心是file_operations结构体注册操作回调",
        "字符设备驱动不需要实现open和release方法",
        "字符设备的主设备号只能由内核静态分配",
        "字符设备无法支持阻塞和非阻塞两种模式"
    ], 0),

    # Q25: 字符设备驱动中 open、read、write、close 的实现
    25: ([
        "read操作使用copy_to_user将数据从内核拷贝到用户空间",
        "write操作直接访问用户空间指针无需特殊处理",
        "close操作不需要释放任何资源",
        "驱动的open函数中不能使用private_data保存设备数据"
    ], 0),

    # Q26: ioctl 在驱动中的作用
    26: ([
        "ioctl通过自定义命令实现设备配置和控制",
        "ioctl只能用来传输数据不能执行控制操作",
        "unlocked_ioctl是已被废弃的老接口",
        "ioctl参数arg只能传递整数不能传递指针"
    ], 0),

    # Q27: 驱动中实现阻塞/非阻塞读写
    27: ([
        "阻塞读写使用等待队列wait_event_interruptible实现",
        "非阻塞读返回-1时errno固定为EPERM",
        "等待队列中的进程可以同时唤醒所有等待者",
        "poll方法只能用于阻塞模式不能用于非阻塞"
    ], 0),

    # Q28: 中断在驱动中的注册和使用
    28: ([
        "request_irq注册ISR后中断触发时调用该处理函数",
        "ISR中可以调用msleep进行延时等待",
        "tasklet运行在进程上下文可以睡眠",
        "共享中断通过handler返回值区分设备"
    ], 0),

    # Q29: request_irq() 作用及 ISR 中可做的操作
    29: ([
        "ISR运行在中断上下文必须快速执行不能阻塞",
        "ISR中可以使用copy_to_user向用户态发送数据",
        "ISR中可以调用kmalloc带GFP_KERNEL标志",
        "request_irq返回0表示中断注册失败"
    ], 0),

    # Q30: kmalloc、vmalloc 区别及 GFP 标志用法
    30: ([
        "kmalloc分配连续物理内存，vmalloc分配虚拟连续内存",
        "kmalloc与vmalloc分配的内存都保证物理连续",
        "GFP_ATOMIC用于可以睡眠的进程上下文",
        "vmalloc比kmalloc分配速度更快开销更低"
    ], 0),

    # Q31: 用户态如何通过 mmap 或 read/write 与驱动交互
    31: ([
        "mmap将内核缓冲区映射到用户空间省去数据拷贝",
        "read/write交互不需要系统调用可直接访问",
        "mmap映射后数据一致性由内核自动保证无需同步",
        "read/write比mmap更适合大数据量传输"
    ], 0),

    # Q32: ioremap() 的作用及使用
    32: ([
        "ioremap将外设物理地址映射到内核虚拟地址空间",
        "ioremap映射的内存区域默认启用CPU缓存",
        "ioremap映射后直接用普通指针解引用访问寄存器",
        "iounmap不是必需的映射泄漏也不会影响系统"
    ], 0),

    # Q33: 如何定位驱动中的内存泄漏
    33: ([
        "kmemleak通过内核配置CONFIG_DEBUG_KMEMLEAK扫描泄漏",
        "模块卸载后未释放kmalloc内存会被系统自动回收",
        "ioremap后忘记iounmap不会造成内存泄漏",
        "反复加载卸载模块不会暴露内存泄漏问题"
    ], 0),

    # Q34: 内核调试方法（printk、gdb、ftrace、动态调试）
    34: ([
        "printk向内核日志缓冲区写入信息通过dmesg查看",
        "kgdb调试需要实时时钟中断保持精确单步",
        "ftrace是内核外部独立工具不是内置功能",
        "动态调试需要修改内核代码重新编译模块"
    ], 0),

    # Q35: 设备树（Device Tree）
    35: ([
        "设备树通过compatible字段实现驱动与硬件匹配",
        "设备树dtb文件需要在运行时由内核自动生成",
        ".dts文件编译成.dtb后不能反编译查看",
        "设备树源文件格式是.yaml而不是.dts"
    ], 0),

    # Q36: 如何在设备树中定义 GPIO / SPI / I2C 外设
    36: ([
        "GPIO控制器节点使用gpio-controller属性声明",
        "SPI从设备reg属性指定I2C从机地址",
        "I2C从设备reg属性指定SPI片选号",
        "所有设备树节点都需要interrupts属性"
    ], 0),

    # ======= 补充：Bootloader、Rootfs =======

    # Q37: 什么是 Bootloader？主要作用
    37: ([
        "Bootloader负责硬件初始化并加载操作系统",
        "Bootloader运行在操作系统启动之后",
        "Bootloader不需要初始化DDR内存",
        "Bootloader不能实现固件升级功能"
    ], 0),

    # Q38: Bootloader 和 BIOS / UEFI 有什么区别
    38: ([
        "Bootloader常用于嵌入式设备，BIOS/UEFI用于PC平台",
        "Bootloader和BIOS的功能复杂度完全相同",
        "UEFI只支持x86架构不支持ARM平台",
        "Bootloader比BIOS/UEFI功能更复杂完整"
    ], 0),

    # Q39: Bootloader 启动 Linux 内核的过程
    39: ([
        "Bootloader先做硬件初始化再加载内核和设备树到内存",
        "Bootloader直接启动内核不需要加载设备树",
        "Bootloader将根文件系统挂载完成后才启动内核",
        "Bootloader加载内核后Linux不再需要启动参数"
    ], 0),

    # Q40: U-Boot 的主要功能
    40: ([
        "U-Boot从存储或网络加载内核并传递启动参数",
        "U-Boot启动后直接加载内核不提供命令行交互",
        "U-Boot不支持通过网络下载程序烧录固件",
        "U-Boot启动过程中不需要初始化串口"
    ], 0),

    # Q41: U-Boot 的启动阶段（SPL / TPL）
    41: ([
        "TPL运行在片上SRAM中，加载SPL到SRAM",
        "TPL直接负责初始化DDR和加载整个Linux内核",
        "SPL在DDR初始化前就可以加载完整U-Boot",
        "SPL阶段不需要初始化任何存储设备"
    ], 0),

    # Q42: U-Boot 环境变量的作用
    42: ([
        "环境变量通过bootargs向内核传递启动参数",
        "环境变量只能读取不能通过setenv修改",
        "环境变量存储在内存中掉电即丢失",
        "环境变量的修改不需要saveenv就会持久化"
    ], 0),

    # Q43: U-Boot 如何加载 kernel、device tree 和 rootfs
    43: ([
        "U-Boot加载内核和dtb到内存rootfs通过bootargs传递",
        "U-Boot需要直接解压缩并挂载rootfs文件系统",
        "U-Boot将设备树编译成dtb后自动传递给内核",
        "U-Boot加载内核后不再需要任何参数就可以启动"
    ], 0),

    # Q44: 什么是 RootFS？为什么要有 RootFS
    44: ([
        "RootFS包含init程序、系统命令和动态库",
        "RootFS是可选的内核启动成功后可以没有",
        "RootFS只包含内核模块不包含用户程序",
        "RootFS在系统运行时不需要挂载到根目录"
    ], 0),

    # Q45: /init 或 /sbin/init 在系统启动中的作用
    45: ([
        "init是用户空间第一个进程PID=1负责启动服务和回收子进程",
        "init进程在系统启动完成后可以被kill命令终止",
        "init进程负责直接管理硬件中断和内核调度",
        "init启动服务时不依赖任何配置文件"
    ], 0),

    # Q46: 不同 RootFS 文件系统的使用场景
    46: ([
        "squashfs是只读压缩文件系统适合嵌入式只读系统",
        "ext4是只读文件系统不支持写入操作",
        "initramfs是Flash文件系统需要NAND驱动支持",
        "NFS是本地块设备文件系统速度最快"
    ], 0),

    # Q47: initramfs 和 initrd 的区别
    47: ([
        "initramfs直接解压到内存无需挂载块设备",
        "initrd和initramfs都是直接解压到内存无需挂载",
        "initramfs依赖块设备驱动来解压cpio档案",
        "initrd是现代Linux推荐使用的临时根文件系统"
    ], 0),

    # Q48: Bootloader 如何指定 rootfs 的位置
    48: ([
        "通过bootargs中root=/dev/参数指定rootfs分区",
        "Bootloader直接挂载rootfs后再启动内核",
        "rootfs位置必须通过硬件跳线指定不能软件配置",
        "网络rootfs不需要IP配置直接自动挂载"
    ], 0),

    # Q49: 内核挂载 RootFS 失败可能的原因
    49: ([
        "bootargs中root参数错误或文件系统驱动缺失",
        "RootFS损坏时内核会自动修复继续启动",
        "内核缺少存储驱动时可以从网络自动下载",
        "init程序缺失内核会自动创建默认init进程"
    ], 0),

    # Q50: Bootloader 能启动但 Linux 内核无法启动的原因
    50: ([
        "内核镜像损坏或设备树dtb与内核不匹配",
        "Bootloader能启动说明内核一定也能正常启动",
        "内核启动参数错误会被Bootloader自动修正",
        "内核缺少驱动时会自动从initramfs中加载"
    ], 0),

    # Q51: Bootloader 如何实现多系统启动
    51: ([
        "通过环境变量bootcmd或启动菜单选择不同内核",
        "多系统启动需要修改主板硬件电路切换启动设备",
        "U-Boot不支持从不同分区加载不同系统",
        "多系统启动不能通过网络TFTP下载镜像"
    ], 0),

    # === 简版重复题（display_order 427-436）===

    # Q52: LT 和 ET 区别（简版）
    52: ([
        "水平触发LT只要fd可读epoll_wait就继续通知",
        "边沿触发ET不读完数据下次还会触发通知",
        "LT模式下必须使用非阻塞I/O循环读写",
        "ET模式编程比LT更简单容错性更高"
    ], 0),

    # Q53: 线程访问硬件寄存器的处理（简版）
    53: ([
        "多线程访问共享寄存器必须使用同步机制如互斥锁",
        "寄存器读写在多线程环境下不需要任何保护",
        "自旋锁适合长时间持有锁的场景",
        "原子操作只能用于保护大段代码和复杂逻辑"
    ], 0),

    # Q54: module_init/module_exit 的作用（简版）
    54: ([
        "module_init注册模块加载函数module_exit注册卸载函数",
        "module_init函数在模块卸载时被内核调用",
        "cleanup_module在现代内核中完全取代module_exit",
        "模块初始化函数只能命名为init_module不能自定义"
    ], 0),

    # Q55: Linux 驱动开发中常用的头文件
    55: ([
        "module.h和init.h是内核模块的基础头文件",
        "uaccess.h提供kmalloc和kfree内存分配函数",
        "interrupt.h只用于定义中断号不提供注册函数",
        "cdev.h只包含字符设备的IOCTL操作宏"
    ], 0),

    # Q56: 字符设备的基本操作接口（简版）
    56: ([
        "字符设备通过file_operations结构体定义open/read/write等",
        "字符设备只能通过ioctl访问不能使用read/write",
        "file_operations结构体中的所有回调函数都强制需要实现",
        "字符设备驱动不需要注册设备号就能创建设备文件"
    ], 0),

    # Q57: 字符设备驱动中 open/read/write/close 的实现（简版）
    57: ([
        "read用copy_to_user将数据从内核拷贝到用户空间",
        "write用copy_to_user将数据从内核拷贝到用户空间",
        "open函数只能返回0不能做任何设备初始化操作",
        "release函数在内核模块加载时被自动调用"
    ], 0),

    # Q58: ioremap() 的作用及使用（简版）
    58: ([
        "ioremap将物理地址映射到内核虚拟地址用于访问外设寄存器",
        "ioremap映射后的内存可以直接使用malloc分配",
        "ioremap返回值可以直接作为普通函数指针调用",
        "ioremap分配的内存会自动缓存无需考虑一致性"
    ], 0),

    # Q59: 设备树（Device Tree）（简版）
    59: ([
        "设备树通过.dts源文件编译为.dtb二进制供内核使用",
        "设备树文件格式是JSON结构不是树形结构",
        "设备树只能描述CPU不能描述外设信息",
        "设备树的compatible属性在驱动中不是必需的"
    ], 0),

    # Q60: 驱动如何使用设备树
    60: ([
        "驱动通过of_match_table的compatible字段匹配设备",
        "驱动不需要设备树可以直接通过总线地址访问设备",
        "platform_get_resource只能获取IRQ不能获取内存资源",
        "驱动中of_match_table不是必需的可以忽略不写"
    ], 0),

    # Q61: 为什么 Linux 必须要有 RootFS
    61: ([
        "RootFS提供init程序、库文件和配置使用户空间可运行",
        "Linux内核不需要RootFS可以独立运行用户程序",
        "RootFS只在系统启动时使用运行后不再需要",
        "系统命令ls和cp直接编译在内核中不需要RootFS"
    ], 0),
}

for i, q in enumerate(questions):
    if i in CHOICES:
        choices, idx = CHOICES[i]
        q['choices'] = choices
        q['correct_idx'] = idx

with open('/Users/xkkk/Documents/FIRST CC/scripts/choices_batch_linux_remaining.json', 'w') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print("Done!")
