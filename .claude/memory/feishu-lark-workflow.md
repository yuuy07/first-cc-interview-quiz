# 飞书文档嵌入表格提取工作流

## 环境
- 工具：`@larksuite/cli` (npm global install)
- 项目目录：`/Users/xkkk/Documents/FIRST CC/`
- 已配置 App ID: `cli_aa8aaa455978dbec`

## 完整工作流

### 1. 初始化 & 授权
```bash
lark-cli config init --new
lark-cli auth login --scope "docx:document:readonly"    # 读文档
lark-cli auth login --scope "sheets:spreadsheet:read"    # 读表格值
lark-cli auth login --scope "sheets:spreadsheet.meta:read"  # 读表格元数据
lark-cli auth login --domain wiki                         # wiki 域
```
- `auth login` 会生成浏览器链接，用户打开授权后才继续

### 2. 读取飞书文档
```bash
lark-cli docs +fetch --api-version v2 --as user --doc "<URL>" --doc-format markdown
```

### 3. 提取嵌入的电子表格
文档中的 `<sheet sheet-id="xxx" token="YYY">` 标签代表嵌入的电子表格。
```bash
# 查看所有 sheet 页
lark-cli sheets +info --as user --spreadsheet-token "<token>"
# 读取具体 sheet
lark-cli sheets +read --as user --spreadsheet-token "<token>" --range "<sheet-id>!A1:C7"
```

### 4. 替换到本地 Markdown
- 本地手动维护的文件有 `[TABLE]` 占位符
- 从飞书直接下载的 `.md` 文件有 `<sheet>` 标签
- 都需要读取 `sheets +read` 获取实际数据后替换为 Markdown 表格

## 注意事项
- Bot 身份无法访问用户资源，必须用 `--as user`
- 不同操作需要不同的 scope，按需多次 `auth login`（scope 会累积）
- 文档格式：`markdown` 适合阅读，`xml`（默认）包含完整 block 结构
