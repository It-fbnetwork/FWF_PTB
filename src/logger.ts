import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

const reset = "\x1b[0m";
const bold = "\x1b[1m";
const dim = "\x1b[2m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const magenta = "\x1b[35m";

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function line(color: string, label: string, message: string): string {
  return `${dim}[${stamp()}]${reset} ${color}${bold}${label}${reset} ${message}`;
}

async function persist(plain: string): Promise<void> {
  try {
    await mkdir(config.logsDir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    await appendFile(join(config.logsDir, `agent-${day}.log`), `${plain}\n`, "utf8");
  } catch {
    // Logging to disk must never crash the agent.
  }
}

function emit(color: string, label: string, message: string): void {
  console.log(line(color, label, message));
  void persist(`[${stamp()}] ${label} ${message}`);
}

export const log = {
  banner(title: string): void {
    console.log("");
    console.log(`${magenta}${bold}${title}${reset}`);
    console.log("");
  },
  info(message: string): void {
    emit(cyan, "INFO", message);
  },
  success(message: string): void {
    emit(green, "OK", message);
  },
  warn(message: string): void {
    emit(yellow, "WARN", message);
  },
  error(message: string): void {
    emit(red, "ERROR", message);
  },
  blank(): void {
    console.log("");
  },
};
