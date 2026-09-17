import { SourceDescriptorSchema, type SourceDescriptor } from '@recovery/contracts';

export async function addImageSource(path: string): Promise<SourceDescriptor> {
  if (!path.trim()) throw new Error('Choose a disk image file.');
  const result = await window.recoveryApi.addImageSource({ path: path.trim() });
  const descriptor = typeof result === 'object' && result && 'descriptor' in result
    ? (result as { descriptor: unknown }).descriptor
    : result;
  return SourceDescriptorSchema.parse(descriptor);
}

export async function listPhysicalSources(): Promise<SourceDescriptor[]> {
  return SourceDescriptorSchema.array().parse(await window.recoveryApi.listSources());
}
