import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [output, setOutput] = useState('');

  const runScript = async (scriptName: string) => {
    try {
      // @ts-ignore
      const result = await window.deletionApi.runScript(scriptName);
      setOutput(`Success:\n${result}`);
    } catch (err: any) {
      setOutput(`Error:\n${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1>Deletion Scripts</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => runScript('clean_temp.bat')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Clean Temp Files
        </button>
        <button onClick={() => runScript('secure_erase.bat')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Secure Erase Logs
        </button>
      </div>
      <pre style={{ background: '#eee', padding: '10px', borderRadius: '4px', minHeight: '100px', whiteSpace: 'pre-wrap' }}>
        {output}
      </pre>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
