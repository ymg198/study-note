import { Agent, CursorAgentError, type SDKAgent, type Run } from "@cursor/sdk";

// 使用 @cursor/sdk（TypeScript 版 Cursor SDK）在 Electron 主进程中调用 Cursor 代理。
// 一个"学习条目会话"复用同一个 agent，使对话式精修保留上下文。

const MODEL_ID = "composer-2.5";

export class StudyAgent {
  private agent: SDKAgent | null = null;

  private async getAgent(): Promise<SDKAgent> {
    if (this.agent) return this.agent;
    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      throw new Error("未设置 CURSOR_API_KEY，请在项目根目录 .env 中配置。");
    }
    this.agent = await Agent.create({
      apiKey,
      model: { id: MODEL_ID },
      local: { cwd: process.cwd() },
    });
    return this.agent;
  }

  /** 收集一次 run 的全部 assistant 文本，并等待结束。 */
  private async collectText(run: Run): Promise<string> {
    let text = "";
    try {
      for await (const event of run.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message.content) {
            if (block.type === "text") text += block.text;
          }
        }
      }
    } catch {
      // 流中断时仍尝试 wait 以拿到终态
    }
    const result = await run.wait();
    if (result.status === "error") {
      throw new Error(`生成失败（run ${result.id}），请在 Cursor 中检查运行记录。`);
    }
    return text.trim();
  }

  /** 基于今日总括+要点生成"细节展开"与"重难点"（Markdown）。 */
  async generate(summary: string): Promise<string> {
    const agent = await this.getAgent();
    const prompt = [
      "你是学习记录助手。用户输入了今日学习总括与要点：",
      "-----",
      summary,
      "-----",
      "请输出两部分（用 Markdown）：",
      "1. 细节展开：对该学习内容的深入讲解与补充，2–4 段，把总括里讲不透的地方讲清楚。",
      "2. 重难点：3–5 条，每条为一句话难点/易错点/重点 + 一句简短说明。",
      "只输出这两部分，不要寒暄。",
    ].join("\n");
    const run = await agent.send(prompt);
    return this.collectText(run);
  }

  /** 对话式精修：用户提出修改意见，agent 在已有上下文基础上调整输出。 */
  async refine(message: string): Promise<string> {
    const agent = await this.getAgent();
    const run = await agent.send(message);
    return this.collectText(run);
  }

  /** 基于从记忆中随机抽取的两条旧条目，生成两道巩固题。 */
  async quiz(
    entryA: { summary: string; keyPoints: string[]; focus: string[] },
    entryB: { summary: string; keyPoints: string[]; focus: string[] }
  ): Promise<string> {
    const agent = await this.getAgent();
    const fmt = (e: { summary: string; keyPoints: string[]; focus: string[] }) =>
      `总括：${e.summary}\n要点：${e.keyPoints.join("、")}\n重难点：${e.focus.join("、")}`;
    const prompt = [
      "请基于以下两条学习记忆，各出一道考察题，用于巩固复习：",
      "条目一：",
      fmt(entryA),
      "",
      "条目二：",
      fmt(entryB),
      "",
      "要求：",
      "- 题目形式多样（简答/辨析/应用/举反例等），不要直接复述原文。",
      "- 用「题1」「题2」编号。",
      "- 每道题后另起一行写「参考要点：…」给出简短判定线索，便于自测。",
      "只输出两道题，不要寒暄。",
    ].join("\n");
    const run = await agent.send(prompt);
    return this.collectText(run);
  }

  /** 评价用户对巩固题的作答。 */
  async evaluate(questions: string, answers: string): Promise<string> {
    const agent = await this.getAgent();
    const prompt = [
      "以下是刚才出的两道巩固题与用户的作答，请逐题简评（对/偏/错）并作必要补充：",
      "题目：",
      questions,
      "",
      "用户作答：",
      answers,
      "",
      "输出简洁的逐题点评即可。",
    ].join("\n");
    const run = await agent.send(prompt);
    return this.collectText(run);
  }

  async dispose(): Promise<void> {
    if (this.agent) {
      try {
        this.agent.close();
      } catch {
        // 忽略销毁错误
      }
      this.agent = null;
    }
  }
}

export { CursorAgentError };
