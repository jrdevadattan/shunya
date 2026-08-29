CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  operator TEXT NOT NULL,
  reference_number TEXT,
  organization TEXT,
  workspace_path TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  descriptor_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  source_id TEXT REFERENCES sources(source_id),
  stage TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_checkpoints (
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_units TEXT NOT NULL,
  continuation_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, stage)
);

CREATE TABLE IF NOT EXISTS partitions (
  partition_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(source_id),
  descriptor_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  descriptor_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_ranges (
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  sequence INTEGER NOT NULL,
  offset_bytes TEXT NOT NULL,
  length_bytes TEXT NOT NULL,
  PRIMARY KEY (artifact_id, sequence)
);

CREATE TABLE IF NOT EXISTS exports (
  export_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
