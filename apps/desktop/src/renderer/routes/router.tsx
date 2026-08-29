import { createHashRouter, Navigate } from 'react-router-dom';
import { CaseLayout } from './CaseLayout.js';
import { NewCasePage } from './NewCasePage.js';
import { WelcomePage } from './WelcomePage.js';

export const router = createHashRouter([
  { path: '/', element: <WelcomePage /> },
  { path: '/cases/new', element: <NewCasePage /> },
  { path: '/cases/open', element: <NewCasePage /> },
  {
    path: '/cases/:caseId',
    element: <CaseLayout />,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <RoutePlaceholder title="Case overview" description="Add a source to begin recovery." /> },
      { path: 'sources', element: <RoutePlaceholder title="Sources" description="Add and assess devices or forensic images." /> },
      { path: 'jobs', element: <RoutePlaceholder title="Recovery jobs" description="Configure and monitor recovery operations." /> },
      { path: 'results', element: <RoutePlaceholder title="Recovered files" description="Search, preview, verify, and select recovered files." /> },
      { path: 'memory', element: <RoutePlaceholder title="Memory analysis" description="Analyze supported volatile-memory images." /> },
      { path: 'exports', element: <RoutePlaceholder title="Exports" description="Copy verified results to a safe destination." /> },
      { path: 'reports', element: <RoutePlaceholder title="Reports" description="Generate case and recovery reports." /> },
      { path: 'activity', element: <RoutePlaceholder title="Case activity" description="Review the append-only audit trail." /> },
    ],
  },
]);

function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  return <section><h1>{title}</h1><p>{description}</p></section>;
}
