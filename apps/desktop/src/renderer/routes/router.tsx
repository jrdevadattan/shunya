import { createHashRouter, Navigate } from 'react-router-dom';
import { CaseLayout } from './CaseLayout.js';
import { NewCasePage } from './NewCasePage.js';
import { WelcomePage } from './WelcomePage.js';
import { JobProgressPage } from '../features/jobs/JobProgressPage.js';
import { AddSourcePage } from '../features/sources/AddSourcePage.js';
import { SourceAssessmentPage } from '../features/sources/SourceAssessmentPage.js';
import { DestinationPage } from '../features/recovery/DestinationPage.js';
import { GoalPage } from '../features/recovery/GoalPage.js';
import { ScanOptionsPage } from '../features/recovery/ScanOptionsPage.js';
import { PartitionList } from '../features/sources/PartitionList.js';
import { ResultsPage } from '../features/results/ResultsPage.js';
import { ExportWizard } from '../features/export/ExportWizard.js';
import { ReportsPage } from '../features/reports/ReportsPage.js';
import { AcquisitionOptions } from '../features/recovery/AcquisitionOptions.js';
import { DamagedDeviceWizard } from '../features/recovery/DamagedDeviceWizard.js';
import { MemorySourcePage } from '../features/memory/MemorySourcePage.js';
import { MemoryOptionsPage } from '../features/memory/MemoryOptionsPage.js';
import { MemoryResultsPage } from '../features/memory/MemoryResultsPage.js';
import { CaseOverviewPage } from './CaseOverviewPage.js';

export const router = createHashRouter([
  { path: '/', element: <WelcomePage /> },
  { path: '/cases/new', element: <NewCasePage /> },
  { path: '/cases/open', element: <NewCasePage /> },
  {
    path: '/cases/:caseId',
    element: <CaseLayout />,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <CaseOverviewPage /> },
      { path: 'sources', element: <AddSourcePage /> },
      { path: 'sources/:sourceId/assessment', element: <SourceAssessmentPage /> },
      { path: 'recovery/destination', element: <DestinationPage /> },
      { path: 'recovery/acquisition', element: <AcquisitionOptions /> },
      { path: 'recovery/damaged', element: <DamagedDeviceWizard /> },
      { path: 'recovery/goal', element: <GoalPage /> },
      { path: 'recovery/scan-options', element: <ScanOptionsPage /> },
      { path: 'recovery/partitions', element: <PartitionList /> },
      { path: 'jobs', element: <JobProgressPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'memory', element: <MemorySourcePage /> },
      { path: 'memory/options', element: <MemoryOptionsPage /> },
      { path: 'memory/results', element: <MemoryResultsPage /> },
      { path: 'exports', element: <ExportWizard /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'activity', element: <RoutePlaceholder title="Case activity" description="Review the append-only audit trail." /> },
    ],
  },
]);

function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  return <section><h1>{title}</h1><p>{description}</p></section>;
}
