import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main><h1>Recovery Platform</h1><p>Recover data safely and preserve the source.</p></main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element is missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
