// 渲染层：正方形备忘录的交互逻辑。视图：edit → result(含对话精修) → quiz → 评价。

interface Window {
  api: {
    getDate: () => Promise<string>;
    getMemoryCount: () => Promise<number>;
    generate: (summary: string) => Promise<string>;
    refine: (message: string) => Promise<string>;
    save: (payload: {
      summary: string;
      keyPoints: string[];
      details: string;
      focus: string[];
    }) => Promise<{ ok: boolean; id: string; date: string }>;
    makeQuiz: (excludeId: string | null) => Promise<{
      questions: string;
      enough: boolean;
      count: number;
    }>;
    evaluate: (answers: string) => Promise<string>;
    minimize: () => void;
    close: () => void;
    openExternal: (url: string) => void;
  };
}

// —— 极简 Markdown → HTML（覆盖标题/列表/加粗/代码/段落） ——
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,6}\s+/.test(line)) {
      closeLists();
      const level = line.match(/^#+/)![0].length;
      const text = inline(escapeHtml(line.replace(/^#+\s+/, "")));
      out.push(`<h${level}>${text}</h${level}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\s*[-*]\s+/, "")))}</li>`);
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\s*\d+\.\s+/, "")))}</li>`);
    } else if (line.trim() === "") {
      closeLists();
      out.push("");
    } else {
      closeLists();
      out.push(`<p>${inline(escapeHtml(line))}</p>`);
    }
  }
  closeLists();
  return out.join("\n");
}

// —— 视图切换 ——
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const views = {
  edit: $("view-edit"),
  result: $("view-result"),
  quiz: $("view-quiz"),
};
function show(view: "edit" | "result" | "quiz"): void {
  (Object.keys(views) as (keyof typeof views)[]).forEach((k) =>
    views[k].classList.toggle("hidden", k !== view)
  );
}

// —— 加载遮罩 ——
const loading = $("loading");
const loadingText = $("loading-text");
function setLoading(on: boolean, text = "生成中…"): void {
  loading.classList.toggle("hidden", !on);
  loadingText.textContent = text;
}

// —— 状态 ——
let currentSummary = "";
let currentMarkdown = "";
let savedId: string | null = null;

// —— 初始化 ——
async function init(): Promise<void> {
  $("date").textContent = await window.api.getDate();
  await refreshCount();

  $("btn-min").addEventListener("click", () => window.api.minimize());
  $("btn-close").addEventListener("click", () => window.api.close());

  $("btn-generate").addEventListener("click", onGenerate);
  $("btn-refine").addEventListener("click", onRefine);
  $("refine-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onRefine();
  });
  $("btn-back").addEventListener("click", () => show("edit"));
  $("btn-save").addEventListener("click", onSave);
  $("btn-evaluate").addEventListener("click", onEvaluate);
  $("btn-finish").addEventListener("click", () => window.api.close());
}

async function refreshCount(): Promise<void> {
  const n = await window.api.getMemoryCount();
  $("mem-count").textContent = `记忆 ${n} 条`;
}

async function onGenerate(): Promise<void> {
  const summary = ($("summary") as HTMLTextAreaElement).value.trim();
  if (!summary) return;
  currentSummary = summary;
  currentMarkdown = "";
  setLoading(true, "生成细节与重难点…");
  try {
    const md = await window.api.generate(summary);
    currentMarkdown = md;
    renderResult(md);
    show("result");
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

function renderResult(md: string): void {
  $("result-area").innerHTML = mdToHtml(md);
}

async function onRefine(): Promise<void> {
  const input = $("refine-input") as HTMLInputElement;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  appendChat("me", msg);
  setLoading(true, "修改中…");
  try {
    const md = await window.api.refine(msg);
    currentMarkdown = md;
    renderResult(md);
    appendChat("ai", "已更新 ↑");
  } catch (err) {
    appendChat("ai", "出错了：" + (err as Error).message);
  } finally {
    setLoading(false);
  }
}

function appendChat(who: "me" | "ai", text: string): void {
  const log = $("chat-log");
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function onSave(): Promise<void> {
  if (!currentMarkdown) return;
  const { keyPoints, focus } = extractLists(currentMarkdown);
  setLoading(true, "保存到本地记忆…");
  try {
    const res = await window.api.save({
      summary: currentSummary,
      keyPoints,
      details: currentMarkdown,
      focus,
    });
    savedId = res.id;
    await refreshCount();
    appendChat("ai", `已保存（${res.date}），开始巩固抽查…`);
    await startQuiz();
  } catch (err) {
    setLoading(false);
    alert((err as Error).message);
  }
}

// 从生成的 Markdown 里抽取要点列表与重难点列表，作为结构化字段存入记忆。
function extractLists(md: string): { keyPoints: string[]; focus: string[] } {
  const lines = md.split("\n");
  const keyPoints: string[] = [];
  const focus: string[] = [];
  let mode: "kp" | "fp" | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s+/i.test(line)) {
      const t = line.replace(/^#+\s+/, "").toLowerCase();
      if (t.includes("要点") || t.includes("key")) mode = "kp";
      else if (t.includes("重难点") || t.includes("难点") || t.includes("重点") || t.includes("focus")) mode = "fp";
      else mode = null;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const text = line.replace(/^([-*]|\d+\.)\s+/, "");
      if (mode === "kp") keyPoints.push(text);
      else if (mode === "fp") focus.push(text);
    }
  }
  return { keyPoints, focus };
}

async function startQuiz(): Promise<void> {
  setLoading(true, "从记忆随机抽两道题…");
  try {
    const res = await window.api.makeQuiz(savedId);
    if (!res.enough) {
      $("quiz-area").innerHTML =
        `<p class="hint">记忆中目前共 ${res.count} 条，凑不够两道不重复的抽查题。下次记录新内容后即可开始抽查。</p>`;
      show("quiz");
      return;
    }
    $("quiz-area").innerHTML = mdToHtml(res.questions);
    show("quiz");
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

async function onEvaluate(): Promise<void> {
  const answers = ($("answer-input") as HTMLTextAreaElement).value.trim();
  if (!answers) return;
  setLoading(true, "评点中…");
  try {
    const text = await window.api.evaluate(answers);
    const area = $("quiz-area");
    area.innerHTML = mdToHtml(text) + area.innerHTML;
    ($("answer-input") as HTMLTextAreaElement).value = "";
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

init();
