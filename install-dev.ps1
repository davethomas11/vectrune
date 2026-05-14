# Installs the built vectrune.exe to a user bin directory and adds it to PATH.
# Usage:
#   .\install-dev.ps1
#   .\install-dev.ps1 -RepoRoot C:\path\to\vectrune
#   .\install-dev.ps1 -BinDir C:\path\to\bin
#   .\install-dev.ps1 -AliasName v
#   .\install-dev.ps1 -NoPathUpdate

param(
    [string]$RepoRoot = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }),
    [string]$BinDir = (Join-Path $HOME '.local\bin'),
    [string]$AliasName = 'v',
    [switch]$NoPathUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-PathString {
    param(
        [Parameter(Mandatory)]
        [string]$PathValue
    )

    $expanded = [Environment]::ExpandEnvironmentVariables($PathValue.Trim().Trim('"'))

    try {
        return [System.IO.Path]::GetFullPath($expanded).TrimEnd('\\')
    }
    catch {
        return $expanded.TrimEnd('\\')
    }
}

function Get-CargoExecutable {
    $cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cargoCommand -and $cargoCommand.Source) {
        return $cargoCommand.Source
    }

    $fallbackCargo = Join-Path $HOME '.cargo\bin\cargo.exe'
    if (Test-Path -LiteralPath $fallbackCargo) {
        return $fallbackCargo
    }

    throw "Could not find 'cargo' on PATH or at '$fallbackCargo'. Install Rust first."
}

function Test-PathEntryPresent {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory)]
        [string]$PathValue,
        [Parameter(Mandatory)]
        [string]$Candidate
    )

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return $false
    }

    $normalizedCandidate = Normalize-PathString $Candidate

    foreach ($entry in ($PathValue -split ';')) {
        if (-not $entry.Trim()) {
            continue
        }

        $normalizedEntry = Normalize-PathString $entry
        if ([string]::Equals($normalizedEntry, $normalizedCandidate, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $false
}

function Add-DirectoryToUserPath {
    param(
        [Parameter(Mandatory)]
        [string]$Directory
    )

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathUpdated = $false

    if (-not (Test-PathEntryPresent -PathValue $userPath -Candidate $Directory)) {
        $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
            $Directory
        }
        else {
            "$userPath;$Directory"
        }

        [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
        $pathUpdated = $true
    }

    if (-not (Test-PathEntryPresent -PathValue $env:Path -Candidate $Directory)) {
        $env:Path = "$Directory;$env:Path"
    }

    return $pathUpdated
}

function Write-CommandShim {
    param(
        [Parameter(Mandatory)]
        [string]$ShimPath,
        [Parameter(Mandatory)]
        [string]$TargetFileName
    )

    $shimContent = '@echo off' + "`r`n" + '"' + "%~dp0$TargetFileName" + '" %*' + "`r`n"
    Set-Content -LiteralPath $ShimPath -Value $shimContent -Encoding Ascii
}

if ($AliasName -notmatch '^[A-Za-z0-9._-]+$') {
    throw "AliasName '$AliasName' contains unsupported characters. Use letters, numbers, dot, underscore, or dash."
}

$RepoRoot = Normalize-PathString $RepoRoot
$CargoToml = Join-Path $RepoRoot 'Cargo.toml'

if (-not (Test-Path -LiteralPath $CargoToml)) {
    throw "Could not find Cargo.toml at '$CargoToml'. Run this script from the vectrune repo or pass -RepoRoot."
}

$cargoExe = Get-CargoExecutable
$BinDir = Normalize-PathString $BinDir
$InstalledExe = Join-Path $BinDir 'vectrune.exe'
$AliasShim = Join-Path $BinDir ("{0}.cmd" -f $AliasName)
$BuiltExe = Join-Path $RepoRoot 'target\release\vectrune.exe'

Write-Host "Building vectrune from $RepoRoot" -ForegroundColor Cyan
& $cargoExe build --release --manifest-path $CargoToml

if (-not (Test-Path -LiteralPath $BuiltExe)) {
    throw "Build finished, but '$BuiltExe' was not found."
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Copy-Item -LiteralPath $BuiltExe -Destination $InstalledExe -Force
Write-CommandShim -ShimPath $AliasShim -TargetFileName 'vectrune.exe'

if ($NoPathUpdate) {
    if (-not (Test-PathEntryPresent -PathValue $env:Path -Candidate $BinDir)) {
        $env:Path = "$BinDir;$env:Path"
    }
    Write-Host "Skipped persistent PATH update (-NoPathUpdate)." -ForegroundColor Yellow
}
else {
    $pathUpdated = Add-DirectoryToUserPath -Directory $BinDir
    if ($pathUpdated) {
        Write-Host "Added to user PATH: $BinDir" -ForegroundColor Green
    }
    else {
        Write-Host "User PATH already contains: $BinDir" -ForegroundColor Green
    }
}

Write-Host "Installed binary: $InstalledExe" -ForegroundColor Green
Write-Host "Installed shortcut: $AliasShim" -ForegroundColor Green

Write-Host 'Verifying vectrune.exe...' -ForegroundColor Cyan
& $InstalledExe --version

Write-Host "Verifying $AliasName shortcut..." -ForegroundColor Cyan
& $AliasShim --version

Write-Host ''
Write-Host 'Try these commands in a new shell:' -ForegroundColor Cyan
Write-Host '  vectrune --version'
Write-Host ("  {0} --version" -f $AliasName)


