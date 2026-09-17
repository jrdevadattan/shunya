import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from 'electron';

export interface CommandResult { exitCode: number; stdout: string; stderr: string; }

function run(executable: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

/** Runs an argument-vector only. The Windows relay deliberately writes a result
 * file because UAC's ShellExecute elevation cannot retain the child stdio pipe. */
export async function runElevated(binary: string, args: string[]): Promise<CommandResult> {
  if (process.platform === 'linux') {
    try { return await run('pkexec', [binary, ...args]); }
    catch (cause: unknown) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
      return run('sudo', ['--', binary, ...args]);
    }
  }
  if (process.platform === 'win32') {
    const directory = await mkdtemp(path.join(tmpdir(), 'sih-nvme-'));
    const jobPath = path.join(directory, 'job.json');
    const resultPath = path.join(directory, 'result.json');
    try {
      await writeFile(jobPath, JSON.stringify({ binary, args, resultPath }), { encoding: 'utf8', mode: 0o600 });
      const scriptRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
      const relay = path.join(scriptRoot, 'resources', 'bin', 'win32', 'elevate-nvme.ps1');
      const relayResult = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', relay, '-JobPath', jobPath]);
      if (relayResult.exitCode !== 0) throw new Error(`WINDOWS_ELEVATION_CANCELLED_OR_FAILED: ${relayResult.stderr}`);
      return JSON.parse(await readFile(resultPath, 'utf8')) as CommandResult;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  throw new Error('NVME_PLATFORM_UNSUPPORTED');
}

export async function runUnprivileged(binary: string, args: string[]): Promise<CommandResult> {
  return run(binary, args);
}
