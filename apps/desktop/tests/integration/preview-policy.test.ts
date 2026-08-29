import { describe, expect, it } from 'vitest';
import { decidePreview } from '../../src/renderer/features/results/preview-policy.js';

describe('preview policy', () => {
  it('blocks active content and potential threats and sanitizes valid images', () => {
    expect(decidePreview({ mimeType: 'application/x-msdownload', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'blocked', reason: 'active_content' });
    expect(decidePreview({ mimeType: 'image/jpeg', validation: 'complete_validated', threat: 'potential_threat' })).toEqual({ kind: 'blocked', reason: 'potential_threat' });
    expect(decidePreview({ mimeType: 'image/jpeg', validation: 'complete_validated', threat: 'no_rule_match' }).kind).toBe('sanitized_image');
  });
});
