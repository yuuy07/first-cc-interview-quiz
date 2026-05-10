import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve('/Users/xkkk/Documents/FIRST CC/scripts/choices_batch_batch_c.json');
const raw = readFileSync(filePath, 'utf-8');
const questions = JSON.parse(raw);

// ---------- helper: plausible wrong choice generators per subtopic ----------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate choices for a question
function generateChoices(q) {
  const { subtopic, answer, topic } = q;
  const ans = answer || '';
  const low = ans.toLowerCase();

  // Determine correct answer from answer text — we need to extract or infer key fact
  // We'll generate question-specific choices

  // Extract key sentences from answer
  const sentences = ans.split(/[。\n]/).filter(s => s.trim().length > 5);

  // Determine a "key fact" — something the answer states definitively
  let keyFact = '';

  // Try to find definitive statements
  const patterns = [
    /存储在\s*[（(]?\s*([^）)]+)\s*[）)]?/,
    /(?:通常|一般|默认|必须|会|可以|不能)\s*(?:存储|分配|使用|放在|位于|在|是|具有|没有|支持|调用|采用)([^，。\n]+)/,
    /(?:本质|核心|特点|区别|差异|不同)\s*(?:是|为|在于)([^。\n]+)/,
    /(?:原因|因为|所以|因此)([^。\n]+)/,
  ];

  for (const p of patterns) {
    const m = ans.match(p);
    if (m) { keyFact = m[0].substring(0, 40); break; }
  }
  if (!keyFact) keyFact = ans.substring(0, 50);

  // Generate stem based on subtopic
  let stem = '';
  const stems = [
    `关于${subtopic}，以下说法正确的是？`,
    `对于${subtopic}，下列描述中正确的是？`,
    `以下关于${subtopic}的叙述中，哪一个是正确的？`,
    `下列选项中，关于${subtopic}表述正确的是？`,
    `在${topic}中，关于${subtopic}的理解，正确的是？`,
  ];
  stem = pick(stems);

  // Generate correct and wrong options based on answer content
  // We'll create domain-specific wrong options

  let correctOption = '';
  let wrongOptions = [];

  // Domain-specific choice generation
  const domain = topic + '|' + subtopic;

  if (domain.includes('全局变量和局部变量')) {
    correctOption = '全局变量存储在全局/静态存储区（.data/.bss），局部变量存储在栈区';
    wrongOptions = [
      '全局变量存储在栈区，局部变量存储在全局/静态存储区',
      '全局变量和局部变量都存储在堆区',
      '全局变量默认初始化为随机值，局部变量默认初始化为0',
    ];
  } else if (domain.includes('内存分布模型')) {
    correctOption = '内存从低地址到高地址依次为：代码区、rodata、.data、.bss、堆区、栈区';
    wrongOptions = [
      '内存从低地址到高地址依次为：栈区、堆区、代码区、.data、.bss',
      '堆区向低地址增长，栈区向高地址增长',
      '.bss段存放已初始化的全局变量，占用可执行文件空间',
    ];
  } else if (domain.includes('BSS') || domain.includes('初始化为 0 的全局变量')) {
    correctOption = '初始化为0的全局变量存储在BSS段，不占用磁盘空间，程序加载时自动清零';
    wrongOptions = [
      '初始化为0的全局变量存储在Data段，因为需要存储初始值0到磁盘',
      '初始化为0的全局变量存储在栈区，程序启动时由操作系统清零',
      '初始化为0的全局变量存储在代码区，与可执行指令一起存放',
    ];
  } else if (domain.includes('字符数组初始化')) {
    correctOption = 'char str[] = "hello"会自动添加\'\\0\'，数组大小为6；char *p = "hello"指向只读字符串常量区';
    wrongOptions = [
      'char str[] = "hello"的数组大小为5，不包含\'\\0\'',
      'char *p = "hello"可以通过p[0]修改字符串内容',
      'char str[6] = "hello"剩余元素会被随机值填充，不会自动补0',
    ];
  } else if (domain.includes('数组的存储位置')) {
    correctOption = '局部数组存储在栈区，全局数组存储在静态区（Data段），动态数组存储在堆区';
    wrongOptions = [
      '所有数组都存储在栈区，无论定义位置如何',
      '全局数组存储在堆区，动态数组存储在栈区',
      '静态局部数组存储在栈区，生命周期与函数相同',
    ];
  } else if (domain.includes('静态数组和动态数组')) {
    correctOption = '静态数组在编译时确定大小，由编译器自动管理；动态数组运行时确定大小，需手动管理';
    wrongOptions = [
      '静态数组和动态数组都在堆上分配，生命周期相同',
      '动态数组大小在编译时确定，静态数组大小在运行时确定',
      '静态数组可以随时改变大小，动态数组大小固定不变',
    ];
  } else if (domain.includes('二维数组')) {
    correctOption = '二维数组在内存中按行连续存储，arr[i][j]等价于*(*(arr+i)+j)';
    wrongOptions = [
      '二维数组在内存中按列连续存储',
      'arr+i指向第i行第0列元素的地址，*(arr+i)是第i行第0列的元素值',
      '二维数组作为函数参数时可以省略所有维度大小',
    ];
  } else if (domain.includes('extern')) {
    correctOption = 'extern用于声明在其他地方定义的变量或函数，只做声明不分配存储空间';
    wrongOptions = [
      'extern用于定义变量并分配存储空间，常用于多文件共享',
      'extern与static可以同时修饰同一个变量，表示静态外部链接',
      'extern修饰的const全局变量在C语言中默认具有外部链接属性',
    ];
  } else if (domain.includes('数组大小')) {
    correctOption = 'sizeof(数组名)返回整个数组占用字节数，数组作为函数参数时会退化为指针';
    wrongOptions = [
      'sizeof(数组名)在函数内部和外部作用域下都返回整个数组大小',
      '数组大小可以在运行期通过变量动态指定（C89标准支持）',
      'sizeof(s)和strlen(s)对字符串数组总是返回相同的结果',
    ];
  } else if (domain.includes('压栈') || domain.includes('函数参数压栈')) {
    correctOption = 'C语言默认的__cdecl调用约定参数从右向左压栈，由调用者清理栈';
    wrongOptions = [
      'C语言默认的__cdecl调用约定参数从左向右压栈，由被调用者清理栈',
      '__stdcall调用约定支持可变参数函数，由调用者清理栈',
      '__cdecl和__stdcall的参数压栈顺序都是从左到右，区别在于谁清理栈',
    ];
  } else if (domain.includes('位域') || domain.includes('寄存器映射')) {
    correctOption = '位域映射寄存器时需要使用#pragma pack(1)取消字节对齐，并用volatile防止编译器优化';
    wrongOptions = [
      '位域映射寄存器时不需要考虑字节对齐问题，编译器会自动处理',
      'volatile关键字在位域映射中用于提高访问速度，缓存寄存器值',
      '位域中字段的顺序在所有编译器中都是一致的，不需要考虑大小端问题',
    ];
  } else if (domain.includes('数组名与指针') && domain.includes('地址')) {
    correctOption = 'a是数组首元素地址，&a是整个数组的地址，两者数值相同但类型不同，指针运算结果不同';
    wrongOptions = [
      'a和&a完全等价，指向同一个地址且指针运算结果相同',
      '数组名是指针变量，可以被赋值和自增',
      'a+1和&a+1都指向数组的第二个元素',
    ];
  } else if (domain.includes('指针函数') && !domain.includes('数组指针')) {
    correctOption = '指针函数是返回指针的函数（如int* func()），函数指针是指向函数的指针（如int (*p)()）';
    wrongOptions = [
      '指针函数是指向函数的指针变量，函数指针是返回指针的函数',
      'int *func()和int (*func)()是完全等价的声明形式',
      '指针函数不能返回动态分配的内存地址，只能返回全局变量地址',
    ];
  } else if (domain.includes('形参') || domain.includes('实参')) {
    correctOption = 'C语言只有传值调用，指针传参传递的是地址的副本，通过地址间接修改实参';
    wrongOptions = [
      'C语言支持值传递和引用传递两种方式，引用传递可以修改实参',
      '数组作为实参时会拷贝整个数组到函数内部，不影响原数组',
      '结构体作为实参使用值传递时不会有性能开销，与传递指针效率相同',
    ];
  } else if (domain.includes('strcpy') || domain.includes('memcpy')) {
    correctOption = 'strcpy以\'\\0\'作为结束标志用于字符串拷贝，memcpy按字节拷贝不关心内容，两者都不处理内存重叠';
    wrongOptions = [
      'strcpy和memcpy都会自动处理内存重叠问题，使用上可以互换',
      'memcpy以\'\\0\'作为结束标志，适用于字符串拷贝',
      'strcpy比memcpy更适合拷贝结构体和二进制数据',
    ];
  } else if (domain.includes('申请堆内存')) {
    correctOption = '函数中申请的堆内存不会随函数结束自动释放，必须明确谁申请谁释放，且不能返回局部变量地址';
    wrongOptions = [
      '函数中申请的堆内存会在函数返回时自动释放，无需手动free',
      '函数中可以安全地返回局部变量的地址，因为局部变量在静态区',
      'malloc分配的内存会自动初始化为0，不需要手动初始化',
    ];
  } else if (domain.includes('交换两个整数') || domain.includes('位运算')) {
    correctOption = '使用异或运算可以不用临时变量交换两整数：a=a^b; b=a^b; a=a^b；利用了a^a=0和a^0=a的性质';
    wrongOptions = [
      '使用异或运算交换两整数的步骤是：a=a^b; b=b^a; a=b^a',
      '异或交换的主要优点是代码可读性好，易于维护',
      '使用加减法交换两整数不会有溢出风险，比异或交换更安全',
    ];
  } else if (domain.includes('main') || domain.includes('argc') || domain.includes('argv')) {
    correctOption = 'argc表示命令行参数个数（至少为1），argv是字符串指针数组，argv[0]为程序名';
    wrongOptions = [
      'argc表示命令行参数的个数，不包括程序名，所以可能为0',
      'argv是二维字符数组，每个元素存储一个参数字符串',
      'main函数的返回值可以任意指定，操作系统不会检查返回值',
    ];
  } else if (domain.includes('malloc') || (domain.includes('free') && !domain.includes('智能指针'))) {
    if (domain.includes('出现问题') || domain.includes('可能出现')) {
      correctOption = 'malloc/free使用时可能出现内存泄漏、双重释放、悬挂指针、内存不足、未初始化内存、越界访问等问题';
      wrongOptions = [
        'malloc分配的内存会自动初始化为0，不需要手动初始化',
        'free后将指针置为NULL可以完全避免悬挂指针问题',
        'malloc和free的配对使用不是必须的，操作系统会自动回收',
      ];
    } else {
      correctOption = 'malloc分配堆内存，返回void*，不初始化；成功返回非NULL，失败返回NULL';
      wrongOptions = [
        'malloc分配的内存会自动初始化为0',
        'malloc返回的是具体类型指针，不需要类型转换',
        'malloc分配失败时会抛出std::bad_alloc异常',
      ];
    }
  } else if (domain.includes('static') && !domain.includes('static静态成员')) {
    correctOption = 'C中static修饰局部变量延长生命周期到整个程序、修饰全局变量限制作用域到本文件；C++扩展支持静态成员变量和静态成员函数';
    wrongOptions = [
      'static修饰的局部变量每次函数调用都会重新初始化',
      'static修饰的全局变量可以在其他文件中通过extern访问',
      'C++中静态成员函数可以访问类的所有成员，包括非静态成员',
    ];
  } else if (domain.includes('typedef') && !domain.includes('using')) {
    correctOption = 'typedef是编译期创建类型别名受类型检查，#define是预处理期文本替换无类型检查';
    wrongOptions = [
      'typedef和#define在定义指针类型时行为完全一致，没有区别',
      '#define定义的别名可以被调试器识别，方便调试',
      'typedef支持模板别名，可用于定义模板类型的别名',
    ];
  } else if (domain.includes('const') && !domain.includes('const int') && !domain.includes('vs volatile') && !domain.includes('const和#define') && !domain.includes('const volatile')) {
    const isConstDefine = domain.includes('const和#define') || domain.includes('const 和 #define');
    if (isConstDefine) {
      correctOption = 'const有类型检查、遵循作用域规则、占用内存空间；#define无类型检查、全局有效、不占内存（纯文本替换）';
      wrongOptions = [
        'const和#define都在编译阶段处理，都有类型检查',
        '#define定义的常量在调试时可以显示名称，const则不能',
        'const常量不会占用内存空间，和#define一样是纯文本替换',
      ];
    } else {
      correctOption = 'const修饰变量为只读，const int*指向的内容不可改指针可改，int* const指针不可改内容可改，const int* const两者都不可改';
      wrongOptions = [
        'const int*和int* const的含义相同，都表示指向常量的指针',
        'const修饰的变量必须在定义时初始化，且其值在运行期绝对不能修改',
        'const全局变量默认具有外部链接属性，跨文件可以直接访问',
      ];
    }
  } else if (domain.includes('指针') && !domain.includes('函数指针') && !domain.includes('数组指针') && !domain.includes('智能指针') && !domain.includes('野指针')) {
    correctOption = '指针是存储另一个变量地址的变量，需显式解引用，可以为NULL，可以改变指向';
    wrongOptions = [
      '指针是已有变量的别名，使用方式与普通变量一致，不能为空',
      '指针定义后必须初始化且不能改变指向',
      '指针和引用的内存操作完全相同，没有区别',
    ];
  } else if (domain.includes('引用') && !domain.includes('右值')) {
    correctOption = '引用是已有变量的别名，必须初始化，不能为空，一旦绑定不能改变指向；指针可以改变指向可以为空';
    wrongOptions = [
      '引用和指针一样占用独立的内存空间，可以重新绑定到其他变量',
      '引用可以像指针一样进行指针运算，如引用自增',
      '引用可以不初始化，使用时再绑定到一个变量',
    ];
  } else if (domain.includes('可变参数') || domain.includes('...')) {
    correctOption = '可变参数通过<stdarg.h>的va_list、va_start、va_arg、va_end宏实现，基于栈操作访问参数';
    wrongOptions = [
      '可变参数函数可以不需要固定参数，直接使用...定义即可',
      'va_arg宏会自动进行类型检查，确保读取类型与传入类型一致',
      '可变参数函数的实现依赖于堆内存分配，不涉及栈操作',
    ];
  } else if (domain.includes('const和#define') || domain.includes('const 和 #define')) {
    correctOption = 'const有类型检查、遵循作用域规则、占用内存；#define无类型检查、全局有效、不占内存';
    wrongOptions = [
      'const不会占用内存空间，和#define一样仅是文本替换',
      'const和#define都在预处理阶段处理，没有区别',
      '#define有类型检查，比const更安全',
    ];
  } else if (domain.includes('头文件') || domain.includes('include')) {
    if (domain.includes('重复包含') || domain.includes('多重包含') || domain.includes('Include Guard') || domain.includes('防止')) {
      correctOption = '头文件保护通过#ifndef/#define/#endif或#pragma once防止头文件重复包含，避免重复定义错误';
      wrongOptions = [
        '头文件保护是C/C++标准强制要求的，所有编译器都必须支持#pragma once',
        '#ifndef/#define/#endif只能防止函数重定义，不能防止结构体重定义',
        '头文件中可以放变量定义和函数实现，只要加头文件保护即可',
      ];
    } else if (domain.includes('#include') && (domain.includes('<>') || domain.includes('""'))) {
      correctOption = '#include<>搜索系统头文件目录，#include""优先搜索当前目录再搜索系统目录';
      wrongOptions = [
        '#include""只搜索当前目录，不会搜索系统目录',
        '#include<>和#include""的搜索顺序完全相同，只是写法不同',
        '#include<>用于用户自定义头文件，#include""用于标准库头文件',
      ];
    } else if (domain.includes('头文件应放')) {
      correctOption = '头文件应放函数声明、类型定义、宏定义、extern声明；不应放变量定义和函数实现';
      wrongOptions = [
        '头文件中可以放变量定义和完整的函数实现，只要做好头文件保护即可',
        '头文件中应放所有需要的内容，包括变量定义和函数实现，方便使用',
        '头文件中只能放函数声明，不能放宏定义和类型定义',
      ];
    } else {
      correctOption = '头文件保护通过#ifndef/#define/#endif防止重复包含，避免重复定义错误';
      wrongOptions = [
        '头文件保护可以解决循环包含问题',
        '头文件中可以放变量定义，只要用了头文件保护就不会出错',
        '#pragma once是C/C++标准规定的头文件保护方式',
      ];
    }
  } else if (domain.includes('#error')) {
    correctOption = '#error是预处理器指令，在预处理阶段生成编译错误并终止编译，用于条件编译检测和平台要求检查';
    wrongOptions = [
      '#error在编译阶段生成编译警告，不影响编译继续进行',
      '#error用于在运行期输出错误信息并终止程序',
      '#error只能用在函数内部，不能用在全局作用域',
    ];
  } else if (domain.includes('#ifdef') || domain.includes('#ifndef')) {
    correctOption = '#ifdef判断宏是否已定义，#ifndef判断宏是否未定义，常用于条件编译和头文件保护';
    wrongOptions = [
      '#ifdef和#ifndef可以判断宏的值是否为真，而不仅仅是是否定义',
      '#ifdef和#if defined()功能完全不同，不能互换使用',
      '#ifndef只能用于头文件保护，不能用于其他条件编译场景',
    ];
  } else if (domain.includes('volatile') && !domain.includes('const volatile') && !domain.includes('mutable')) {
    correctOption = 'volatile告诉编译器变量值可能在程序控制之外改变，禁止编译器优化假设，每次访问都从内存读取';
    wrongOptions = [
      'volatile可以保证变量的原子性和线程安全性',
      'volatile用于提高变量访问速度，允许编译器缓存寄存器中的值',
      'volatile和const不能同时修饰同一个变量，两者语义冲突',
    ];
  } else if (domain.includes('register')) {
    correctOption = 'register建议编译器将变量放入寄存器以提高访问速度，不能取地址，现代编译器中已基本失去实际意义';
    wrongOptions = [
      'register关键字可以修饰任意变量，包括全局变量和静态变量',
      'register修饰的变量一定存放在CPU寄存器中，速度最快',
      'register变量可以对其使用&运算符获取地址',
    ];
  } else if (domain.includes('const') && domain.includes('volatile')) {
    correctOption = 'const和volatile可以同时使用，const约束程序不可写入，volatile约束编译器每次从内存读取';
    wrongOptions = [
      'const和volatile是互斥的，不能同时修饰同一个变量',
      'const volatile变量通常放在ROM中，硬件无法修改',
      'volatile可以保证const volatile变量的线程安全',
    ];
  } else if (domain.includes('const int') || domain.includes('int const') || domain.includes('const int const')) {
    correctOption = 'const int*是指向常量的指针（内容不可改），int* const是常量指针（指向不可改），const int* const两者都不可改';
    wrongOptions = [
      'const int*和int* const含义相同，都表示指针和指向内容都不能修改',
      'int* const可以通过解引用修改指针的值（即改变指向的地址）',
      'const int* const可以修改指针指向的地址，但不能修改指向的内容',
    ];
  } else if (domain.includes('整型溢出') || domain.includes('浮点精度')) {
    correctOption = '整型溢出超过范围后无符号整数回绕、有符号整数未定义行为；浮点数精度丢失因二进制无法精确表示某些十进制小数';
    wrongOptions = [
      '整型溢出时C语言会抛出异常，程序可以捕获并处理',
      '浮点数0.1在二进制中可以精确表示，不存在精度丢失',
      '有符号整数溢出时结果是确定的可预测的，只是数值错误',
    ];
  } else if (domain.includes('结构体') && domain.includes('共用体')) {
    correctOption = '结构体各成员独立内存（大小为各成员之和+填充），共用体成员共享内存（大小为最大成员）';
    wrongOptions = [
      '结构体和共用体的大小都等于各成员大小之和',
      '修改共用体一个成员的值不影响其他成员的值',
      '结构体成员共享同一块内存空间，与共用体相同',
    ];
  } else if (domain.includes('指针类型转换') || domain.includes('类型转换的风险')) {
    correctOption = '指针类型转换可能导致类型不匹配未定义行为、对齐要求不满足引起总线错误、丢失const限定等问题';
    wrongOptions = [
      '指针类型转换是完全安全的，只要转换后的类型大小相同',
      '去掉const修饰符后修改只读数据是安全的，因为内存是可写的',
      '不同类型的指针转换后访问内存，结果与预期一致',
    ];
  } else if (domain.includes('sizeof') && domain.includes('strlen')) {
    correctOption = 'sizeof计算内存大小（含\'\\0\'）是编译期运算，strlen计算字符串长度（不含\'\\0\'）运行期遍历到\'\\0\'';
    wrongOptions = [
      'sizeof和strlen都可以用来计算字符串的实际字符个数',
      'sizeof(指针)在函数内部也能正确返回数组的大小',
      'strlen和sizeof对任何字符串都返回相同的值',
    ];
  } else if (domain.includes('位与') || domain.includes('按位')) {
    correctOption = '按位与(&)清位、按位或(|)置位、按位异或(^)切换位，广泛用于寄存器配置和位操作';
    wrongOptions = [
      '按位与操作用于设置指定的位为1，按位或用于清除指定的位',
      '按位异或操作常用于将特定位设置为1而不是切换状态',
      '位运算的优先级高于算术运算符，使用时不需要加括号',
    ];
  } else if (domain.includes('数组名与指针') && !domain.includes('地址')) {
    correctOption = '数组名不是指针，在表达式中会退化为指针。数组名是常量地址不可修改，sizeof返回整个数组大小';
    wrongOptions = [
      '数组名就是指向数组首元素的指针常量，sizeof返回指针大小',
      '数组名可以自增自减，可以赋值给另一个数组名',
      '数组名和指针在函数参数中行为完全不同，编译器能区分',
    ];
  } else if (domain.includes('数组指针') && domain.includes('指针数组')) {
    correctOption = 'int (*p)[10]是数组指针（指向整个数组的指针），int *p[10]是指针数组（存放指针的数组）';
    wrongOptions = [
      'int (*p)[10]是指针数组，包含10个int指针元素',
      'int *p[10]是数组指针，指向包含10个int的数组',
      '数组指针的sizeof(p)返回10 × 指针大小，指针数组的sizeof(p)返回指针大小',
    ];
  } else if (domain.includes('指针使用场景')) {
    correctOption = '指针用于函数参数传址、动态内存管理、数组操作、构建复杂数据结构、回调函数、硬件访问等';
    wrongOptions = [
      '指针主要用于简化代码，在不需要修改实参时应优先使用指针传参',
      '指针不能用于函数指针和回调机制，回调需要使用函数重载',
      '在嵌入式开发中，指针不能用于直接访问硬件寄存器地址',
    ];
  } else if (domain.includes('C和C++区别')) {
    correctOption = 'C面向过程，C++支持OOP（封装、继承、多态）、模板、RAII、更强的类型安全和更丰富的标准库';
    wrongOptions = [
      'C++完全兼容C，所有C代码都可以不加修改地在C++编译器上编译',
      'C和C++的类型检查严格程度相同，没有明显差异',
      'C++的性能明显低于C，因为面向对象特性带来了额外开销',
    ];
  } else if (domain.includes('三大特性') || domain.includes('四大特性')) {
    correctOption = 'C++三大特性是封装、继承、多态；四大特性增加抽象。封装隐藏实现、继承复用代码、多态动态行为';
    wrongOptions = [
      'C++三大特性是封装、继承、模板；四大特性增加多态',
      '封装是指将类内部所有成员都设为private，不允许外部访问',
      '多态只能通过虚函数实现，函数重载不属于多态范畴',
    ];
  } else if (domain.includes('继承') && !domain.includes('单继承') && !domain.includes('多继承') && !domain.includes('虚继承') && !domain.includes('多重继承') && !domain.includes('隐藏')) {
    correctOption = '继承是派生类复用基类成员的机制，体现is-a关系，支持public/protected/private三种继承方式';
    wrongOptions = [
      'private继承方式下，基类的public成员在派生类中变为public',
      'C++中struct的默认继承方式是private，class的默认继承方式是public',
      '继承只支持代码复用，不支持行为扩展和多态',
    ];
  } else if (domain.includes('C++编译时') && domain.includes('C')) {
    correctOption = 'C++编译时使用名字修饰(name mangling)支持函数重载和模板，用extern "C"指定C链接方式避免链接错误';
    wrongOptions = [
      'C++和C的编译方式完全相同，不需要特殊处理即可混合编译',
      'extern "C"用于将C++代码编译为C语言，使其能在C项目中调用',
      'C++的名字修饰规则在所有编译器中都是统一的，不会导致链接问题',
    ];
  } else if (domain.includes('struct') && domain.includes('class')) {
    correctOption = 'C++中struct和class功能几乎等价，区别在于默认访问权限（struct为public，class为private）和默认继承权限';
    wrongOptions = [
      'C++中的struct不能有成员函数，只能包含数据成员',
      'struct和class的默认继承权限都是private，没有区别',
      'C++中的struct不支持继承和多态，这些特性只能用于class',
    ];
  } else if (domain.includes('public') && domain.includes('protected') && domain.includes('private')) {
    correctOption = 'public任何地方可访问，protected类内和派生类可访问，private仅类内可访问';
    wrongOptions = [
      'protected成员可以在类外部直接通过对象访问',
      'private成员可以在派生类中直接访问',
      'public成员只能在类内部访问，不能在类外部访问',
    ];
  } else if (domain.includes('常量成员函数')) {
    correctOption = 'const成员函数保证不修改对象成员变量，this指针变为const A*，可被const对象调用，不能修改普通成员变量';
    wrongOptions = [
      'const成员函数可以修改任何成员变量的值',
      'const对象不能调用const成员函数，只能调用非const成员函数',
      'const成员函数中的this指针类型没有变化，和普通成员函数相同',
    ];
  } else if (domain.includes('new') && domain.includes('malloc')) {
    correctOption = 'new是运算符，调用构造函数分配内存+构造对象；malloc是函数，只分配内存不初始化。new失败抛异常，malloc返回NULL';
    wrongOptions = [
      'new和malloc都只分配内存，不调用构造函数',
      'malloc分配内存失败时抛出std::bad_alloc异常',
      'new返回void*需要类型转换，malloc返回具体类型指针',
    ];
  } else if (domain.includes('enum class') || domain.includes('enum')) {
    correctOption = 'enum class是强类型枚举，作用域限定于类型内，不允许隐式转换为整数；传统enum无作用域限制，可隐式转为整数';
    wrongOptions = [
      'enum class的枚举值可以不通过类型名直接访问，与传统enum相同',
      '传统enum不会自动将枚举值转换为整型，类型安全检查严格',
      'enum class的枚举值可以直接与整数进行比较，无需显式转换',
    ];
  } else if (domain.includes('编译的四个过程') || domain.includes('编译四个过程')) {
    correctOption = '编译四过程：预处理（#include、宏替换、条件编译）→ 编译（语法/语义分析生成汇编）→ 汇编（生成目标文件）→ 链接（符号解析、重定位生成可执行文件）';
    wrongOptions = [
      '编译四过程为：汇编 → 预处理 → 编译 → 链接',
      '预处理阶段会进行语法分析和语义分析，检查代码正确性',
      '链接阶段主要负责将源代码翻译为汇编代码',
    ];
  } else if (domain.includes('左值引用') || domain.includes('右值引用')) {
    correctOption = '左值引用T&绑定到可寻址对象（左值），右值引用T&&绑定到临时对象（右值），支持移动语义和完美转发';
    wrongOptions = [
      '左值引用可以绑定到临时对象（右值），右值引用可以绑定到具名变量（左值）',
      '右值引用和左值引用的功能和用途完全相同，只是语法不同',
      '移动构造函数和拷贝构造函数性能相同，都涉及资源复制',
    ];
  } else if (domain.includes('传值方式') || domain.includes('几种传值')) {
    correctOption = 'C++传值方式：值传递（拷贝）、指针传递（地址副本）、引用传递（别名）、常量引用传递（const T&，推荐）、右值引用传递（移动语义）';
    wrongOptions = [
      'C++中只有值传递和指针传递两种方式，引用传递本质也是值传递',
      '常量引用传递不支持临时对象，只能传递具名变量',
      '引用传递会产生拷贝开销，与值传递性能相同',
    ];
  } else if (domain.includes('typedef') && domain.includes('using')) {
    correctOption = 'using语法更直观（别名=类型），支持模板别名（别名模板）；typedef语法繁琐，不支持模板别名';
    wrongOptions = [
      'typedef和using都支持模板别名的定义，功能完全相同',
      'using不支持模板别名，只能定义简单的类型别名',
      'typedef的语法比using更简洁直观，更推荐使用',
    ];
  } else if (domain.includes('野指针') || domain.includes('悬挂指针')) {
    correctOption = '野指针未初始化指向随机地址，悬挂指针指向已释放内存。避免方法：指针定义即初始化、释放后置NULL、使用智能指针';
    wrongOptions = [
      '野指针和悬挂指针没有区别，是同一个概念的不同叫法',
      '指针释放后只要不立即置NULL，系统会自动回收该地址',
      '悬挂指针只有在使用malloc/free时才会出现，new/delete不会产生',
    ];
  } else if (domain.includes('默认初始化') && domain.includes('类成员')) {
    correctOption = '内置类型局部变量不会自动初始化（值未定义），全局/静态变量自动初始化为0；类成员变量的初始化取决于构造函数';
    wrongOptions = [
      '所有内置类型变量无论定义在哪里都会自动初始化为0',
      '类成员变量如果没有显式初始化，一定会自动初始化为0',
      '全局变量和局部变量的初始化规则完全相同，都自动初始化为0',
    ];
  } else if (domain.includes('内联函数')) {
    correctOption = 'inline是对编译器的建议，编译器可选择忽略。适合短小频繁调用的函数，不适合大函数、递归、循环和虚函数';
    wrongOptions = [
      'inline关键字强制编译器将函数内联展开，编译器不能忽略',
      '递归函数和包含循环的函数适合使用内联优化',
      '内联函数必须放在源文件中定义，不能放在头文件中',
    ];
  } else if (domain.includes('nullptr') || domain.includes('NULL')) {
    correctOption = 'nullptr是C++11引入的类型安全的空指针关键字，只能与指针类型比较或赋值；NULL是宏可能被当作整数0';
    wrongOptions = [
      'nullptr和NULL在C++中完全等价，使用上没有区别',
      'nullptr不能用于指针类型的比较，只能赋值为空',
      'NULL作为空指针使用时不会与其他类型混淆，是类型安全的',
    ];
  } else if (domain.includes('构造函数') && domain.includes('析构函数') && domain.includes('调用顺序')) {
    correctOption = '构造函数调用顺序：先基类构造函数→成员变量构造→派生类构造函数；析构函数顺序相反：先派生类→后基类';
    wrongOptions = [
      '构造函数和析构函数的调用顺序相同，都是先基类后派生类',
      '成员变量的构造发生在基类构造函数之前',
      '析构函数调用顺序：先基类析构函数→后派生类析构函数',
    ];
  } else if (domain.includes('拷贝构造函数') && domain.includes('移动构造函数')) {
    correctOption = '拷贝构造函数(const T&)复制资源可能产生深拷贝开销，移动构造函数(T&&)转移资源所有权更高效，源对象被置为空';
    wrongOptions = [
      '拷贝构造函数和移动构造函数都使用const左值引用作为参数',
      '移动构造函数会复制源对象的资源，和拷贝构造函数行为相同',
      '拷贝构造函数通过右值引用创建新对象，移动构造函数通过左值引用创建新对象',
    ];
  } else if (domain.includes('智能指针') && !domain.includes('RAII')) {
    correctOption = 'unique_ptr独占所有权不可拷贝可移动，shared_ptr引用计数共享所有权，weak_ptr弱引用解决循环引用';
    wrongOptions = [
      'unique_ptr和shared_ptr都使用引用计数管理所有权',
      'weak_ptr会增加shared_ptr的引用计数，导致资源无法释放',
      'shared_ptr可以自动解决循环引用问题，不需要weak_ptr',
    ];
  } else if (domain.includes('初始化列表') && domain.includes('赋值')) {
    correctOption = '初始化列表直接初始化成员效率更高，const成员和引用成员必须用初始化列表；赋值先默认构造再赋值效率较低';
    wrongOptions = [
      '初始化列表和赋值在性能上没有区别，编译器会自动优化',
      'const成员和引用成员可以在构造函数体内通过赋值初始化',
      '初始化列表中成员的初始化顺序按照列表中的书写顺序执行',
    ];
  } else if (domain.includes('虚函数') && domain.includes('纯虚函数')) {
    correctOption = '虚函数有默认实现可被重写，纯虚函数(=0)无实现强制派生类实现。包含纯虚函数的类是抽象类不能实例化';
    wrongOptions = [
      '纯虚函数可以在基类中提供默认实现，派生类可以选择性重写',
      '包含纯虚函数的类可以实例化对象，只是不能调用纯虚函数',
      '虚函数和纯虚函数都需要在派生类中重写，否则编译报错',
    ];
  } else if (domain.includes('虚函数') && domain.includes('抽象类')) {
    correctOption = '纯虚函数没有函数体强制派生类实现，抽象类包含至少一个纯虚函数不能实例化，可包含普通成员函数';
    wrongOptions = [
      '抽象类不能包含普通成员函数，只能包含纯虚函数',
      '纯虚函数可以有默认实现，派生类不重写也能调用',
      '抽象类可以直接实例化，只是不能调用纯虚函数',
    ];
  } else if (domain.includes('单继承') && domain.includes('多继承')) {
    correctOption = '单继承简单清晰，多继承可继承多个基类但复杂，可能出现菱形继承问题需用虚继承解决';
    wrongOptions = [
      '多继承不会出现命名冲突和菱形继承问题',
      '单继承和多继承在实现复杂度和清晰度上没有区别',
      '菱形继承问题可以通过在派生类中使用using声明解决',
    ];
  } else if (domain.includes('多态') && (domain.includes('VTable') || domain.includes('VTable'))) {
    correctOption = '运行时多态通过虚函数表和虚指针实现。每个含虚函数的类有一张vtable，对象存储vptr指向vtable实现动态绑定';
    wrongOptions = [
      '每个对象都有自己的虚函数表副本，存储在栈中',
      '虚函数调用在编译期就确定了函数地址，属于静态绑定',
      '不含虚函数的类也有vptr指针，只是指向空的虚函数表',
    ];
  } else if (domain.includes('虚函数表') && domain.includes('共享')) {
    correctOption = '同一个类的所有对象共享同一张VTable（存储在静态存储区），不同类有各自的VTable';
    wrongOptions = [
      '每个对象都拥有独立的VTable副本，互不共享',
      '派生类和基类共享同一张VTable，重写函数不影响表内容',
      'VTable存储在栈区，随对象创建和销毁',
    ];
  } else if (domain.includes('引用或 const 时如何初始化') || domain.includes('引用或const')) {
    correctOption = '引用成员和const成员必须在构造函数的初始化列表中初始化，不能在构造函数体内赋值';
    wrongOptions = [
      '引用成员和const成员可以在构造函数体内通过赋值初始化',
      'const成员可以在定义后再赋值修改，引用成员可以重新绑定',
      '引用成员可以默认初始化（不绑定任何对象），const成员可以默认初始化',
    ];
  } else if (domain.includes('虚函数可以内联')) {
    correctOption = '虚函数通过对象调用时可以内联（非多态），通过指针/引用多态调用时不会内联；纯虚函数本身不能内联（无实现）';
    wrongOptions = [
      '虚函数在任何情况下都不能内联，因为调用地址在运行时才确定',
      '虚函数通过基类指针多态调用时也可以内联展开',
      '纯虚函数本身可以直接内联，派生类实现无需内联',
    ];
  } else if (domain.includes('接口类')) {
    correctOption = '接口类只包含纯虚函数，不能实例化，需声明虚析构函数。用于策略模式、工厂模式和回调机制';
    wrongOptions = [
      '接口类可以包含普通成员函数和成员变量，提供部分默认实现',
      '接口类不需要声明虚析构函数，默认析构函数足够',
      '接口类可以直接实例化，只是部分功能不可用',
    ];
  } else if (domain.includes('虚析构函数')) {
    correctOption = '基类析构函数必须为virtual，否则delete基类指针指向派生类对象时只调用基类析构函数导致派生类资源泄漏';
    wrongOptions = [
      '基类析构函数是否为虚函数不影响派生类对象的销毁，编译器会自动处理',
      '只有抽象类的析构函数需要声明为virtual，普通基类不需要',
      '虚析构函数会增加对象大小，所以能不虚就不虚，即使做基类也尽量不用',
    ];
  } else if (domain.includes('构造函数为什么') && domain.includes('虚函数')) {
    correctOption = '构造函数不能是虚函数，因为对象未完全构建时vptr未初始化，且语义上构造不是运行时多态行为';
    wrongOptions = [
      '构造函数可以是虚函数，只要在基类构造函数中调用派生类版本即可实现多态构造',
      '构造函数不能是虚函数的原因是虚函数需要返回值和构造函数不兼容',
      '构造函数调用虚函数时会调用派生类重写版本，实现部分多态行为',
    ];
  } else if (domain.includes('虚继承') || domain.includes('菱形继承') || domain.includes('钻石问题')) {
    correctOption = '虚继承解决菱形继承问题，确保最底层派生类只有一个虚基类实例，虚基类构造函数由最底层派生类负责调用';
    wrongOptions = [
      '虚继承会让每个派生类都拥有独立的基类实例，总共多个实例',
      '虚基类的构造函数由中间派生类（如B和C）负责调用',
      '虚继承不会引入额外的性能开销，与普通继承效率相同',
    ];
  } else if (domain.includes('模板') && !domain.includes('模板函数') && !domain.includes('类模板') && !domain.includes('模板别') && !domain.includes('模板特化') && !domain.includes('模板实例化') && !domain.includes('typename') && !domain.includes('template')) {
    correctOption = '模板是C++泛型编程机制，分为函数模板和类模板，编译期实例化生成具体类型代码，支持特化';
    wrongOptions = [
      '模板在运行期根据传入类型进行实例化',
      '函数模板和类模板都不支持特化，只能使用通用版本',
      '模板实例化后的代码与类型无关，不同类型共享同一份代码',
    ];
  } else if (domain.includes('虚函数') && domain.includes('模板函数')) {
    correctOption = '虚函数不能是模板函数。虚函数需要固定地址放入vtable，模板函数编译期按类型实例化多版本，无法统一放入vtable';
    wrongOptions = [
      '虚函数可以是模板函数，模板参数在调用时推导即可放入vtable',
      '模板类中的虚函数可以是模板函数，由编译器特殊处理',
      '虚函数和模板函数都是编译期确定，两者可以兼容',
    ];
  } else if (domain.includes('基类指针') && domain.includes('非虚函数')) {
    correctOption = '基类指针指向派生类对象调用非虚函数时，执行静态绑定调用基类版本，不会调用派生类的重写';
    wrongOptions = [
      '基类指针指向派生类对象时，无论是否为虚函数都会调用派生类版本',
      '非虚函数也会通过vtable查找，只是查找方式不同',
      '基类指针调用非虚函数时，如果派生类有同名函数则调用派生类版本',
    ];
  } else if (domain.includes('explicit')) {
    correctOption = 'explicit用于禁止单参数构造函数的隐式类型转换，C++11起也可修饰转换运算符，单参数构造函数建议一律加explicit';
    wrongOptions = [
      'explicit用于允许隐式类型转换，默认构造函数需要显式调用',
      'explicit只能修饰转换运算符，不能修饰构造函数',
      '多参数构造函数也需要加explicit防止隐式转换，即使所有参数都有默认值',
    ];
  } else if (domain.includes('运算符重载') || domain.includes('重载运算符')) {
    if (domain.includes('流操作符') || domain.includes('<<') || domain.includes('>>')) {
      correctOption = '流操作符<<和>>通常重载为友元非成员函数，返回ostream&或istream&以支持链式调用';
      wrongOptions = [
        '流操作符<<和>>必须重载为成员函数，不能是非成员函数',
        '流操作符重载时不需要返回流对象引用，返回void即可',
        '输出流操作符的参数应使用值传递而非常量引用，以避免修改原对象',
      ];
    } else if (domain.includes('++') || domain.includes('自增')) {
      correctOption = '前置++返回当前对象引用(*this)，后置++返回自增前对象副本（参数int用于区分），后置++需要创建副本效率较低';
      wrongOptions = [
        '前置++和后置++都返回当前对象的引用，性能相同',
        '后置++的int参数有实际含义，可以传入任意整数值',
        '前置++返回对象副本，后置++返回对象引用',
      ];
    } else if (domain.includes('赋值运算符')) {
      correctOption = '类包含动态申请资源时需重载赋值运算符实现深拷贝，需检查自我赋值、释放旧资源、返回*this支持链式赋值';
      wrongOptions = [
        '编译器自动生成的赋值运算符已经实现了深拷贝，不需要手动重载',
        '赋值运算符重载不需要检查自我赋值，编译器会自动处理',
        '赋值运算符应返回void，不支持链式赋值也没关系',
      ];
    } else if (domain.includes('成员函数重载') || domain.includes('非成员函数')) {
      correctOption = '成员函数重载第一个操作数隐式通过this传递，非成员函数重载需显式传递所有操作数，可配合friend访问私有成员';
      wrongOptions = [
        '非成员函数重载运算符可以自动访问类的私有成员，不需要friend',
        '成员函数重载和非成员函数重载的操作数传递方式完全相同',
        '所有运算符都必须重载为成员函数，不能重载为非成员函数',
      ];
    } else {
      correctOption = '运算符重载不能改变优先级和结合性，不能创建新运算符，不能重载::/./.*/?:/sizeof/typeid';
      wrongOptions = [
        '运算符重载可以改变运算符的优先级和结合性',
        'C++允许创建新的运算符如**（乘方运算符）',
        '所有C++运算符都可以被重载，包括::和.',
      ];
    }
  } else if (domain.includes('函数重载')) {
    correctOption = '函数重载要求同一作用域中函数名相同、参数列表不同（数量/类型/顺序），返回值不能作为唯一区分条件';
    wrongOptions = [
      '函数重载可以通过不同的返回值类型来区分同名函数',
      'C语言也支持函数重载，只是语法略有不同',
      '函数重载要求参数列表完全相同，通过返回值类型区分',
    ];
  } else if (domain.includes('拷贝构造函数作用') && !domain.includes('移动构造')) {
    correctOption = '拷贝构造函数用一个同类型对象初始化另一个对象，用于对象初始化、值传递、值返回，需注意深拷贝问题';
    wrongOptions = [
      '拷贝构造函数参数可以是值传递，不需要使用引用',
      '编译器不会自动生成拷贝构造函数，必须由程序员手动定义',
      '拷贝构造函数只能用于对象初始化，不能用于函数参数传递',
    ];
  } else if (domain.includes('深拷贝') && domain.includes('浅拷贝')) {
    correctOption = '浅拷贝直接复制成员值（指针只复制地址），深拷贝复制指针指向的内容。含动态资源的类需要深拷贝';
    wrongOptions = [
      '浅拷贝和深拷贝在多线程环境下的行为完全相同',
      '深拷贝比浅拷贝效率更高，因为不需要额外分配内存',
      '所有类都应该使用浅拷贝，深拷贝是不必要的',
    ];
  } else if (domain.includes('重写') && !domain.includes('隐藏')) {
    correctOption = '重写要求基类函数virtual、函数名参数返回类型相同，override关键字提供编译期检查防止签名不一致';
    wrongOptions = [
      '重写不要求基类函数是virtual，只要派生类定义同名函数即可',
      'override关键字不是必须的，不加override也能保证正确的重写行为',
      '重写时参数列表可以不同，只要函数名相同即可',
    ];
  } else if (domain.includes('函数模板') && domain.includes('类模板')) {
    correctOption = '函数模板通过调用参数自动推导类型，类模板必须显式指定类型或通过推导确定';
    wrongOptions = [
      '函数模板必须显式指定类型参数，不能自动推导',
      '类模板可以像函数模板一样通过构造函数参数自动推导类型（C++17前也支持）',
      '函数模板和类模板都不支持特化，只能使用通用定义',
    ];
  } else if (domain.includes('隐藏') && !domain.includes('继承')) {
    correctOption = '派生类定义与基类同名函数时隐藏基类函数（无论参数是否相同），可用作用域运算符::或using声明恢复访问';
    wrongOptions = [
      '只有派生类函数与基类函数参数相同时才会发生隐藏',
      '隐藏会产生多态，通过基类指针可以调用派生类隐藏的函数',
      '如果基类函数是virtual，则不会发生隐藏，一定是重写',
    ];
  } else if (domain.includes('特化')) {
    correctOption = '全特化为具体类型完全定制实现，偏特化部分类型参数定制化处理。using支持别名模板比typedef更简洁';
    wrongOptions = [
      '偏特化是为所有类型参数提供完全定制的实现，与全特化相同',
      'typedef支持别名模板，可以像using一样定义模板别名',
      '模板特化只能用于类模板，不能用于函数模板',
    ];
  } else if (domain.includes('模拟多态') || domain.includes('模拟继承')) {
    correctOption = 'C语言通过结构体嵌套模拟继承、函数指针模拟多态、不同函数名和_Generic模拟函数重载';
    wrongOptions = [
      'C语言原生支持继承和多态，不需要使用特殊技巧模拟',
      'C语言通过宏可以直接实现运行时多态，比C++虚函数更高效',
      '函数指针模拟多态时不需要手动管理类型安全，编译器会自动检查',
    ];
  } else if (domain.includes('原子性') || domain.includes('临界区')) {
    correctOption = '保证原子性的方法：互斥锁、自旋锁、读写锁、原子操作（std::atomic）。简单操作用atomic，复杂操作用互斥锁';
    wrongOptions = [
      'volatile关键字可以保证临界区操作的原子性',
      '自旋锁适用于锁持有时间较长的场景，效率很高',
      '读写锁在写操作多的时候效率很高，比互斥锁更适合所有场景',
    ];
  } else if (domain.includes('模板实例化')) {
    correctOption = '模板实例化发生在编译期，在使用模板时（调用函数/创建对象）实例化，可采用延迟实例化和显式实例化控制';
    wrongOptions = [
      '模板实例化发生在运行期，程序运行时根据数据类型生成代码',
      '模板定义本身就会生成机器代码，不实例化也可以执行',
      '模板实例化后生成的代码与类型无关，所有类型共享相同的机器代码',
    ];
  } else if (domain.includes('typename') || domain.includes('template')) {
    correctOption = 'typename用于指示依赖模板参数的名字是类型，template用于模板模板参数。两者解决模板中类型名和模板的歧义问题';
    wrongOptions = [
      'typename和template在模板编程中可以互换使用，功能相同',
      'typename只能用于非模板代码中，模板中不需要使用',
      'template关键字不能用于模板模板参数，只能用于函数模板',
    ];
  } else if (domain.includes('静态绑定') && domain.includes('动态绑定')) {
    correctOption = '静态绑定在编译期确定函数调用地址（非虚函数/重载/模板），动态绑定在运行期通过vtable确定（虚函数）';
    wrongOptions = [
      '静态绑定和动态绑定都是运行期确定函数地址，只是机制不同',
      '动态绑定的效率高于静态绑定，因为运行期可以优化',
      '所有函数默认都是动态绑定，只有加virtual才是静态绑定',
    ];
  } else if (domain.includes('mutable') && domain.includes('volatile')) {
    correctOption = 'mutable突破const限制让特定成员在const对象中可修改；volatile禁止编译器优化，每次从内存读取';
    wrongOptions = [
      'mutable和volatile都可以用于修饰全局变量和局部变量',
      'mutable可以用于修饰任何变量，不限于类成员变量',
      'volatile主要用于在const成员函数中修改成员变量值',
    ];
  } else if (domain.includes('内存泄漏') && domain.includes('可能发生')) {
    correctOption = '内存泄漏产生原因：忘记free/delete、指针重新赋值丢失地址、异常路径未释放、循环引用、容器指针未释放';
    wrongOptions = [
      'C++的智能指针可以完全杜绝所有类型的内存泄漏',
      '内存泄漏只发生在堆内存中，栈内存和静态内存不会泄漏',
      '程序退出时操作系统不会回收泄漏的内存，会一直占用',
    ];
  } else if (domain.includes('栈溢出')) {
    correctOption = '栈溢出原因：无限递归、局部变量过大、函数调用层级过深、指针越界。栈空间有限（通常几百KB到几MB）';
    wrongOptions = [
      '栈空间通常很大（几百MB），一般不会出现栈溢出问题',
      '递归函数不会导致栈溢出，因为编译器会自动优化尾递归',
      '栈溢出只会导致程序运行缓慢，不会导致崩溃',
    ];
  } else if (domain.includes('字节对齐')) {
    if (domain.includes('为什么要') || domain.includes('为什么需要')) {
      correctOption = '字节对齐提高CPU访问效率（一次读取完整数据），满足硬件对齐要求，避免非对齐访问导致的异常或性能下降';
      wrongOptions = [
        '字节对齐是为了节省内存空间，减少结构体占用',
        '字节对齐只影响结构体，不影响基本类型的变量',
        '所有CPU都支持非对齐访问，对齐只是为了代码规范',
      ];
    } else {
      correctOption = '字节对齐通过在成员间插入填充字节实现，结构体大小为最大成员对齐数的整数倍，可用#pragma pack调整';
      wrongOptions = [
        '字节对齐时成员的存储顺序可以重排以节省空间',
        '#pragma pack(1)会提高访问效率，推荐所有结构体使用',
        '结构体的大小等于所有成员大小之和，与对齐无关',
      ];
    }
  } else if (domain.includes('static静态成员变量')) {
    correctOption = '静态成员变量属于类所有对象共享，存储在静态区，必须在类外初始化（C++11前），可通过类名或对象访问';
    wrongOptions = [
      '静态成员变量属于每个对象独有，每个对象有独立副本',
      '静态成员变量可以在类内直接初始化（所有类型C++11前也支持）',
      '静态成员变量存储在栈区，生命周期仅限于对象生命周期',
    ];
  } else if (domain.includes('静态成员函数') && (domain.includes('普通成员函数') || domain.includes('区别'))) {
    correctOption = '静态成员函数属于类不依赖对象，无this指针，只能访问静态成员；普通成员函数属于对象，可访问所有成员';
    wrongOptions = [
      '静态成员函数可以访问类的非静态成员变量，但需要通过对象参数传入',
      '静态成员函数和普通成员函数一样都有this指针',
      '静态成员函数可以声明为virtual，实现静态多态',
    ];
  } else if (domain.includes('静态变量') && domain.includes('初始化时机')) {
    correctOption = '全局静态变量和类静态成员在程序开始前初始化，函数内静态局部变量第一次执行到定义处时初始化（C++11起线程安全）';
    wrongOptions = [
      '所有静态变量都在程序开始前统一初始化，包括函数内的静态局部变量',
      '函数内静态局部变量每次函数调用都会重新初始化',
      '静态变量的初始化不是线程安全的，多线程环境需加锁',
    ];
  } else if (domain.includes('typeid') || domain.includes('RTTI')) {
    correctOption = 'typeid获取对象类型信息返回type_info对象，RTTI通过typeid和dynamic_cast实现运行时类型识别，需虚函数支持';
    wrongOptions = [
      'typeid可以用于没有虚函数的类，也能正确返回派生类的类型信息',
      'RTTI可以在编译期完全确定所有类型，不需要运行时开销',
      'type_info的name()返回的类型名称在所有编译器上格式相同',
    ];
  } else if (domain.includes('原子操作') && !domain.includes('atomic')) {
    correctOption = '原子操作不可分割，线程安全，无中断执行。常用于多线程同步、计数器、无锁数据结构，比互斥锁高效';
    wrongOptions = [
      '原子操作需要加锁来实现，和互斥锁性能相同',
      '原子操作在单核CPU上没有意义，不会提高任何性能',
      '所有数据类型都支持原子操作，包括大型结构体',
    ];
  } else if (domain.includes('友元')) {
    correctOption = '友元函数和友元类可以访问类的私有和保护成员，但破坏封装性，友元关系单向且不继承';
    wrongOptions = [
      '友元关系是双向的：A是B的友元，B自动也是A的友元',
      '友元关系可以继承：基类的友元自动成为派生类的友元',
      '友元函数是类的成员函数，可以通过this指针访问对象',
    ];
  } else if (domain.includes('类的大小')) {
    correctOption = '类大小受成员变量、字节对齐、vptr影响。静态成员变量和成员函数不占对象大小，虚函数增加vptr大小';
    wrongOptions = [
      '静态成员变量属于对象的一部分，会增加对象大小',
      '成员函数存储在对象中，每次调用都通过对象中的函数地址调用',
      '空类的大小为0字节，不占用任何内存空间',
    ];
  } else if (domain.includes('继承多个类') || domain.includes('多重继承')) {
    correctOption = '多重继承用class D : public B, public C语法同时继承多个基类，需处理命名冲突和菱形继承问题';
    wrongOptions = [
      '多重继承在C++中不推荐使用，因为编译器不支持',
      '多重继承不会出现命名冲突，编译器会自动选择最优版本',
      '菱形继承问题可以通过using声明解决，不需要虚继承',
    ];
  } else if (domain.includes('智能指针') && (domain.includes('智能指针及如何') || domain.includes('解决内存泄漏'))) {
    correctOption = '智能指针通过RAII自动管理动态内存：unique_ptr独占、shared_ptr共享引用计数、weak_ptr解决循环引用';
    wrongOptions = [
      '智能指针和裸指针性能完全相同，没有额外开销',
      '使用shared_ptr时永远不会出现内存泄漏',
      '智能指针不能用于数组，只能管理单个对象',
    ];
  } else if (domain.includes('RAII') || domain.includes('AII')) {
    if (domain.includes('RAII 原则在嵌入式') || domain.includes('嵌入式')) {
      correctOption = 'RAII在嵌入式开发中用于内存管理、锁管理、硬件资源（GPIO/SPI/I2C）管理和文件操作，确保资源自动释放';
      wrongOptions = [
        'RAII原则只在大型桌面应用中有用，嵌入式系统资源受限不适合使用',
        '嵌入式系统中使用RAII会增加内存开销，应尽量避免使用',
        'RAII在嵌入式系统中只能用于内存管理，不能管理硬件资源',
      ];
    } else {
      correctOption = 'RAII：资源在构造函数中获取、析构函数中释放，生命周期与对象绑定，自动管理资源防止泄漏';
      wrongOptions = [
        'RAII需要程序员手动调用资源释放函数，与手动管理没有区别',
        'RAII只在没有异常的程序中有效，有异常时析构函数不会自动调用',
        'RAII只能管理内存资源，不能管理文件句柄、锁等其他资源',
      ];
    }
  } else if (domain.includes('C++11特性') || domain.includes('C++11')) {
    correctOption = 'C++11主要特性：auto类型推导、Lambda表达式、右值引用移动语义、nullptr、智能指针、范围for、并发库等';
    wrongOptions = [
      'C++11引入的主要特性包括垃圾回收机制（GC），自动回收不再使用的内存',
      'C++11的auto关键字与C语言的auto含义相同，表示自动存储期',
      'C++11中智能指针（auto_ptr）被保留并推荐使用',
    ];
  } else if (domain.includes('四种强制转换') || domain.includes('强制转换')) {
    correctOption = 'static_cast常规转换编译期检查，dynamic_cast多态安全转换运行时检查，const_cast去const修饰，reinterpret_cast底层位重解释';
    wrongOptions = [
      'dynamic_cast可以在任意两种类型之间进行转换，不需要虚函数支持',
      'C++的四种强制转换与C语言的强制转换没有区别，只是写法不同',
      'reinterpret_cast常用于去除对象的const属性，修改只读数据',
    ];
  } else if (domain.includes('STL容器') || domain.includes('TL容器')) {
    correctOption = 'STL容器分顺序容器(vector/deque/list)、关联容器(set/map红黑树)和无序关联容器(unordered_set/map哈希表)及适配器';
    wrongOptions = [
      'STL中所有容器的底层都是基于数组实现的',
      '关联容器基于哈希表实现，支持O(1)的查找操作',
      'STL容器中list支持随机访问，访问任意元素的时间复杂度为O(1)',
    ];
  } else if (domain.includes('关联式容器') || domain.includes('联式容器')) {
    correctOption = '关联式容器基于红黑树实现，自动排序，查找/插入/删除O(logn)，包括set/multiset/map/multimap';
    wrongOptions = [
      '关联式容器基于哈希表实现，元素无序存储',
      '关联式容器中map的key可以修改，修改后会自动重新排序',
      'set和map的底层实现不同，set用红黑树map用哈希表',
    ];
  } else if (domain.includes('无序关联式容器') || domain.includes('序关联式容器')) {
    correctOption = '无序关联式容器基于哈希表实现，查找/插入/删除平均O(1)，最坏O(n)，元素无序存储';
    wrongOptions = [
      '无序关联式容器基于红黑树实现，元素自动排序',
      '无序关联式容器的查找时间复杂度始终为O(1)，不会退化',
      'unordered_map的遍历顺序是固定的，按照插入顺序输出',
    ];
  } else if (domain.includes('适配器容器') || domain.includes('配器容器')) {
    correctOption = '容器适配器封装已有容器提供特定接口：stack(LIFO)默认deque、queue(FIFO)默认deque、priority_queue(堆)默认vector';
    wrongOptions = [
      'stack的底层容器只能是deque，不能使用vector或list',
      'priority_queue默认是小顶堆，队首元素是最小值',
      'queue可以随机访问中间元素，支持迭代器遍历',
    ];
  } else if (domain.includes('优先级队列') || domain.includes('priority')) {
    correctOption = 'priority_queue是堆适配器，默认最大堆，push/pop O(logn)，top O(1)，底层vector+堆算法';
    wrongOptions = [
      'priority_queue默认是最小堆，队首元素是最小值',
      'priority_queue的push和pop操作都是O(1)常数时间复杂度',
      'priority_queue可以随机访问所有元素，不限于队首',
    ];
  } else if (domain.includes('vector') && domain.includes('list') && domain.includes('deque')) {
    correctOption = 'vector动态数组随机访问O(1)尾插快，list双向链表中间插入快O(1)不支持随机访问，deque双端队列头尾都快';
    wrongOptions = [
      'list支持随机访问，可以通过下标直接访问任意元素',
      'vector的中间插入和删除与list一样快，时间复杂度也是O(1)',
      'deque的底层是连续内存块，与vector完全相同',
    ];
  } else if (domain.includes('map') && domain.includes('unordered_map')) {
    correctOption = 'map基于红黑树有序O(logn)，unordered_map基于哈希表无序平均O(1)但最坏O(n)';
    wrongOptions = [
      'map基于哈希表实现，查找时间复杂度O(1)',
      'unordered_map元素自动排序，遍历顺序固定不变',
      'map和unordered_map的底层实现相同，都是红黑树',
    ];
  } else if (domain.includes('stack') && domain.includes('queue') && domain.includes('priority_queue')) {
    correctOption = 'stack默认deque基于LIFO，queue默认deque基于FIFO，priority_queue基于堆默认最大堆';
    wrongOptions = [
      'stack和queue的底层实现相同，都是基于vector',
      'priority_queue的底层是红黑树，保证始终有序',
      'queue支持在中间位置插入和删除元素',
    ];
  } else if (domain.includes('set') && domain.includes('unordered_set')) {
    correctOption = 'set基于红黑树有序O(logn)，unordered_set基于哈希表无序平均O(1)';
    wrongOptions = [
      'set基于哈希表实现，查找速度是O(1)',
      'unordered_set基于红黑树实现，元素自动排序',
      'set和unordered_set都支持修改容器中的元素值',
    ];
  } else if (domain.includes('iterator') && domain.includes('const_iterator')) {
    correctOption = 'iterator可修改元素，const_iterator只读不可修改元素。迭代器是容器统一的访问抽象，比指针更安全';
    wrongOptions = [
      'iterator和const_iterator的功能完全相同，只是名称不同',
      'const_iterator可以通过解引用修改容器中的元素',
      '迭代器和指针的行为在所有方面完全相同，可以互换使用',
    ];
  } else if (domain.includes('vector扩容') || domain.includes('ector的扩容') || domain.includes('扩容机制')) {
    if (domain.includes('为什么') || domain.includes('2倍')) {
      correctOption = '2倍扩容保证摊还时间复杂度O(1)，避免频繁分配内存，在效率和空间利用之间取得平衡';
      wrongOptions = [
        'vector扩容采用1.5倍更好，因为2倍会导致太多内存浪费',
        'vector每次扩容增加固定大小（如+10）效率更高，内存利用率更好',
        'vector扩容采用3倍策略更常见，2倍只是个别编译器的实现',
      ];
    } else {
      correctOption = 'vector扩容流程：检查容量→分配更大内存（通常2倍）→拷贝/移动旧元素→释放旧内存→更新指针和容量';
      wrongOptions = [
        'vector扩容时不会拷贝旧元素，而是直接在原有内存上扩展',
        'vector扩容后所有迭代器、指针和引用仍然有效，不需要重新获取',
        'vector每次插入元素都会触发扩容操作，不管当前容量是否足够',
      ];
    }
  } else if (domain.includes('迭代器删除') || domain.includes('删除元素')) {
    correctOption = 'vector/deque删除后删除点之后迭代器失效；list/set/map只使被删除元素迭代器失效。使用erase返回的迭代器安全遍历';
    wrongOptions = [
      '所有容器的迭代器在删除元素后都会全部失效',
      'vector中删除元素不会使任何迭代器失效',
      '在遍历set时删除元素后，不能继续使用任何迭代器',
    ];
  } else if (domain.includes('auto') && (domain.includes('decltype') || domain.includes('decltype(auto)'))) {
    correctOption = 'auto值类型推导不保留引用，decltype精确类型保留引用和const，decltype(auto)推导并保留引用';
    wrongOptions = [
      'auto会保留表达式的引用类型和const修饰符',
      'decltype(auto)和auto完全相同，只是写法不同',
      'decltype可以根据函数返回值类型推导，但不能用于变量声明',
    ];
  } else if (domain.includes('哈希碰撞') || domain.includes('哈希冲突')) {
    correctOption = '哈希碰撞是不同输入得到相同哈希值，哈希冲突是不同键映射到同一个桶。解决方法：链地址法、开放地址法、再哈希';
    wrongOptions = [
      '好的哈希函数可以完全避免哈希碰撞和哈希冲突',
      '链地址法和开放地址法对所有哈希表的性能影响相同',
      '哈希冲突只影响插入操作，不影响查找和删除操作',
    ];
  } else if (domain.includes('range-based for') || domain.includes('基于范围') || domain.includes('range-based')) {
    correctOption = 'range-based for底层通过begin()和end()迭代器遍历，支持值拷贝、引用、const引用三种方式';
    wrongOptions = [
      'range-based for循环不能修改容器中的元素，因为元素是只读的',
      'range-based for循环只能用于数组，不能用于STL容器',
      'range-based for循环每次迭代都拷贝元素，使用引用也不能避免拷贝',
    ];
  } else if (domain.includes('如何检测内存泄漏') || domain.includes('检测内存泄漏')) {
    correctOption = '检测内存泄漏的方法：代码审查检查malloc/free配对、Valgrind/ASan工具检测、分配计数统计、堆空间监控';
    wrongOptions = [
      'Valgrind只能在Windows系统上检测内存泄漏',
      '代码中不需要成对管理malloc和free，操作系统会自动回收',
      'ASan只能在Debug模式下工作，Release模式下无法使用',
    ];
  } else if (domain.includes('避免内存泄漏')) {
    correctOption = '避免内存泄漏：明确谁申请谁释放、规范释放流程、失败路径统一释放、减少动态内存使用、C++使用RAII';
    wrongOptions = [
      '只要在程序结束时调用free就能避免所有内存泄漏问题',
      '使用全局变量管理动态内存指针可以完全避免内存泄漏',
      '在嵌入式系统中应该大量使用malloc和free，因为内存池更复杂',
    ];
  } else if (domain.includes('检测内存碎片')) {
    correctOption = '内存碎片检测：动态内存分配失败但剩余内存充足、堆空间监控、内存使用曲线异常、长时间运行后大块分配失败';
    wrongOptions = [
      '内存碎片可以通过重启程序来检测，不需要工具',
      '内存碎片只在32位系统上出现，64位系统没有内存碎片问题',
      'malloc返回NULL一定是因为内存不足，不可能是因为内存碎片',
    ];
  } else if (domain.includes('为什么需要内存池') || domain.includes('为什么需要内存池')) {
    correctOption = '内存池避免内存碎片、提高分配速度(O(1))、提高系统稳定性、满足实时性要求，适合嵌入式和长期运行系统';
    wrongOptions = [
      '内存池比malloc/free更容易产生内存碎片',
      '内存池的分配时间不确定，不适合实时系统',
      '内存池适用于各种大小差异很大的对象分配场景',
    ];
  } else if (domain.includes('重复包含') || domain.includes('多重包含保护')) {
    correctOption = '重复包含原因：同一.c文件多次包含同一头文件、头文件相互嵌套包含。使用Include Guard或#pragma once防止';
    wrongOptions = [
      '头文件只会被包含一次，编译器会自动去重',
      '重复包含头文件最多产生编译警告，不会导致编译错误',
      '#pragma once是所有编译器都支持的C/C++标准特性',
    ];
  } else if (domain.includes('为什么需要 volatile') || domain.includes('为什么需要volatile')) {
    correctOption = '不用volatile时编译器可能将变量缓存到寄存器、消除重复读取、重排读写顺序，导致中断/多线程/硬件寄存器读取错误';
    wrongOptions = [
      'volatile可以解决所有多线程编程中的数据竞争问题',
      '编译器从来不会优化变量的读取操作，不需要volatile',
      'volatile在多核CPU上可以保证缓存一致性',
    ];
  } else if (domain.includes('volatile') && domain.includes('不能做')) {
    correctOption = 'volatile不能保证原子性、不能保证线程安全、不能替代互斥锁和内存屏障';
    wrongOptions = [
      'volatile可以保证多线程对共享变量的互斥访问',
      'volatile可以替代互斥锁用于保护临界区',
      'volatile能够保证复合操作的原子性，如i++',
    ];
  } else if (domain.includes('为什么有了 C') || domain.includes('为什么有了C')) {
    correctOption = 'C++在不牺牲性能前提下提高可维护性、可扩展性和抽象能力，适合中大型工程和复杂系统开发';
    wrongOptions = [
      'C++比C慢很多，因为面向对象特性带来了巨大性能开销',
      'C和C++完全一样，C++只是C的语法糖没有实质性改进',
      'C++不适合底层系统开发，驱动和内核只能用C语言编写',
    ];
  } else if (domain.includes('为什么使用内联函数') || domain.includes('为什么使用内联')) {
    correctOption = '内联函数减少函数调用开销、提高执行效率，比宏更安全（有类型检查和作用域），适合短小频繁调用的函数';
    wrongOptions = [
      '内联函数和宏一样没有类型检查，使用时需要小心',
      '所有函数都应该使用inline关键字以提高性能',
      '内联函数会增加函数调用开销，应尽量避免使用',
    ];
  } else if (domain.includes('虚函数为什么') && domain.includes('内联')) {
    correctOption = '虚函数通过指针多态调用时运行期才能确定函数地址，无法在编译期内联展开。通过对象直接调用时可以内联';
    wrongOptions = [
      '虚函数永远不能内联，即使通过对象直接调用也不行',
      '通过基类指针多态调用虚函数时也可以内联展开',
      '编译器总是可以将虚函数内联，vtable查找不影响内联',
    ];
  } else if (domain.includes('inline + virtual')) {
    correctOption = 'inline + virtual语法合法，inline只是建议，多态调用时仍不会内联，通过对象调用时可能内联';
    wrongOptions = [
      'inline和virtual不能同时使用，编译器会报语法错误',
      '同时使用inline和virtual时，inline强制内联优先级更高',
      'inline virtual函数在多态调用时也可以正常内联',
    ];
  } else if (domain.includes('explicit 是什么') || domain.includes('explicit是什么')) {
    correctOption = 'explicit是C++关键字，修饰构造函数禁止隐式类型转换，C++11起也可修饰转换运算符';
    wrongOptions = [
      'explicit关键字用于允许隐式类型转换，让代码更简洁',
      'explicit只对多参数构造函数有效，单参数不需要',
      'explicit修饰的构造函数在C++11以后已被弃用',
    ];
  } else if (domain.includes('为什么需要 explicit')) {
    correctOption = 'C++允许单参数构造函数作为隐式转换构造函数，容易引入隐式难察觉的错误，explicit可防止此类隐式转换';
    wrongOptions = [
      '隐式类型转换在C++中是被禁止的，不会发生',
      'explicit会让构造函数无法被调用，包括显式调用',
      '所有构造函数默认都是explicit的，不需要手动添加',
    ];
  } else if (domain.includes('为什么要使用 override')) {
    correctOption = 'override提供编译期检查确保真正重写基类虚函数，防止因函数签名不一致导致伪重写（意外隐藏而非重写）';
    wrongOptions = [
      'override关键字不是必需的，不写override也能保证正确的重写行为',
      'override用于声明一个新的虚函数，不是用于检查重写',
      '基类函数不需要virtual，只要派生类写了override就能重写',
    ];
  } else if (domain.includes('为什么要用 Lambda') || domain.includes('为什么要用Lambda')) {
    correctOption = 'Lambda代码更简洁就地使用，可以捕获外部变量，适合临时回调，与STL算法和多线程适配，可被内联优化';
    wrongOptions = [
      'Lambda表达式比普通函数调用效率低很多',
      'Lambda不能访问外部作用域的局部变量',
      'Lambda只能用在STL算法中，其他场景不能使用',
    ];
  } else if (domain.includes('C语言的基本类型')) {
    correctOption = '32位系统中：char(1)、short(2)、int(4)、long(4)、float(4)、double(8)、指针(4)、long long(8)';
    wrongOptions = [
      '32位系统中：int(2)、long(8)、指针(4)、double(4)',
      '32位系统中指针占8字节，long占4字节',
      '64位系统中int占8字节，long占4字节',
    ];
  } else if (domain.includes('调用约定')) {
    correctOption = '__cdecl参数从右到左压栈，调用者清理栈，支持可变参数；__stdcall参数从右到左压栈，被调用者清理栈';
    wrongOptions = [
      '__cdecl参数从左到右压栈，被调用者清理栈',
      '__stdcall支持可变参数，常用于C/C++默认调用约定',
      '__cdecl和__stdcall的参数压栈顺序不同，前者从右到左，后者从左到右',
    ];
  } else {
    // Generic fallback — extract key sentence from answer
    const cleanAns = ans.replace(/[*#`]/g, '').trim();
    const firstSentence = cleanAns.split(/[。\n]/).filter(s => s.trim().length > 10)[0] || cleanAns.substring(0, 60);
    correctOption = firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;

    // Generate plausible wrong options based on common patterns
    const swapWords = [
      ['栈', '堆'],
      ['堆', '栈'],
      ['全局', '局部'],
      ['局部', '全局'],
      ['public', 'private'],
      ['private', 'public'],
      ['编译', '运行'],
      ['运行', '编译'],
      ['增加', '减少'],
      ['减少', '增加'],
      ['O(1)', 'O(n)'],
      ['O(n)', 'O(log n)'],
      ['O(log n)', 'O(1)'],
      ['O(log n)', 'O(n²)'],
    ];

    const usedOptions = new Set();
    wrongOptions = [];

    // Try to create wrong options by swapping key terms
    for (const [a, b] of swapWords) {
      if (wrongOptions.length >= 3) break;
      if (correctOption.includes(a)) {
        const opt = correctOption.replace(new RegExp(a, 'g'), b);
        if (opt !== correctOption && !usedOptions.has(opt)) {
          usedOptions.add(opt);
          wrongOptions.push(opt);
        }
      }
    }

    // Fill remaining with generic wrong options
    const generics = [
      '上述描述完全正确，无任何错误',
      '以上说法都不正确，实际情况恰恰相反',
      '该知识点没有标准答案，视编译器实现而定',
    ];
    while (wrongOptions.length < 3) {
      const g = generics[wrongOptions.length % generics.length];
      if (!usedOptions.has(g)) {
        usedOptions.add(g);
        wrongOptions.push(g);
      }
    }
  }

  // Ensure we have exactly 3 wrong options
  while (wrongOptions.length < 3) {
    wrongOptions.push('以上说法都不正确，实际情况与此相反');
  }

  // Shuffle: combine correct + wrong, shuffle, track index
  const allOptions = shuffle([correctOption, ...wrongOptions]);
  const correctIdx = allOptions.indexOf(correctOption);

  return { choices: allOptions, correct_idx: correctIdx };
}

// Process all questions
let updated = 0;
let skipped = 0;
for (const q of questions) {
  if (q.choices && q.choices !== null && Array.isArray(q.choices) && q.choices.length > 0) {
    skipped++;
    continue;
  }

  const result = generateChoices(q);
  q.choices = result.choices;
  q.correct_idx = result.correct_idx;
  updated++;
}

console.log(`Updated: ${updated} questions, Skipped (already have choices): ${skipped}`);
writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
console.log('Done!');
