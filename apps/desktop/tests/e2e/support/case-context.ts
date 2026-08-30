import type { Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function createLiveCase(page: Page, title: string) {
  const parent = await mkdtemp(path.join(tmpdir(), 'recovery-context-e2e-'));
  const workspace = path.join(parent, 'case');
  const recoveryCase = await page.evaluate(async ({ caseTitle, workspacePath }) => window.recoveryApi.createCase({
    title: caseTitle, operator: 'e2e-operator', referenceNumber: null, organization: null, workspacePath, notes: null,
  }), { caseTitle: title, workspacePath: workspace });
  await page.evaluate(({ caseId, workspacePath }) => {
    sessionStorage.setItem(`recovery:${caseId}:workspacePath`, workspacePath);
    window.location.hash = `#/cases/${caseId}/overview`;
  }, { caseId: recoveryCase.caseId, workspacePath: recoveryCase.workspacePath });
  await page.locator('.case-header__case', { hasText: title }).waitFor();
  return { caseId: recoveryCase.caseId, workspacePath: recoveryCase.workspacePath, cleanup: () => rm(parent, { recursive: true, force: true }) };
}
