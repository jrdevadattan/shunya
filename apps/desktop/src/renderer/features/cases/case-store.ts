import { RecoveryCaseSchema, type RecoveryCase } from '@recovery/contracts';

export interface CreateCaseInput {
  title: string;
  operator: string;
  referenceNumber: string | null;
  organization: string | null;
  workspacePath: string;
  notes: string | null;
  estimatedRequiredBytes?: number;
}

export async function createCase(input: CreateCaseInput): Promise<RecoveryCase> {
  const title = input.title.trim();
  const operator = input.operator.trim();
  const workspacePath = input.workspacePath.trim();
  if (title.length < 3 || title.length > 120) throw new Error('Enter a case title between 3 and 120 characters.');
  if (!operator) throw new Error('Enter the operator name or ID.');
  if (!workspacePath) throw new Error('Choose a case workspace destination.');
  return RecoveryCaseSchema.parse(await window.recoveryApi.createCase({ ...input, title, operator, workspacePath }));
}
