import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  readMemory,
  appendEntry,
  pickRandom,
  todayISO,
  makeId,
  MemoryEntry,
} from "./memory";
import { StudyAgent } from "./llm";

dotenv.config();

let win: BrowserWindow | null = null;
const studyAgent = new StudyAgent();
let lastQuizQuestions = "";

function createWindow(): void {
  win = new BrowserWindow({
    width: 380,
    height: 380,
    minWidth: 320,
    minHeight: 320,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    transparent: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  win.on("ready-to-show", () => win?.show());

  // 把窗口拖动交给渲染层 header 的 -webkit-app-region 处理，无需在此监听。
}

// —— IPC —— //

ipcMain.handle("memory:count", async () => (await readMemory()).length);

ipcMain.handle("llm:generate", async (_e, summary: string) => {
  if (!summary?.trim()) throw new Error("请先输入今日学习总括与要点。");
  return studyAgent.generate(summary);
});

ipcMain.handle("llm:refine", async (_e, message: string) => {
  if (!message?.trim()) throw new Error("请输入修改意见。");
  return studyAgent.refine(message);
});

ipcMain.handle("entry:save", async (_e, payload: { summary: string; keyPoints: string[]; details: string; focus: string[] }) => {
  const entry: MemoryEntry = {
    id: makeId(),
    date: todayISO(),
    summary: payload.summary,
    keyPoints: payload.keyPoints,
    details: payload.details,
    focus: payload.focus,
  };
  await appendEntry(entry);
  return { ok: true, id: entry.id, date: entry.date };
});

ipcMain.handle("quiz:make", async (_e, excludeId: string | null) => {
  const entries = await readMemory();
  const picked = pickRandom(entries, 2, excludeId ?? undefined);
  if (picked.length < 2) {
    return { questions: "", enough: false, count: entries.length };
  }
  const text = await studyAgent.quiz(picked[0], picked[1]);
  lastQuizQuestions = text;
  return { questions: text, enough: true, count: entries.length };
});

ipcMain.handle("quiz:evaluate", async (_e, answers: string) => {
  const text = await studyAgent.evaluate(lastQuizQuestions, answers);
  return text;
});

ipcMain.handle("ui:date", () => todayISO());

ipcMain.on("win:minimize", () => win?.minimize());
ipcMain.on("win:close", async () => {
  await studyAgent.dispose();
  win?.close();
});

ipcMain.on("open:external", (_e, url: string) => shell.openExternal(url));

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // macOS 上应用通常保留驻留；这里为单窗口小工具，直接退出更直观
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
