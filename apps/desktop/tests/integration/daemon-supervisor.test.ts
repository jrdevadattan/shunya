import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { DaemonSupervisor, type SpawnedDaemon } from '../../src/main/daemon-supervisor.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

class FixtureDaemon extends EventEmitter implements SpawnedDaemon {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill(): boolean {
    this.emit('exit', 1, null);
    return true;
  }
}

describe('DaemonSupervisor', () => {
  it('verifies the binary, restarts once, then surfaces DAEMON_UNAVAILABLE', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'recoveryd-test-'));
    temporaryDirectories.push(directory);
    const executablePath = path.join(directory, 'recoveryd-fixture');
    const bytes = Buffer.from('signed recovery daemon fixture');
    await writeFile(executablePath, bytes);
    const expectedSha256 = createHash('sha256').update(bytes).digest('hex');
    const children: FixtureDaemon[] = [];

    const supervisor = new DaemonSupervisor({
      executablePath,
      expectedSha256,
      spawnProcess: (_executable, _args, options) => {
        expect(options).toMatchObject({ shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
        const child = new FixtureDaemon();
        children.push(child);
        return child;
      },
    });

    await supervisor.start();
    children[0]?.kill();
    expect(children).toHaveLength(2);
    children[1]?.kill();

    expect(supervisor.status).toBe('unavailable');
    await expect(supervisor.request('runtime.get', {})).rejects.toMatchObject({ code: 'DAEMON_UNAVAILABLE' });
  });
});
