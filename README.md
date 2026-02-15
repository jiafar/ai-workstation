# AI Workstation

个人全能工作台 IDE - 集成 AI、终端、Git、内存管理等功能的一体化开发环境。

## 功能特性

### 🤖 AI 集成
- 支持 OpenAI (GPT) 和 Anthropic (Claude) 双提供商
- 流式对话响应
- Embedding 支持
- 可切换模型

### 💻 代码编辑
- Monaco Editor (VS Code 同款)
- 多标签页支持
- 自动保存
- 语法高亮

### 🖥️ 终端
- 集成终端 (node-pty)
- 多标签终端
- xterm.js 渲染

### 📁 文件管理
- 文件浏览器
- 快速打开 (⌘P)
- 文件搜索

### 🔧 Git 集成
- 状态查看
- Diff 对比
- Commit / Add / Branch
- Push / Pull / Fetch
- Stash 管理
- Checkout / Merge

### 🧠 四层记忆系统
- L1: 工作记忆 (当前会话)
- L2: 项目记忆 (项目相关)
- L3: 个人记忆 (用户偏好)
- L4: 知识库 (RAG 检索)

### ⚡ Skill 系统
- 可扩展的技能插件
- 代码生成、文件整理等
- 进度回调支持

### 🔄 Workflow 引擎
- 可视化工作流编辑器
- 条件分支
- 并行执行
- 人工确认节点

### 🎯 Ritual 仪式系统
- 定时任务
- 事件触发
- 自动化工作流

### 💾 数据库
- SQLite (better-sqlite3)
- 向量数据库 (LanceDB)

## 技术栈

- **框架**: Electron 33 + React 18
- **构建**: Vite + electron-vite
- **语言**: TypeScript 5.7
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **编辑器**: Monaco Editor
- **终端**: node-pty + xterm.js

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 打包
```bash
npm run package
```

## 配置

### AI 提供商配置

创建 `~/.ai-workstation/config.json`:

```json
{
  "aiProviders": {
    "defaultProvider": "anthropic",
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4-turbo-preview"
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-3-5-sonnet-20241022"
    }
  }
}
```

或使用环境变量:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘P | 快速打开文件 |
| ⌘S | 保存文件 |
| ⌘W | 关闭标签页 |
| ⌘N | 新建文件 |
| ⌘Shift+P | 命令面板 |

## 项目结构

```
ai-workstation/
├── electron/           # 主进程代码
│   ├── index.ts       # 入口
│   ├── preload.ts     # 预加载脚本
│   ├── ipc/           # IPC handlers
│   ├── services/      # 核心服务
│   └── utils/         # 工具函数
├── src/               # 渲染进程代码
│   ├── components/    # React 组件
│   ├── hooks/         # 自定义 hooks
│   ├── store/         # Zustand stores
│   └── types/         # TypeScript 类型
└── package.json
```

## License

MIT
