import type { JobStage } from '@recovery/contracts';

export interface JobProgressSnapshot {
  jobId: string;
  stage: JobStage;
  filesFound: number;
  bytesProcessed: string;
  throughputBytesPerSecond?: string;
  etaRange?: string;
  errors?: number;
  lastSequence?: number;
  pausedRecoverable?: boolean;
}

export interface JobProgressEvent {
  jobId: string;
  sequence: number;
  stage: JobStage;
  message?: string;
}

export class JobEventStore {
  private snapshot?: JobProgressSnapshot;
  private readonly listeners = new Set<() => void>();

  replay(snapshot: JobProgressSnapshot, events: JobProgressEvent[]): void {
    this.snapshot = { ...snapshot, lastSequence: snapshot.lastSequence ?? 0 };
    for (const event of events) this.apply(event, false);
    this.emit();
  }

  apply(event: JobProgressEvent, notify = true): void {
    if (!this.snapshot || event.jobId !== this.snapshot.jobId) return;
    if (event.sequence <= (this.snapshot.lastSequence ?? 0)) return;
    this.snapshot = { ...this.snapshot, stage: event.stage, lastSequence: event.sequence };
    if (notify) this.emit();
  }

  update(update: Partial<JobProgressSnapshot>): void {
    if (!this.snapshot) return;
    this.snapshot = { ...this.snapshot, ...update };
    this.emit();
  }

  getSnapshot = (): JobProgressSnapshot | undefined => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const activeJobStore = new JobEventStore();
