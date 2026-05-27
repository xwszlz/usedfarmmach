# PowerShell script to push code to GitHub
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  GitHub Push Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Step 1] Checking current configuration:" -ForegroundColor Yellow
git remote -v
Write-Host ""

Write-Host "[Step 2] Checking local commits to push:" -ForegroundColor Yellow
$commits = git log --oneline origin/main..main | Measure-Object -Line
Write-Host "Found $($commits.Lines) commits to push"
git log --oneline origin/main..main
Write-Host ""

Write-Host "[Step 3] Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "Note: If this fails due to PAT detection, see options below."
Write-Host ""
git push origin main
$pushStatus = $LASTEXITCODE

Write-Host ""
Write-Host "[Step 4] Result:" -ForegroundColor Yellow
if ($pushStatus -eq 0) {
    Write-Host "✅ SUCCESS! Code pushed to GitHub" -ForegroundColor Green
    Write-Host "Visit: https://github.com/xwszlz/usedfarmmach" -ForegroundColor Green
} else {
    Write-Host "❌ Push failed. Possible solutions:" -ForegroundColor Red
    Write-Host ""
    Write-Host "Option A: Create new GitHub token" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "  2. Click 'Generate new token (classic)'" -ForegroundColor Yellow
    Write-Host "  3. Select 'repo' scope, generate token" -ForegroundColor Yellow
    Write-Host "  4. Update remote URL: git remote set-url origin https://xwszlz:NEW_TOKEN@github.com/xwszlz/usedfarmmach.git" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option B: Create new repository (Easiest)" -ForegroundColor Yellow
    Write-Host "  1. Create new repo at: https://github.com/new" -ForegroundColor Yellow
    Write-Host "  2. Name: usedfarmmach-prod (or similar)" -ForegroundColor Yellow
    Write-Host "  3. Keep it EMPTY (no README, .gitignore, license)" -ForegroundColor Yellow
    Write-Host "  4. Send me the HTTPS URL, I'll create migration script" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
pause