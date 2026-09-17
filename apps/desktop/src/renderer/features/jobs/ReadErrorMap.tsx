import { CircleHelp, DatabaseZap } from 'lucide-react';

interface ReadErrorMapProps {
  rescued?: number;
  unreadable?: number;
  pending?: number;
}

export function ReadErrorMap({ rescued, unreadable, pending }: ReadErrorMapProps) {
  const measured = rescued !== undefined && unreadable !== undefined && pending !== undefined;
  return <figure className="read-error-map" aria-label="Device read coverage">
    <figcaption><span><DatabaseZap aria-hidden="true" /><span><strong>Device read map</strong><small>{measured ? 'Daemon-reported acquisition coverage' : 'Acquisition coverage unavailable'}</small></span></span></figcaption>
    {measured ? <div role="img" aria-label={`${rescued}% rescued, ${unreadable}% unreadable, ${pending}% pending`} className="read-error-map__bar"><span className="is-rescued" style={{ width: `${rescued}%` }} /><span className="is-unreadable" style={{ width: `${unreadable}%` }} /><span className="is-pending" style={{ width: `${pending}%` }} /></div> : <div className="read-error-map__unavailable"><CircleHelp aria-hidden="true" /><span><strong>Range telemetry unavailable</strong><small>Not reported by the daemon. No sector coverage is simulated.</small></span></div>}
    <ul aria-label="Read-error legend">
      <li><i className="is-rescued" aria-hidden="true" /><span><strong>Rescued</strong><small>{measured ? `${rescued}%` : 'Not reported'}</small></span></li>
      <li><i className="is-unreadable" aria-hidden="true" /><span><strong>Unreadable</strong><small>{measured ? `${unreadable}%` : 'Not reported'}</small></span></li>
      <li><i className="is-pending" aria-hidden="true" /><span><strong>Pending</strong><small>{measured ? `${pending}%` : 'Not reported'}</small></span></li>
    </ul>
  </figure>;
}
