import { FileFamilySchema, type FileFamily, type RecoveryArtifact } from '@recovery/contracts';
import { Archive, Database, FileQuestion, FileText, Film, Image, TerminalSquare, type LucideIcon } from 'lucide-react';

/** Presentation metadata for each carving family the daemon understands. */
export interface FileFamilyMeta {
  id: FileFamily;
  label: string;
  description: string;
  formats: string;
  Icon: LucideIcon;
  caution?: string;
}

export const FILE_FAMILIES: readonly FileFamilyMeta[] = [
  { id: 'images', label: 'Images', description: 'Photos, screenshots, and graphics.', formats: 'JPEG · PNG · GIF · BMP · WebP', Icon: Image },
  { id: 'documents', label: 'Documents', description: 'PDF, Office, and OpenDocument files.', formats: 'PDF · DOCX · XLSX · PPTX · DOC · XLS · PPT · ODT', Icon: FileText },
  { id: 'archives', label: 'Archives', description: 'Compressed containers.', formats: 'ZIP · 7z · RAR · GZIP', Icon: Archive },
  { id: 'audio_video', label: 'Audio & video', description: 'Recordings and media containers.', formats: 'MP4 · MOV · M4A · 3GP · MP3 · WAV · AVI', Icon: Film },
  { id: 'databases', label: 'Databases', description: 'Application data stores.', formats: 'SQLite', Icon: Database },
  { id: 'executables', label: 'Executables', description: 'Programs and packages.', formats: 'EXE · DLL · ELF · JAR · APK', Icon: TerminalSquare, caution: 'Never previewed. Quarantined and threat-scanned before export.' },
];

export const ALL_FILE_FAMILIES: readonly FileFamily[] = FILE_FAMILIES.map((family) => family.id);

export type FamilyBucket = FileFamily | 'other';

export const OTHER_BUCKET = { id: 'other' as const, label: 'Other', Icon: FileQuestion };

const MIME_FORMAT: Record<string, { label: string; family: FileFamily }> = {
  'image/jpeg': { label: 'JPEG', family: 'images' },
  'image/png': { label: 'PNG', family: 'images' },
  'image/gif': { label: 'GIF', family: 'images' },
  'image/bmp': { label: 'BMP', family: 'images' },
  'image/webp': { label: 'WebP', family: 'images' },
  'image/tiff': { label: 'TIFF', family: 'images' },
  'application/pdf': { label: 'PDF', family: 'documents' },
  'text/plain': { label: 'Text', family: 'documents' },
  'application/msword': { label: 'DOC', family: 'documents' },
  'application/vnd.ms-excel': { label: 'XLS', family: 'documents' },
  'application/vnd.ms-powerpoint': { label: 'PPT', family: 'documents' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOCX', family: 'documents' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'XLSX', family: 'documents' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PPTX', family: 'documents' },
  'application/vnd.oasis.opendocument.text': { label: 'ODT', family: 'documents' },
  'application/vnd.oasis.opendocument.spreadsheet': { label: 'ODS', family: 'documents' },
  'application/vnd.oasis.opendocument.presentation': { label: 'ODP', family: 'documents' },
  'application/x-ole-storage': { label: 'OLE2', family: 'documents' },
  'application/zip': { label: 'ZIP', family: 'archives' },
  'application/x-7z-compressed': { label: '7z', family: 'archives' },
  'application/vnd.rar': { label: 'RAR', family: 'archives' },
  'application/gzip': { label: 'GZIP', family: 'archives' },
  'application/x-bzip2': { label: 'BZIP2', family: 'archives' },
  'application/x-tar': { label: 'TAR', family: 'archives' },
  'video/mp4': { label: 'MP4', family: 'audio_video' },
  'video/quicktime': { label: 'MOV', family: 'audio_video' },
  'video/3gpp': { label: '3GP', family: 'audio_video' },
  'audio/mp4': { label: 'M4A', family: 'audio_video' },
  'audio/mpeg': { label: 'MP3', family: 'audio_video' },
  'audio/wav': { label: 'WAV', family: 'audio_video' },
  'video/x-msvideo': { label: 'AVI', family: 'audio_video' },
  'video/x-matroska': { label: 'MKV', family: 'audio_video' },
  'audio/ogg': { label: 'OGG', family: 'audio_video' },
  'audio/flac': { label: 'FLAC', family: 'audio_video' },
  'application/x-sqlite3': { label: 'SQLite', family: 'databases' },
  'application/vnd.microsoft.portable-executable': { label: 'EXE/DLL', family: 'executables' },
  'application/x-executable': { label: 'ELF', family: 'executables' },
  'application/java-archive': { label: 'JAR', family: 'executables' },
  'application/vnd.android.package-archive': { label: 'APK', family: 'executables' },
};

const EXTENSION_FAMILY: Record<string, FileFamily> = {
  jpg: 'images', jpeg: 'images', png: 'images', gif: 'images', bmp: 'images', webp: 'images', tif: 'images', tiff: 'images',
  pdf: 'documents', doc: 'documents', docx: 'documents', xls: 'documents', xlsx: 'documents', ppt: 'documents', pptx: 'documents', odt: 'documents', ods: 'documents', odp: 'documents', txt: 'documents', ole: 'documents',
  zip: 'archives', '7z': 'archives', rar: 'archives', gz: 'archives', bz2: 'archives', tar: 'archives',
  mp4: 'audio_video', mov: 'audio_video', m4a: 'audio_video', m4v: 'audio_video', '3gp': 'audio_video', mp3: 'audio_video', wav: 'audio_video', avi: 'audio_video', mkv: 'audio_video', ogg: 'audio_video', flac: 'audio_video',
  sqlite: 'databases', db: 'databases',
  exe: 'executables', dll: 'executables', elf: 'executables', jar: 'executables', apk: 'executables', msi: 'executables',
};

type Typed = Pick<RecoveryArtifact, 'mimeType' | 'extension'>;

/** Family bucket for an artifact: detected MIME type first, extension as a fallback. */
export function familyOf(artifact: Typed): FamilyBucket {
  if (artifact.mimeType && MIME_FORMAT[artifact.mimeType]) return MIME_FORMAT[artifact.mimeType]!.family;
  const extension = artifact.extension?.toLowerCase();
  if (extension && EXTENSION_FAMILY[extension]) return EXTENSION_FAMILY[extension]!;
  return 'other';
}

/** Short format label for the results table, e.g. "DOCX" or "MP4". */
export function formatLabel(artifact: Typed): string {
  if (artifact.mimeType && MIME_FORMAT[artifact.mimeType]) return MIME_FORMAT[artifact.mimeType]!.label;
  if (artifact.extension) return artifact.extension.toUpperCase();
  return artifact.mimeType ?? 'Unknown';
}

export function familyMeta(bucket: FamilyBucket): { label: string; Icon: LucideIcon } {
  if (bucket === 'other') return OTHER_BUCKET;
  return FILE_FAMILIES.find((family) => family.id === bucket) ?? OTHER_BUCKET;
}

export function familyLabel(bucket: FamilyBucket): string {
  return familyMeta(bucket).label;
}

const storageKey = (caseId: string) => `recovery:${caseId}:families`;

/** Families remembered for this case's next scan; every family when nothing was chosen yet. */
export function readStoredFamilies(caseId: string): FileFamily[] {
  try {
    const raw = sessionStorage.getItem(storageKey(caseId));
    if (!raw) return [...ALL_FILE_FAMILIES];
    const parsed = FileFamilySchema.array().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [...ALL_FILE_FAMILIES];
  } catch {
    return [...ALL_FILE_FAMILIES];
  }
}

export function storeFamilies(caseId: string, families: readonly FileFamily[]): void {
  try {
    sessionStorage.setItem(storageKey(caseId), JSON.stringify(families));
  } catch {
    // Session storage is a convenience only; the daemon receives the families explicitly.
  }
}

/** Number of concrete formats the built-in engine searches for a family selection. */
export function formatCount(families: readonly FileFamily[]): number {
  return FILE_FAMILIES.filter((family) => families.includes(family.id)).reduce((total, family) => total + family.formats.split('·').length, 0);
}
