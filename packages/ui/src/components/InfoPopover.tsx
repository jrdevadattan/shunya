import * as Popover from '@radix-ui/react-popover';
import { CircleHelp, X } from 'lucide-react';

export function InfoPopover({ title, children }: { title: string; children: string }) {
  return <Popover.Root><Popover.Trigger className="icon-button" aria-label={`Information: ${title}`}><CircleHelp aria-hidden="true" /></Popover.Trigger><Popover.Portal><Popover.Content className="info-popover" sideOffset={8}><div className="info-popover__header"><strong>{title}</strong><Popover.Close className="icon-button" aria-label="Close information"><X aria-hidden="true" /></Popover.Close></div><p>{children}</p><Popover.Arrow className="info-popover__arrow" /></Popover.Content></Popover.Portal></Popover.Root>;
}
