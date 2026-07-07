# study-note · 桌面学习备忘录

![build](https://github.com/ymg198/study-note/actions/workflows/build.yml/badge.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg)
![sdk](https://img.shields.io/badge/Cursor%20SDK-%40cursor%2Fsdk-orange.svg)

一个正方形、置顶的桌面小备忘录学习助手。点击即可编辑今日学习总括与要点，调用 Cursor SDK 生成"细节展开"与"重难点"，支持对话式精修，最终保存后从本地记忆中随机抽取两道旧条目生成巩固题并评分。

> 截图位：建议运行 `npm start` 后截一张正方形备忘录的图，保存为 `docs/screenshot.png`，在此处引用：
> `![study-note 截图](docs/screenshot.png)`

## 功能

- 正方形备忘录窗口，macOS 毛玻璃 + 暖黄便签纸样式，标题栏可拖动、置顶显示。
- **编辑**：写下今日学习总括与要点 → 点"生成学习内容"。
- **生成**：调用 Cursor SDK（`@cursor/sdk`）输出细节展开与重难点（Markdown）。
- **对话精修**：在结果页底部输入修改意见（如"重难点再精简""补一个例子"），同一 agent 保留上下文持续调整。
- **保存**：点"完成并保存"后按日期写入本地记忆 `~/learning-journal/memory.json`（与 Cursor 中的 `learning-journal` 技能共享同一份记忆）。
- **巩固抽查**：保存后自动从全部记忆中随机抽 2 条**不同**的旧条目，各出一道题，可作答并由 agent 逐题点评。

## 技术栈

- Electron + TypeScript（主进程 / preload / 渲染层）
- `@cursor/sdk`（TypeScript 版 Cursor SDK，跑在主进程，本地运行时）
- 记忆：本地 JSON 文件，结构见下文

## 前置要求

1. **Node.js** ≥ 18
2. **Cursor API Key**：到 [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) 创建一个用户密钥。
3. 本机已安装并登录 Cursor（本地运行时会复用 Cursor 环境）。

## 安装与运行

```bash
cd ~/Projects/study-note
cp .env.example .env
# 编辑 .env，填入你的 CURSOR_API_KEY
npm install
npm start          # 编译并启动桌面备忘录
```

开发模式（改动自动重编译，需手动重启 electron 或使用）：

```bash
npm run dev        # 并行运行 tsc -w 与 electron
```

## 配置

`.env`：

```
CURSOR_API_KEY=cursor_xxxxxxxx
```

## 记忆文件

路径：`~/learning-journal/memory.json`，JSON 数组，每条结构：

```json
{
  "id": "20260704-160000",
  "date": "2026-07-04",
  "summary": "用户输入的总括",
  "keyPoints": ["要点1", "要点2"],
  "details": "生成的细节展开（Markdown）",
  "focus": ["重难点1", "重难点2"]
}
```

只追加、不修改既有条目。桌面应用与 Cursor 聊天里的 `learning-journal` 技能共用此文件，两种入口记录的学习会互相可见、共同构成抽查题库。

## 使用流程

1. 启动后窗口出现在屏幕左上区域，置顶。
2. 在编辑区写下今天的总括与要点，点"生成学习内容"。
3. 查看生成的细节与重难点；如需调整，在底部对话框输入意见并发送，可多轮精修。
4. 满意后点"完成并保存" → 自动按日期写入记忆 → 立即弹出两道从旧记忆中随机抽取的巩固题。
5. 在作答区写下答案，点"提交作答"获取逐题点评；点"结束"关闭窗口。

## 自动构建（CI）

仓库自带 GitHub Actions（`.github/workflows/build.yml`）：每次向 `main` 推送或发起 PR，会自动在 Ubuntu 上执行 `npm install` + `npm run build`，并校验 `dist/` 产物是否齐全。CI 跳过 Electron 二进制下载（构建只需 TypeScript 编译），速度快。顶部 `build` 徽章实时反映状态。

## 备注

- 抽查题需记忆 ≥ 2 条才会出题；首次记录后提示"记忆尚少"，下次即开始抽查。
- 模型默认 `composer-2.5`，可在 `src/main/llm.ts` 顶部 `MODEL_ID` 处更换。
- 若 `npm install` 时 Electron 二进制下载失败（github 被墙），可临时设置镜像：
  ```bash
  export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
  npm install
  ```
- 推送代码到 GitHub 若终端连不上，挂上代理：`export HTTPS_PROXY=http://127.0.0.1:你的代理端口`。
