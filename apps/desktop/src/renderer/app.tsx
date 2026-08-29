import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@recovery/ui';
import './styles/app.css';
import { router } from './routes/router.js';

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element is missing');
createRoot(root).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
