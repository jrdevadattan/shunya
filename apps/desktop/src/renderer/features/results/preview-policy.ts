export interface PreviewInput {
  mimeType: string | null;
  validation: 'complete_validated' | 'complete_unverified' | 'partial_validated' | 'partial_unverified' | 'corrupt';
  threat: 'no_rule_match' | 'potential_threat' | 'scan_error' | 'not_scanned';
}

export type PreviewDecision =
  | { kind: 'blocked'; reason: 'active_content' | 'potential_threat' | 'corrupt' | 'scan_incomplete' }
  | { kind: 'sanitized_image' | 'bounded_text' | 'pdf_pages' | 'metadata_only' };

const activeTypes = new Set(['application/x-msdownload', 'application/x-executable', 'application/javascript', 'text/html', 'application/x-sh']);

export function decidePreview(input: PreviewInput): PreviewDecision {
  if (input.threat === 'potential_threat') return { kind: 'blocked', reason: 'potential_threat' };
  if (input.threat === 'scan_error' || input.threat === 'not_scanned') return { kind: 'blocked', reason: 'scan_incomplete' };
  if (input.validation === 'corrupt') return { kind: 'blocked', reason: 'corrupt' };
  if (!input.mimeType || activeTypes.has(input.mimeType)) return { kind: 'blocked', reason: 'active_content' };
  if (input.mimeType.startsWith('image/')) return { kind: 'sanitized_image' };
  if (input.mimeType === 'text/plain') return { kind: 'bounded_text' };
  if (input.mimeType === 'application/pdf') return { kind: 'pdf_pages' };
  return { kind: 'metadata_only' };
}
