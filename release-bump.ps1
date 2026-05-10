# release-bump.ps1: Bump version, commit, and tag for Vectrune
# Usage:
#   .\release-bump.ps1 <new_version>
#   .\release-bump.ps1 -Major
#   .\release-bump.ps1 -Minor
#   .\release-bump.ps1 (no args: patch bump)
# Example: .\release-bump.ps1 0.1.5

param(
    [string]$Version = "",
    [switch]$Major = $false,
    [switch]$Minor = $false
)

$ErrorActionPreference = "Stop"

$CargoFile = "Cargo.toml"

# Extract current version from Cargo.toml
Write-Host "Reading current version from $CargoFile..." -ForegroundColor Cyan
$CargoContent = Get-Content $CargoFile -Raw
$VersionMatch = $CargoContent | Select-String 'version = "([0-9]+\.[0-9]+\.[0-9]+)"'
if (-not $VersionMatch) {
    Write-Host "Could not parse current version from $CargoFile" -ForegroundColor Red
    exit 1
}
$CurVersion = $VersionMatch.Matches[0].Groups[1].Value
Write-Host "Current version: $CurVersion" -ForegroundColor Green

# Validate version format
if ($CurVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
    Write-Host "Invalid current version format: $CurVersion" -ForegroundColor Red
    exit 1
}

# Determine mode and new version
$Mode = "patch"
$NewVersion = ""

if ($Version) {
    $NewVersion = $Version
} elseif ($Major) {
    $Mode = "major"
} elseif ($Minor) {
    $Mode = "minor"
} else {
    $Mode = "patch"
}

# Bump version if needed
if (-not $NewVersion) {
    $Parts = $CurVersion -split '\.'
    $Major = [int]$Parts[0]
    $Minor = [int]$Parts[1]
    $Patch = [int]$Parts[2]

    switch ($Mode) {
        "major" {
            $Major++
            $Minor = 0
            $Patch = 0
        }
        "minor" {
            $Minor++
            $Patch = 0
        }
        "patch" {
            $Patch++
        }
    }
    $NewVersion = "$Major.$Minor.$Patch"
}

Write-Host "New version: $NewVersion" -ForegroundColor Green

# Compare versions: ensure new > current
function Compare-Versions {
    param([string]$Ver1, [string]$Ver2)

    $Parts1 = $Ver1 -split '\.' | ForEach-Object { [int]$_ }
    $Parts2 = $Ver2 -split '\.' | ForEach-Object { [int]$_ }

    for ($i = 0; $i -lt 3; $i++) {
        if ($Parts1[$i] -lt $Parts2[$i]) { return -1 }
        if ($Parts1[$i] -gt $Parts2[$i]) { return 1 }
    }
    return 0
}

$Cmp = Compare-Versions $NewVersion $CurVersion
if ($Cmp -le 0) {
    Write-Host "Error: New version $NewVersion must be greater than current $CurVersion" -ForegroundColor Red
    exit 1
}

# Update version in Cargo.toml
Write-Host "Updating $CargoFile..." -ForegroundColor Cyan
$NewContent = $CargoContent -replace 'version = "[0-9.]+"', "version = ""$NewVersion"""
Set-Content $CargoFile $NewContent -Encoding UTF8

Write-Host "Version bumped from $CurVersion to $NewVersion in $CargoFile." -ForegroundColor Green

# Git operations
Write-Host "Staging changes..." -ForegroundColor Cyan
git add $CargoFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to stage Cargo.toml" -ForegroundColor Red
    exit 1
}

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m "chore: bump version to $NewVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to commit" -ForegroundColor Red
    exit 1
}

Write-Host "Tagging..." -ForegroundColor Cyan
git tag "v$NewVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create tag" -ForegroundColor Red
    exit 1
}

Write-Host "Success! Committed and tagged v$NewVersion" -ForegroundColor Green
Write-Host "Push with: git push && git push --tags" -ForegroundColor Cyan

