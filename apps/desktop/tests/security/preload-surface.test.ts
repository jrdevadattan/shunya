import { describe, expect, it } from 'vitest';
import { recoveryApiMethodNames } from '../../src/preload/recovery-api.js';

describe('preload API surface', () => {
  it('does not expose generic IPC, filesystem, or command methods', () => {
    expect(recoveryApiMethodNames).not.toContain('send');
    expect(recoveryApiMethodNames).not.toContain('readFile');
    expect(recoveryApiMethodNames).not.toContain('writeFile');
    expect(recoveryApiMethodNames).not.toContain('runCommand');
    expect(recoveryApiMethodNames).not.toContain('openPath');
  });
});
