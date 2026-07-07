import { contextBridge, ipcRenderer } from "electron";

const api = {
  getDate: (): Promise<string> => ipcRenderer.invoke("ui:date"),
  getMemoryCount: (): Promise<number> => ipcRenderer.invoke("memory:count"),

  generate: (summary: string): Promise<string> => ipcRenderer.invoke("llm:generate", summary),
  refine: (message: string): Promise<string> => ipcRenderer.invoke("llm:refine", message),

  save: (payload: {
    summary: string;
    keyPoints: string[];
    details: string;
    focus: string[];
  }): Promise<{ ok: boolean; id: string; date: string }> =>
    ipcRenderer.invoke("entry:save", payload),

  makeQuiz: (excludeId: string | null): Promise<{
    questions: string;
    enough: boolean;
    count: number;
  }> => ipcRenderer.invoke("quiz:make", excludeId),

  evaluate: (answers: string): Promise<string> => ipcRenderer.invoke("quiz:evaluate", answers),

  minimize: (): void => ipcRenderer.send("win:minimize"),
  close: (): void => ipcRenderer.send("win:close"),
  openExternal: (url: string): void => ipcRenderer.send("open:external", url),
};

contextBridge.exposeInMainWorld("api", api);

export type StudyApi = typeof api;
