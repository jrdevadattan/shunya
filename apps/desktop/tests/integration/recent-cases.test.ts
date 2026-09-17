// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { RecoveryCase } from '@recovery/contracts';
import {
  MAX_RECENT_CASES,
  RECENT_CASES_STORAGE_KEY,
  loadRecentCases,
  rememberRecentCase,
} from '../../src/renderer/features/cases/recent-cases.js';

const createdAt = '2026-08-29T12:00:00Z';

function recoveryCase(caseId: string, overrides: Partial<RecoveryCase> = {}): RecoveryCase {
  return {
    caseId,
    title: `Recovery ${caseId}`,
    operator: 'examiner-7',
    referenceNumber: 'REF-SECRET',
    organization: 'Digital Lab',
    workspacePath: `D:/cases/${caseId}`,
    notes: 'Sensitive operator notes',
    createdAt,
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe('recent recovery case registry', () => {
  it('persists only the bounded truthful fields needed to reopen a case', () => {
    rememberRecentCase(recoveryCase('case-1'));

    expect(JSON.parse(localStorage.getItem(RECENT_CASES_STORAGE_KEY)!)).toEqual([{
      caseId: 'case-1',
      title: 'Recovery case-1',
      operator: 'examiner-7',
      workspacePath: 'D:/cases/case-1',
      createdAt,
    }]);
  });

  it('deduplicates reopened cases and caps the registry', () => {
    for (let index = 0; index < MAX_RECENT_CASES + 3; index += 1) {
      rememberRecentCase(recoveryCase(`case-${index}`));
    }
    rememberRecentCase(recoveryCase('case-5', { title: 'Updated title' }));

    const recentCases = loadRecentCases();
    expect(recentCases).toHaveLength(MAX_RECENT_CASES);
    expect(recentCases[0]).toMatchObject({ caseId: 'case-5', title: 'Updated title' });
    expect(recentCases.filter(({ caseId }) => caseId === 'case-5')).toHaveLength(1);
  });

  it('recovers safely from corrupt or partially invalid storage', () => {
    localStorage.setItem(RECENT_CASES_STORAGE_KEY, '{bad json');
    expect(loadRecentCases()).toEqual([]);

    localStorage.setItem(RECENT_CASES_STORAGE_KEY, JSON.stringify([
      recoveryCase('case-valid'),
      { caseId: 'case-missing-fields' },
      'not a case',
    ]));
    expect(loadRecentCases()).toEqual([{
      caseId: 'case-valid',
      title: 'Recovery case-valid',
      operator: 'examiner-7',
      workspacePath: 'D:/cases/case-valid',
      createdAt,
    }]);
  });
});
