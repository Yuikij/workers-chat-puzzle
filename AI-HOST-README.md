# 海龟汤 AI 主持人功能

## 🎯 功能概述

本项目在原有的海龟汤多人轮流发言功能基础上，新增了 **AI 主持人模式**。AI 主持人可以：

- 📚 从预设题库中选择海龟汤题目
- 🤖 智能回答玩家的问题（是/不是/没有关系）
- 📊 对每个问题进行 1-10 分评分
- 📈 实时跟踪玩家接近真相的进度
- 💡 在合适时机给出提示

## 🚀 快速开始

### 1. 环境配置

首先设置必要的环境变量：

```bash
# LLM API 配置
export LLM_API_URL="https://api.openai.com/v1"
export LLM_API_KEY="your-api-key-here"
export LLM_MODEL="gpt-4"

# 可选配置
export LLM_MAX_TOKENS="1000"
export LLM_TEMPERATURE="0.7"
export GAME_MAX_QUESTIONS="50"
```

### 2. 本地开发

```bash
# 启动开发服务器
wrangler dev

# 或指定环境
wrangler dev --env development
```

### 3. 生产部署

```bash
# 设置生产环境的 API Key
wrangler secret put LLM_API_KEY

# 部署到生产环境
wrangler deploy --env production
```

## 🎮 使用方法

### 启动 AI 主持模式

1. 进入聊天室
2. 点击 **🤖 AI主持模式** 按钮
3. AI 会随机选择一个海龟汤题目并开始游戏

### 游戏流程

1. **阅读题目**：AI 会展示"汤面"（题目描述）
2. **提出问题**：在聊天框中输入你的问题
3. **AI 回答**：AI 会回答"是"、"不是"或"没有关系"
4. **获得评分**：每个问题会获得 1-10 分的评分
5. **查看进度**：顶部状态栏显示解谜进度
6. **获得提示**：进度达到一定程度时 AI 会给出提示
7. **解决谜题**：当进度达到 95% 以上时即可解决

### 游戏界面

- **题目信息**：显示当前题目标题和描述
- **游戏统计**：实时显示问题数、平均分和进度
- **进度条**：可视化显示接近真相的程度
- **结束按钮**：发起人可随时结束游戏

## 📁 项目结构

```
src/
├── data/
│   ├── puzzles.json          # 海龟汤题库
│   └── prompts.json          # AI 提示词配置
├── lib/
│   ├── llm-client.mjs        # LLM API 客户端
│   ├── prompt-manager.mjs    # 提示词管理
│   ├── puzzle-manager.mjs    # 题库管理
│   └── ai-host.mjs           # AI 主持人核心逻辑
├── config/
│   └── ai-config.mjs         # AI 配置管理
├── chat.mjs                  # 后端主文件
└── chat.html                 # 前端页面
```

## 🔧 配置选项

### LLM 配置

| 环境变量 | 默认值 | 说明 |
|---------|-------|-----|
| `LLM_API_URL` | `https://api.openai.com/v1` | LLM API 地址 |
| `LLM_API_KEY` | - | LLM API 密钥 |
| `LLM_MODEL` | `gpt-4` | 使用的模型 |
| `LLM_MAX_TOKENS` | `1000` | 最大令牌数 |
| `LLM_TEMPERATURE` | `0.7` | 回答随机性 |

### 游戏配置

| 环境变量 | 默认值 | 说明 |
|---------|-------|-----|
| `GAME_MAX_QUESTIONS` | `50` | 每轮最大问题数 |
| `RESPONSE_ENABLE_EMOJI` | `true` | 启用表情符号 |

## 📚 题库管理

### 添加新题目

编辑 `src/data/puzzles.json`：

```json
{
  "id": "custom_001",
  "title": "题目标题",
  "difficulty": "简单",
  "category": "自定义",
  "tags": ["标签1", "标签2"],
  "surface": "这里是汤面描述...",
  "truth": "这里是汤底真相...",
  "keywords": ["关键词1", "关键词2"],
  "hints": [
    "第一个提示",
    "第二个提示"
  ]
}
```

### 题目属性

- **id**: 唯一标识符
- **title**: 题目标题
- **difficulty**: 难度（简单/中等/困难）
- **category**: 分类（经典/现代/悬疑等）
- **surface**: 汤面（题目描述）
- **truth**: 汤底（真相答案）
- **keywords**: 关键词列表（用于评分）
- **hints**: 提示列表（按难度递增）

## 🎨 自定义提示词

编辑 `src/data/prompts.json` 来自定义 AI 的行为：

```json
{
  "system": {
    "role": "你是专业的海龟汤主持人...",
    "rules": [
      "只能回答是/不是/没有关系",
      "根据汤底判断问题正确性"
    ]
  }
}
```

## 🔍 故障排查

### 常见问题

1. **AI 不响应**
   - 检查 LLM API 密钥是否正确
   - 确认网络连接正常
   - 查看控制台错误日志

2. **题目不显示**
   - 检查 `puzzles.json` 格式是否正确
   - 确认 JSON 文件已正确部署

3. **评分异常**
   - 检查 `prompts.json` 中的评分标准
   - 确认 AI 返回格式正确

### 调试模式

启用详细日志：

```bash
wrangler dev --local --verbose
```

## 📖 API 文档

### 消息协议

**发起 AI 主持模式**
```json
{
  "aiHostRequest": true,
  "puzzleId": "puzzle_001", // 可选
  "filters": {} // 可选过滤条件
}
```

**向 AI 提问**
```json
{
  "aiQuestion": true,
  "question": "用户的问题"
}
```

**AI 回答**
```json
{
  "aiResponse": true,
  "response": {
    "answer": "是",
    "score": 8,
    "feedback": "很好的问题",
    "progress": 65,
    "hint": "考虑声音的作用" // 可选
  }
}
```

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支
3. 添加新的题目或优化 AI 逻辑
4. 提交 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源。

---

**享受 AI 主持的海龟汤游戏体验吧！** 🐢🤖