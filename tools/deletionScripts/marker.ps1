param(
    [Parameter(Mandatory=$true)]
    [string]$TargetFolder
)

if (-not (Test-Path $TargetFolder)) {
    Write-Error "Target folder does not exist: $TargetFolder"
    exit 1
}

$MarkerPath = Join-Path -Path $TargetFolder -ChildPath "deletion_started.txt"

try {
    Set-Content -Path $MarkerPath -Value "deletion started" -Force
    Write-Output "Successfully created marker file at: $MarkerPath"
} catch {
    Write-Error "Failed to create marker file: $_"
    exit 1
}
