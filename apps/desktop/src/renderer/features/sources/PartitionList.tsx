export function PartitionList() {
  const partitions = [
    { name: 'EFI system partition', filesystem: 'FAT32', start: '1,048,576', length: '260 MiB' },
    { name: 'Primary data partition', filesystem: 'NTFS', start: '273,678,336', length: '476 GiB' },
  ];
  return <section><header><p className="eyebrow">Read-only discovery</p><h1>Partitions found</h1><p>Partition candidates are stored in the case. No partition table is written to the source.</p></header><table><thead><tr><th>Name</th><th>Filesystem</th><th>Start offset (bytes)</th><th>Length</th></tr></thead><tbody>{partitions.map((partition) => <tr key={partition.name}><td>{partition.name}</td><td>{partition.filesystem}</td><td>{partition.start}</td><td>{partition.length}</td></tr>)}</tbody></table></section>;
}
