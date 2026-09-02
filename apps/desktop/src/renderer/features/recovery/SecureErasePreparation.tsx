import { useEffect, useState } from 'react';

/** Place this at the entry to the secure-erase workflow. It keeps destructive
 * controls unavailable until the downloaded tool has passed SHA-256 verification. */
export function SecureErasePreparation({ onReady }: { onReady: () => void }) {
  const [message, setMessage] = useState('Preparing secure-erase capability…');
  const [failure, setFailure] = useState<string>();

  async function prepare() {
    setFailure(undefined);
    try {
      await window.secureErase.prepareBinary();
      onReady();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'The nvme-cli download could not be prepared.');
    }
  }

  useEffect(() => {
    const unsubscribe = window.secureErase.onDownloadProgress(setMessage);
    void prepare();
    return unsubscribe;
  // The feature must only prepare once when this screen is entered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <section className="workflow-page" aria-live="polite">
    <h1>Preparing secure erase</h1>
    <p>{message}</p>
    {failure ? <><p role="alert" className="form-error">{failure}</p><button type="button" className="button button--primary" onClick={() => void prepare()}>Retry download</button></> : null}
  </section>;
}
