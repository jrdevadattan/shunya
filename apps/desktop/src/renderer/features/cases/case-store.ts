import { RecoveryCaseSchema, type CreateCaseInput, type RecoveryCase } from '@recovery/contracts';
import { rememberValidatedCase } from '../../application-state.js';
import { rememberRecentCase } from './recent-cases.js';

export async function createCase(input: CreateCaseInput): Promise<RecoveryCase> {
  const title = input.title.trim();
  const operator = input.operator.trim();
  const workspacePath = input.workspacePath.trim();
  if (title.length < 3 || title.length > 120) throw new Error('Enter a case title between 3 and 120 characters.');
  if (!operator) throw new Error('Enter the operator name or ID.');
  if (!workspacePath) throw new Error('Choose a case workspace destination.');
  const recoveryCase = RecoveryCaseSchema.parse(await window.recoveryApi.createCase({ ...input, title, operator, workspacePath }));
  rememberValidatedCase(recoveryCase);
  rememberRecentCase(recoveryCase);
  return recoveryCase;
}
