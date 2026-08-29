import { describe, expect, it } from 'vitest';
import fixture from './fixtures/source-descriptor.json' with { type: 'json' };
import { JobStageSchema, SourceDescriptorSchema } from '../src/domain.js';

describe('SourceDescriptor', () => {
  it('accepts the canonical fixture without numeric precision loss', () => {
    const parsed = SourceDescriptorSchema.parse(fixture);

    expect(parsed.sizeBytes).toBe('4000787030016');
  });

  it('rejects numeric byte counts at the JavaScript boundary', () => {
    expect(() =>
      SourceDescriptorSchema.parse({ ...fixture, sizeBytes: 4000787030016 }),
    ).toThrow();
  });
});

describe('JobStage', () => {
  it('rejects unknown states instead of accepting an untyped string', () => {
    expect(JobStageSchema.safeParse('silently_finished').success).toBe(false);
  });
});
