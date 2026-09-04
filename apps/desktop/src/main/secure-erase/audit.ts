import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export async function appendAudit(entry: Record<string, unknown>): Promise<string> {
  const directory = path.join(app.getPath('userData'), 'audit', 'secure-erase');
  await mkdir(directory, { recursive: true });
  const logPath = path.join(directory, `${new Date().toISOString().slice(0, 10)}.ndjson`);
  await appendFile(logPath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, { encoding: 'utf8', mode: 0o600 });
  return logPath;
}
