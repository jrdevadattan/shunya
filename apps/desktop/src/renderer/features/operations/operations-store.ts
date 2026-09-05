import { useSyncExternalStore } from 'react';

export type OperationKind = 'wipe' | 'capture' | 'recovery';
export type OperationStatus = 'running' | 'done' | 'error';

export interface OperationState {
  /** Stable id; by convention `${kind}:${device}` so progress events can find it. */
  id: string;
  kind: OperationKind;
  label: string;
  /** Hash route to open when the operation is clicked in the widget. */
  route: string;
  device?: string;
  percent: number;
  statusText: string;
  status: OperationStatus;
  startedAt: number;
  updatedAt: number;
  error?: string;
  result?: unknown;
}

type Listener = () => void;

const operations = new Map<string, OperationState>();
const listeners = new Set<Listener>();
let snapshot: OperationState[] = [];

function emit(): void {
  snapshot = Array.from(operations.values()).sort((a, b) => a.startedAt - b.startedAt);
  for (const listener of listeners) listener();
}

export function subscribeOperations(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getOperationsSnapshot(): OperationState[] {
  return snapshot;
}

export function startOperation(meta: {
  id: string; kind: OperationKind; label: string; route: string; device?: string; statusText?: string;
}): void {
  const now = Date.now();
  operations.set(meta.id, {
    id: meta.id, kind: meta.kind, label: meta.label, route: meta.route, device: meta.device,
    percent: 0, statusText: meta.statusText ?? 'Starting…', status: 'running', startedAt: now, updatedAt: now,
  });
  emit();
}

export function updateOperationProgress(id: string, percent: number | null | undefined, statusText?: string): void {
  const op = operations.get(id);
  if (!op || op.status !== 'running') return;
  if (typeof percent === 'number' && Number.isFinite(percent)) op.percent = Math.max(0, Math.min(100, percent));
  if (statusText) op.statusText = statusText;
  op.updatedAt = Date.now();
  emit();
}

export function completeOperation(
  id: string,
  status: 'done' | 'error',
  patch?: { statusText?: string; error?: string; result?: unknown },
): void {
  const op = operations.get(id);
  if (!op) return;
  op.status = status;
  if (status === 'done') op.percent = 100;
  if (patch?.statusText) op.statusText = patch.statusText;
  if (patch?.error) op.error = patch.error;
  if (patch && 'result' in patch) op.result = patch.result;
  op.updatedAt = Date.now();
  emit();
}

export function dismissOperation(id: string): void {
  if (operations.delete(id)) emit();
}

export function getOperation(id: string): OperationState | undefined {
  return operations.get(id);
}

/** Progress events only carry a device path; map them to the op id convention. */
export function updateByDevice(kind: OperationKind, device: string, percent: number | null | undefined, statusText?: string): void {
  updateOperationProgress(`${kind}:${device}`, percent, statusText);
}

/**
 * Register an operation and follow a promise to completion. The promise is owned
 * here (module scope), so an operation keeps updating the store and settles even
 * if the page that started it has been navigated away and unmounted.
 */
export async function trackOperation<T>(
  meta: { id: string; kind: OperationKind; label: string; route: string; device?: string },
  promise: Promise<T>,
): Promise<T> {
  startOperation(meta);
  try {
    const result = await promise;
    completeOperation(meta.id, 'done', { statusText: 'Completed', result });
    return result;
  } catch (cause) {
    completeOperation(meta.id, 'error', { statusText: 'Failed', error: cause instanceof Error ? cause.message : String(cause) });
    throw cause;
  }
}

let bridgeInitialised = false;

/** Subscribe once to the main-process progress streams so operations stay live
 * across route changes (the underlying work runs in the main process regardless
 * of which page is mounted). Safe to call multiple times. */
export function initOperationsBridge(): void {
  if (bridgeInitialised) return;
  if (typeof window === 'undefined' || !window.secureErase) return;
  bridgeInitialised = true;
  window.secureErase.onProgress((event) => {
    const e = event as { device?: string; percent?: number | null; statusText?: string };
    if (e?.device) updateByDevice('wipe', e.device, e.percent, e.statusText);
  });
  window.secureErase.onCaptureProgress((event) => {
    const e = event as { device?: string; percent?: number | null; statusText?: string };
    if (e?.device) updateByDevice('capture', e.device, e.percent, e.statusText);
  });
}

export function useOperations(): OperationState[] {
  return useSyncExternalStore(subscribeOperations, getOperationsSnapshot, getOperationsSnapshot);
}

/** The most recently started operation of a kind (running or finished). */
export function useOperationByKind(kind: OperationKind): OperationState | undefined {
  const ops = useOperations();
  for (let i = ops.length - 1; i >= 0; i -= 1) if (ops[i]!.kind === kind) return ops[i];
  return undefined;
}
