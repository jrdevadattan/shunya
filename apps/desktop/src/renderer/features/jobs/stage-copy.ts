export const recoveryStageCopy = {
  metadata_scan: 'Looking for deleted file records.',
  metadata_extract: 'Recovering file content.',
  carving: 'Searching remaining disk space by file content.',
  validating: 'Checking recovered files for completeness.',
} as const;
