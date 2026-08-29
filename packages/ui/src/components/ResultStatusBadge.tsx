const labels = { complete: 'Complete', partial: 'Partial', corrupt: 'Corrupt', unverified: 'Unverified' } as const;
export function ResultStatusBadge({ status }: { status: keyof typeof labels }) {
  return <span className={`result-badge result-badge--${status}`}>{labels[status]}</span>;
}
