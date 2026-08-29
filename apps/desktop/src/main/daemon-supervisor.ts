import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { RpcFrameSchema, type RpcFrame, type RpcMethod } from '@recovery/contracts';

const MAX_FRAME_BYTES = 8 * 1024 * 1024;

export interface SpawnedDaemon {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

interface SpawnOptions {
  shell: false;
  stdio: ['pipe', 'pipe', 'pipe'];
  env: NodeJS.ProcessEnv;
}

interface SupervisorOptions {
  executablePath: string;
  expectedSha256: string;
  environment?: NodeJS.ProcessEnv;
  maxRestarts?: number;
  spawnProcess?: (executable: string, args: string[], options: SpawnOptions) => SpawnedDaemon;
}

export class DaemonError extends Error {
  constructor(public readonly code: 'DAEMON_UNAVAILABLE' | 'DAEMON_HASH_MISMATCH' | 'DAEMON_PROTOCOL_ERROR', message: string) {
    super(message);
    this.name = 'DaemonError';
  }
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

export class DaemonSupervisor {
  status: 'stopped' | 'running' | 'unavailable' = 'stopped';
  private child?: SpawnedDaemon;
  private restarts = 0;
  private outputBuffer = '';
  private readonly pending = new Map<string, PendingRequest>();
  private readonly spawnProcess: NonNullable<SupervisorOptions['spawnProcess']>;

  constructor(private readonly options: SupervisorOptions) {
    this.spawnProcess = options.spawnProcess ?? ((executable, args, spawnOptions) =>
      spawn(executable, args, spawnOptions) as SpawnedDaemon);
  }

  async start(): Promise<void> {
    const actualHash = createHash('sha256').update(await readFile(this.options.executablePath)).digest('hex');
    if (actualHash.toLowerCase() !== this.options.expectedSha256.toLowerCase()) {
      this.status = 'unavailable';
      throw new DaemonError('DAEMON_HASH_MISMATCH', 'Bundled recovery daemon failed integrity verification');
    }
    this.restarts = 0;
    this.launch();
  }

  stop(): void {
    const child = this.child;
    this.child = undefined;
    this.status = 'stopped';
    child?.kill();
    this.rejectPending(new DaemonError('DAEMON_UNAVAILABLE', 'Recovery daemon stopped'));
  }

  request(method: RpcMethod, params: Record<string, unknown>): Promise<unknown> {
    if (this.status !== 'running' || !this.child) {
      return Promise.reject(new DaemonError('DAEMON_UNAVAILABLE', 'Recovery daemon is unavailable'));
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child?.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  private launch(): void {
    const child = this.spawnProcess(this.options.executablePath, [], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.options.environment },
    });
    this.child = child;
    this.status = 'running';
    child.stdout.on('data', (chunk) => this.consumeOutput(chunk));
    child.once('exit', () => this.onExit(child));
  }

  private onExit(exitedChild: SpawnedDaemon): void {
    if (this.child !== exitedChild || this.status === 'stopped') return;
    this.rejectPending(new DaemonError('DAEMON_UNAVAILABLE', 'Recovery daemon crashed'));
    if (this.restarts < (this.options.maxRestarts ?? 1)) {
      this.restarts += 1;
      this.launch();
      return;
    }
    this.child = undefined;
    this.status = 'unavailable';
  }

  private consumeOutput(chunk: unknown): void {
    this.outputBuffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (Buffer.byteLength(this.outputBuffer, 'utf8') > MAX_FRAME_BYTES && !this.outputBuffer.includes('\n')) {
      this.failProtocol('Daemon frame exceeded the 8 MiB limit');
      return;
    }
    for (;;) {
      const newline = this.outputBuffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.outputBuffer.slice(0, newline);
      this.outputBuffer = this.outputBuffer.slice(newline + 1);
      if (!line) continue;
      if (Buffer.byteLength(line, 'utf8') > MAX_FRAME_BYTES) {
        this.failProtocol('Daemon frame exceeded the 8 MiB limit');
        return;
      }
      try {
        this.settle(RpcFrameSchema.parse(JSON.parse(line)) as RpcFrame);
      } catch {
        this.failProtocol('Daemon emitted an invalid RPC frame');
        return;
      }
    }
  }

  private failProtocol(message: string): void {
    const child = this.child;
    this.child = undefined;
    this.status = 'unavailable';
    this.outputBuffer = '';
    this.rejectPending(new DaemonError('DAEMON_PROTOCOL_ERROR', message));
    child?.kill();
  }

  private settle(frame: RpcFrame): void {
    if (frame.kind === 'event') return;
    const pending = this.pending.get(frame.id);
    if (!pending) return;
    this.pending.delete(frame.id);
    if (frame.kind === 'response') pending.resolve(frame.result);
    else pending.reject(new Error(`${frame.error.code}: ${frame.error.message}`));
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
}
