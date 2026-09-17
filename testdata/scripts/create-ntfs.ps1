[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputPath)
if (-not (Get-Command New-VHD -ErrorAction SilentlyContinue)) { throw 'Hyper-V New-VHD is required; run only in the Windows corpus VM' }
$absolute = [System.IO.Path]::GetFullPath($OutputPath)
New-VHD -Path $absolute -Dynamic -SizeBytes 128MB | Out-Null
Write-Host "Created deterministic-size NTFS VHD container at $absolute; filesystem IDs are normalized in the truth manifest."
