<#
.SYNOPSIS
    NVMe Secure Erase (Windows) — Crypto Erase with automatic Block Erase fallback.

.DESCRIPTION
    Implements NVMe Sanitize command flow per NVMe Base Spec + NIST SP 800-88 Rev.2
    "Purge" guidance:
        1. Query controller identify data (id-ctrl) for Sanitize Capabilities (SANICAP).
        2. If Crypto Erase (bit 0) is supported, issue Sanitize with SANACT=4 (Crypto Erase).
        3. Poll the Sanitize Log until completion.
        4. If Crypto Erase is unsupported OR fails/aborts, fall back to
           Sanitize SANACT=2 (Block Erase), if supported.
        5. If neither Sanitize action is supported, optionally fall back to
           Format NVM with a secure-erase setting (ses=1), as a last resort
           (weaker guarantee — flagged clearly in output/log).

    Requires:
      - nvme-cli for Windows (https://github.com/linux-nvme/nvme-cli), nvme.exe on PATH
        or pass -NvmeExe to point at it.
      - Administrator privileges (raw NVMe passthrough IOCTLs require elevation).
      - Target drive must NOT be the Windows boot/system volume.

.PARAMETER Device
    NVMe controller device path as recognized by nvme-cli on Windows,
    e.g. "\\.\nvme0" (get this from `nvme list`).

.PARAMETER NvmeExe
    Path to nvme.exe if not on PATH. Default: "nvme.exe".

.PARAMETER Namespace
    Namespace ID to target for Format fallback (default 1). Sanitize acts on
    the whole controller/drive, not per-namespace.

.PARAMETER PollIntervalSeconds
    How often to poll sanitize-log while an operation is in progress.

.PARAMETER TimeoutMinutes
    Max time to wait for a sanitize operation to finish before treating it as failed.

.PARAMETER AllowFormatFallback
    If set, and NEITHER crypto nor block sanitize is supported, attempt
    `nvme format --ses=1` as a last-resort purge. This is weaker evidence
    for forensic/compliance purposes and is off by default.

.PARAMETER LogPath
    File to write a timestamped audit log to (useful for your STQC/DPDP
    compliance reporting). Default: .\nvme-erase-log-<timestamp>.txt

.EXAMPLE
    .\Invoke-NvmeSecureErase.ps1 -Device "\\.\nvme1"

.EXAMPLE
    .\Invoke-NvmeSecureErase.ps1 -Device "\\.\nvme1" -AllowFormatFallback -Verbose

.NOTES
    THIS IS DESTRUCTIVE AND IRREVERSIBLE. Double-check the device path.
    Test on a scratch/spare drive before using in your pipeline.
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [string]$Device,

    [string]$NvmeExe = "nvme.exe",

    [int]$Namespace = 1,

    [int]$PollIntervalSeconds = 5,

    [int]$TimeoutMinutes = 240,

    [switch]$AllowFormatFallback,

    [string]$LogPath = ".\nvme-erase-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    Add-Content -Path $LogPath -Value $line
}

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw "This script must be run from an elevated (Administrator) PowerShell session, because NVMe passthrough IOCTLs require it."
    }
}

function Assert-NvmeCliAvailable {
    $cmd = Get-Command $NvmeExe -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Could not find '$NvmeExe' on PATH. Install nvme-cli for Windows and/or pass -NvmeExe <full path>."
    }
}

function Invoke-Nvme {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Write-Log "Running: $NvmeExe $($Arguments -join ' ')" "DEBUG"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $NvmeExe
    $psi.Arguments = ($Arguments -join ' ')
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute = $false

    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    [PSCustomObject]@{
        ExitCode = $proc.ExitCode
        StdOut   = $stdout
        StdErr   = $stderr
    }
}

function Get-IdCtrlJson {
    $result = Invoke-Nvme -Arguments @("id-ctrl", $Device, "-o", "json")
    if ($result.ExitCode -ne 0) {
        throw "nvme id-ctrl failed (exit $($result.ExitCode)): $($result.StdErr)"
    }
    try {
        return $result.StdOut | ConvertFrom-Json
    } catch {
        throw "Failed to parse id-ctrl JSON output: $_"
    }
}

# SANICAP bit layout (NVMe Base Spec, Identify Controller Data Structure):
#   bit 0: Crypto Erase Sanitize supported
#   bit 1: Block Erase Sanitize supported
#   bit 2: Overwrite Sanitize supported
function Get-SanitizeCapabilities {
    param($IdCtrl)

    # nvme-cli JSON key is typically "sanicap"; fall back gracefully if absent.
    $sanicap = $IdCtrl.sanicap
    if ($null -eq $sanicap) {
        Write-Log "SANICAP field not found in id-ctrl output; assuming no sanitize support." "WARN"
        return [PSCustomObject]@{ CryptoErase = $false; BlockErase = $false; Overwrite = $false }
    }

    [PSCustomObject]@{
        CryptoErase = [bool]($sanicap -band 0x1)
        BlockErase  = [bool]($sanicap -band 0x2)
        Overwrite   = [bool]($sanicap -band 0x4)
    }
}

# Sanitize Log Status (SSTAT) bits [2:0] — Sanitize Progress/Status:
#   0 = Never sanitized
#   1 = Completed successfully
#   2 = In progress
#   3 = Completed with errors / failed
#   4 = Completed successfully, deallocated blocks not verified as zero
function Get-SanitizeStatus {
    $result = Invoke-Nvme -Arguments @("sanitize-log", $Device, "-o", "json")
    if ($result.ExitCode -ne 0) {
        throw "nvme sanitize-log failed (exit $($result.ExitCode)): $($result.StdErr)"
    }
    try {
        $log = $result.StdOut | ConvertFrom-Json
    } catch {
        throw "Failed to parse sanitize-log JSON output: $_"
    }

    $sstat = $log.sstat
    $progress = $log.sprog
    $statusCode = $sstat -band 0x7

    [PSCustomObject]@{
        RawSstat   = $sstat
        StatusCode = $statusCode
        Progress   = $progress
        StatusText = switch ($statusCode) {
            0 { "Never sanitized" }
            1 { "Completed successfully" }
            2 { "In progress" }
            3 { "Completed with errors / failed" }
            4 { "Completed - deallocated blocks not verified" }
            default { "Unknown ($statusCode)" }
        }
    }
}

function Wait-ForSanitizeCompletion {
    param([string]$OperationName)

    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    while ($true) {
        Start-Sleep -Seconds $PollIntervalSeconds
        $status = Get-SanitizeStatus
        $pct = if ($status.Progress) { [math]::Round(($status.Progress / 65536) * 100, 1) } else { 0 }
        Write-Log "$OperationName status: $($status.StatusText) (progress ~$pct%)"

        switch ($status.StatusCode) {
            1 { return $true }   # success
            4 { return $true }   # success, unverified dealloc
            3 { return $false }  # failed
            2 {
                if ((Get-Date) -gt $deadline) {
                    Write-Log "$OperationName timed out after $TimeoutMinutes minutes." "ERROR"
                    return $false
                }
                continue
            }
            default {
                Write-Log "$OperationName returned unexpected status code $($status.StatusCode); treating as failure." "WARN"
                return $false
            }
        }
    }
}

function Invoke-SanitizeAction {
    param(
        [int]$SanAct,     # 2 = Block Erase, 4 = Crypto Erase
        [string]$Name
    )

    if (-not $PSCmdlet.ShouldProcess($Device, "NVMe Sanitize ($Name)")) {
        return $false
    }

    Write-Log "Issuing NVMe Sanitize command: $Name (sanact=$SanAct) on $Device"
    $result = Invoke-Nvme -Arguments @("sanitize", $Device, "--sanact=$SanAct")

    if ($result.ExitCode -ne 0) {
        Write-Log "$Name command rejected by controller (exit $($result.ExitCode)): $($result.StdErr)" "ERROR"
        return $false
    }

    return Wait-ForSanitizeCompletion -OperationName $Name
}

function Invoke-FormatFallback {
    if (-not $PSCmdlet.ShouldProcess($Device, "NVMe Format (ses=1, namespace $Namespace)")) {
        return $false
    }

    Write-Log "Falling back to Format NVM secure erase (ses=1) on namespace $Namespace. NOTE: this is a weaker guarantee than Sanitize and should be documented as such in compliance output." "WARN"

    $result = Invoke-Nvme -Arguments @("format", $Device, "-n", "$Namespace", "--ses=1")
    if ($result.ExitCode -ne 0) {
        Write-Log "Format fallback failed (exit $($result.ExitCode)): $($result.StdErr)" "ERROR"
        return $false
    }

    Write-Log "Format command completed. Note: Format completion does not carry the same progress/status telemetry as Sanitize; verify via `nvme id-ctrl`/vendor tooling if needed." "INFO"
    return $true
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

try {
    Assert-Admin
    Assert-NvmeCliAvailable

    Write-Log "=== NVMe Secure Erase started for device: $Device ==="
    Write-Log "Log file: $LogPath"

    Write-Host ""
    Write-Host "!!! WARNING !!!" -ForegroundColor Red
    Write-Host "This will PERMANENTLY DESTROY ALL DATA on device '$Device'." -ForegroundColor Red
    Write-Host "This action cannot be undone." -ForegroundColor Red
    $confirm = Read-Host "Type the exact device path ('$Device') to confirm"
    if ($confirm -ne $Device) {
        Write-Log "Confirmation string did not match. Aborting without touching the device." "ERROR"
        exit 1
    }

    $idCtrl = Get-IdCtrlJson
    $caps = Get-SanitizeCapabilities -IdCtrl $idCtrl
    Write-Log "Sanitize capabilities -> CryptoErase: $($caps.CryptoErase), BlockErase: $($caps.BlockErase), Overwrite: $($caps.Overwrite)"

    $erased = $false
    $methodUsed = $null

    if ($caps.CryptoErase) {
        $erased = Invoke-SanitizeAction -SanAct 4 -Name "Crypto Erase"
        if ($erased) { $methodUsed = "Sanitize: Crypto Erase (NVMe SANACT=4)" }
        else { Write-Log "Crypto Erase did not complete successfully. Falling back to Block Erase." "WARN" }
    } else {
        Write-Log "Controller does not advertise Crypto Erase support. Skipping to Block Erase." "WARN"
    }

    if (-not $erased) {
        if ($caps.BlockErase) {
            $erased = Invoke-SanitizeAction -SanAct 2 -Name "Block Erase"
            if ($erased) { $methodUsed = "Sanitize: Block Erase (NVMe SANACT=2)" }
        } else {
            Write-Log "Controller does not advertise Block Erase support either." "WARN"
        }
    }

    if (-not $erased -and $AllowFormatFallback) {
        $erased = Invoke-FormatFallback
        if ($erased) { $methodUsed = "Format NVM (ses=1) [fallback, weaker guarantee]" }
    }

    Write-Host ""
    if ($erased) {
        Write-Log "=== ERASE SUCCEEDED === Method used: $methodUsed" "SUCCESS"
        Write-Host "Erase completed successfully via: $methodUsed" -ForegroundColor Green
        exit 0
    } else {
        Write-Log "=== ERASE FAILED === No supported/successful sanitize method completed. Consider -AllowFormatFallback (weaker) or check drive/controller support." "ERROR"
        Write-Host "Erase FAILED. See log: $LogPath" -ForegroundColor Red
        exit 2
    }
}
catch {
    Write-Log "Fatal error: $($_.Exception.Message)" "ERROR"
    Write-Host "Fatal error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}