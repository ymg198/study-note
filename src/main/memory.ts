import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

const MEMORY_DIR = path.join(os.homedir(), "learning-journal");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

export interface MemoryEntry {
  id: string;
  date: string;
  summary: string;
  keyPoints: string[];
  details: string;
  focus: string[];
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
}

export async function readMemory(): Promise<MemoryEntry[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryEntry[]) : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writeMemory(entries: MemoryEntry[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(MEMORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function appendEntry(entry: MemoryEntry): Promise<MemoryEntry[]> {
  const entries = await readMemory();
  entries.push(entry);
  await writeMemory(entries);
  return entries;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 真正随机抽取 n 条不同条目；可排除指定 id（如刚保存的本次条目），起到复习旧知识的作用。
export function pickRandom(
  entries: MemoryEntry[],
  n: number,
  excludeId?: string
): MemoryEntry[] {
  const pool = excludeId ? entries.filter((e) => e.id !== excludeId) : entries;
  if (pool.length === 0) return [];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(n, shuffled.length));
}
