import assert from 'node:assert/strict';
import test from 'node:test';
import forgeConfig from '../../apps/desktop/forge.config.js';

test('Debian maker targets the packaged recovery-platform executable', () => {
  const maker = forgeConfig.makers?.find((candidate) => candidate.name === 'deb') as
    | { configOrConfigFetcher?: { options?: { bin?: string } } }
    | undefined;

  assert.equal(maker?.configOrConfigFetcher?.options?.bin, 'recovery-platform');
});
