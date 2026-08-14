# Syncs the local eve-source-code fork from its GitHub origin.
# The GitHub Actions workflow (4x daily) keeps the fork aligned with vercel/eve.
# This script pulls those changes locally so symlinks in eve/.agents/skills/ stay fresh.
#
# Run from anywhere:  pwsh C:\Users\james\projects\eve\scripts\sync-fork.ps1

$fork = "C:\Users\james\projects\eve-source-code"

Write-Host "Syncing eve-source-code fork..." -ForegroundColor Cyan
Push-Location $fork

git fetch origin main
$behind = [int](git rev-list --count HEAD..origin/main 2>$null)

if ($behind -eq 0) {
    Write-Host "Already up to date." -ForegroundColor Green
} else {
    Write-Host "$behind new commit(s) from upstream." -ForegroundColor Yellow
    git reset --hard origin/main
    Write-Host "Updated to $(git log --oneline -1)." -ForegroundColor Green
}

Pop-Location
Write-Host "Done." -ForegroundColor Cyan
