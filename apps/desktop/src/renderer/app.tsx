import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@recovery/ui';
import './styles/app.css';
import { router } from './routes/router.js';
import { BackgroundOperationsWidget } from './features/operations/BackgroundOperationsWidget.js';
import { initOperationsBridge } from './features/operations/operations-store.js';

// Subscribe once to the main-process progress streams so long-running work
// (wipe, capture) stays visible in the floating widget across route changes.
initOperationsBridge();

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element is missing');
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
    <BackgroundOperationsWidget />
  </StrictMode>,
);
