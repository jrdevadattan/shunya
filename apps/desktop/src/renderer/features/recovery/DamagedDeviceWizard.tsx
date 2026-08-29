import { useState } from 'react';
import { ReadErrorMap } from '../jobs/ReadErrorMap.js';

export function DamagedDeviceWizard() {
  const [started, setStarted] = useState(false);
  return <section className="workflow-page"><header><p className="eyebrow">Rescue Mode only</p><h1>Damaged device recovery</h1><p>Repeated reading can worsen a failing device. Rescue Mode will first copy the easiest-to-read areas and record unreadable regions so the job can resume.</p></header><fieldset className="case-form"><legend>Read strategy</legend><label><input defaultChecked name="strategy" type="radio" />First pass only <span>Recommended: healthy regions first with minimal retries.</span></label><label><input name="strategy" type="radio" />Additional limited retry pass</label><details><summary>Advanced details</summary><label>Expert retry passes<input defaultValue="1" min="0" max="3" type="number" /></label></details></fieldset>{started ? <><h2>Imaging in progress</h2><ReadErrorMap rescued={82} unreadable={3} pending={15} /><p role="status">Mapfile saved. This job can be safely resumed.</p></> : <button className="button button--primary" type="button" onClick={() => setStarted(true)}>Start first pass</button>}</section>;
}
