import { describe, expect, it } from 'vitest';
import fixture from './fixtures/source-descriptor.json' with { type: 'json' };
import { ArtifactPageSchema, WorkspaceFolderResultSchema, WorkspaceSelectionSchema } from '../src/desktop.js';
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

describe('ArtifactPage', () => {
  it('requires and preserves the daemon-computed filtered total', () => {
    expect(ArtifactPageSchema.parse({ items: [], nextCursor: null, totalCount: 501 }).totalCount).toBe(501);
    expect(ArtifactPageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(false);
  });
});

describe('WorkspaceFolderResult', () => {
  it('preserves native storage byte counts as decimal strings', () => {
    const parsed = WorkspaceSelectionSchema.parse({
      selectedPath: 'D:\\Recovery Workspaces',
      rootPath: 'D:\\',
      rootLabel: 'D:',
      totalBytes: '18446744073709551615',
      freeBytes: '9223372036854775808',
      directories: [],
      truncated: false,
    });

    expect(parsed.totalBytes).toBe('18446744073709551615');
    expect(parsed.freeBytes).toBe('9223372036854775808');
    expect(WorkspaceFolderResultSchema.safeParse({ ...parsed, freeBytes: 9223372036854775808 }).success).toBe(false);
  });

  it('accepts only a directory tree rooted at the selected dialog path', () => {
    const parsed = WorkspaceSelectionSchema.parse({
      selectedPath: '/evidence/cases',
      rootPath: '/',
      rootLabel: '/',
      totalBytes: '1000',
      freeBytes: '600',
      directories: [{
        name: 'Prior cases',
        relativePath: 'Prior cases',
        children: [{ name: 'Case 004', relativePath: 'Prior cases/Case 004', children: [], childrenOmitted: false }],
        childrenOmitted: false,
      }],
      truncated: false,
    });

    expect(parsed.directories[0]?.children[0]?.relativePath).toBe('Prior cases/Case 004');
    expect(WorkspaceFolderResultSchema.safeParse({
      ...parsed,
      directories: [{ name: 'manifest.json', relativePath: 'manifest.json', kind: 'file', children: [], childrenOmitted: false }],
    }).success).toBe(false);
  });
});
