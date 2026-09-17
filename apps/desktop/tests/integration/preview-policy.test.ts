import { describe, expect, it } from 'vitest';
import { decidePreview } from '../../src/renderer/features/results/preview-policy.js';

describe('preview policy', () => {
  it('blocks active content and potential threats and sanitizes valid images', () => {
    expect(decidePreview({ mimeType: 'application/x-msdownload', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'blocked', reason: 'active_content' });
    expect(decidePreview({ mimeType: 'image/jpeg', validation: 'complete_validated', threat: 'potential_threat' })).toEqual({ kind: 'blocked', reason: 'potential_threat' });
    expect(decidePreview({ mimeType: 'image/jpeg', validation: 'complete_validated', threat: 'no_rule_match' }).kind).toBe('sanitized_image');
  });

  it('refuses active documents and incomplete threat checks even when a derivative is advertised', () => {
    expect(decidePreview({ mimeType: 'text/html', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'blocked', reason: 'active_content' });
    expect(decidePreview({ mimeType: 'image/png', validation: 'complete_validated', threat: 'not_scanned' })).toEqual({ kind: 'blocked', reason: 'scan_incomplete' });
    expect(decidePreview({ mimeType: 'application/pdf', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'pdf_pages' });
  });

  it('treats scriptable SVG and executable aliases as active content', () => {
    expect(decidePreview({ mimeType: 'image/svg+xml', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'blocked', reason: 'active_content' });
    expect(decidePreview({ mimeType: 'application/x-dosexec', validation: 'complete_validated', threat: 'no_rule_match' })).toEqual({ kind: 'blocked', reason: 'active_content' });
  });
});
