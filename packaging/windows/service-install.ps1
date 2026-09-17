#Requires -RunAsAdministrator
[CmdletBinding()]
param([Parameter(Mandatory)][string]$PackageRoot)
$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$helper = Join-Path $resolvedRoot 'resources\recovery-privileged-helper.exe'
if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) { throw "Privileged helper is missing: $helper" }
$signature = Get-AuthenticodeSignature -LiteralPath $helper
if ($env:RECOVERY_REQUIRE_SIGNING -eq '1' -and $signature.Status -ne 'Valid') { throw "Privileged helper signature is not valid" }
$destination = Join-Path $env:ProgramFiles 'SIH Recovery Platform\helper'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath $helper -Destination (Join-Path $destination 'recovery-privileged-helper.exe') -Force
$acl = Get-Acl -LiteralPath $destination
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new('SYSTEM','FullControl','ContainerInherit,ObjectInherit','None','Allow'))
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new('BUILTIN\Administrators','FullControl','ContainerInherit,ObjectInherit','None','Allow'))
Set-Acl -LiteralPath $destination -AclObject $acl
Write-Host 'Installed the demand-launched, read-only privileged helper with administrator-only ACLs.'
