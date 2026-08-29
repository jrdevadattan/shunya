import type { RecoveryArtifact } from '@recovery/contracts';

export interface ResultPage { items: RecoveryArtifact[]; nextCursor: string | null; totalCount: number }

export class ResultStore {
  private page: ResultPage = { items: [], nextCursor: null, totalCount: 0 };
  ingestPage(page: ResultPage): void {
    if (page.items.length > 500) throw new Error('Result pages are limited to 500 artifacts.');
    this.page = page;
  }
  snapshot(): ResultPage { return this.page; }
}
