export interface TimelineStage { id: string; label: string; status: 'pending' | 'running' | 'completed' | 'paused' | 'failed' }
export function StageTimeline({ stages, ariaLabel = 'Recovery progress' }: { stages: TimelineStage[]; ariaLabel?: string }) {
  return <ol className="stage-timeline" aria-label={ariaLabel}>{stages.map((stage) => <li key={stage.id} data-status={stage.status}><span aria-hidden="true" className="stage-timeline__marker" /><span>{stage.label}</span><span className="sr-only"> — {stage.status}</span></li>)}</ol>;
}
