import { expect, test } from '@playwright/test';

test('rescue mode VM uses read-only source and separate destination', async () => {
  test.skip(!process.env.RECOVERY_RESCUE_VM_URL, 'QEMU rescue fixture is only available in the live ISO CI job');
  const response = await fetch(`${process.env.RECOVERY_RESCUE_VM_URL}/health`);
  const state = await response.json() as { runtimeMode: string; sourceMounted: boolean; destinationWritable: boolean };
  expect(state.runtimeMode).toBe('rescue');
  expect(state.sourceMounted).toBe(false);
  expect(state.destinationWritable).toBe(true);
});
