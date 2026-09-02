param([Parameter(Mandatory = $true)][string]$JobPath)

# UAC relay for the bundled nvme.exe. The TypeScript caller writes an argument
# vector as JSON; neither this script nor its elevated child uses cmd.exe.
$job = Get-Content -LiteralPath $JobPath -Raw | ConvertFrom-Json
$runner = Join-Path (Split-Path -Parent $JobPath) 'run-nvme.ps1'
@'
param([Parameter(Mandatory = $true)][string]$JobPath)
$job = Get-Content -LiteralPath $JobPath -Raw | ConvertFrom-Json
$stdout = [System.IO.Path]::GetTempFileName()
$stderr = [System.IO.Path]::GetTempFileName()
try {
  $process = Start-Process -FilePath $job.binary -ArgumentList @($job.args) -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  @{ exitCode = $process.ExitCode; stdout = [IO.File]::ReadAllText($stdout); stderr = [IO.File]::ReadAllText($stderr) } | ConvertTo-Json -Compress | Set-Content -LiteralPath $job.resultPath -NoNewline
} finally {
  Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue
}
'@ | Set-Content -LiteralPath $runner -Encoding UTF8 -NoNewline

try {
  $child = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $runner, '-JobPath', $JobPath)
  exit $child.ExitCode
} finally {
  Remove-Item -LiteralPath $runner -Force -ErrorAction SilentlyContinue
}
