<#
  One-time setup for wp-headless-kit + daily GitHub automation.
  Run from the Documents\\wp-headless-kit folder (it builds the repo in %USERPROFILE%\\source\\wp-headless-kit):
      powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
  Safe to re-run: every step checks what already exists.
#>
# 'Continue' so native tools writing to stderr don't abort Windows PowerShell 5.1; failures are caught by Check.
$ErrorActionPreference = 'Continue'
$Owner = 'numankhan4'
$Repo = 'wp-headless-kit'
$Full = "$Owner/$Repo"
$Src = Split-Path $PSScriptRoot -Parent
# Work in a separate folder: Windows/Claude protections block creating .github inside Documents.
$Root = Join-Path $env:USERPROFILE 'source\wp-headless-kit'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }
function Read-Secret($prompt) {
  $s = Read-Host $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# 0. Build the working copy (skipped if it is already a git repo from an earlier run)
if (-not (Test-Path (Join-Path $Root '.git'))) {
  if (Test-Path $Root) { Remove-Item $Root -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force $Root | Out-Null
  # /A-:R clears read-only flags; /XD skips build output and the staged github folder
  robocopy $Src $Root /E /A-:R /XD node_modules dist .git .github github profile /NFL /NDL /NJH /NJS /NP | Out-Null
  robocopy (Join-Path $Src 'scripts\github') (Join-Path $Root '.github') /E /A-:R /NFL /NDL /NJH /NJS /NP | Out-Null
  if (-not (Test-Path (Join-Path $Root '.github\workflows\daily-dev.yml'))) { throw "Could not create $Root\.github - check folder permissions." }
}
$global:LASTEXITCODE = 0
Set-Location $Root
Write-Host "Working folder: $Root" -ForegroundColor DarkGray

# 1. Prerequisites ---------------------------------------------------------
Step 'Checking git and GitHub CLI'
foreach ($tool in @(@{cmd = 'git'; id = 'Git.Git' }, @{cmd = 'gh'; id = 'GitHub.cli' })) {
  if (-not (Get-Command $tool.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing $($tool.cmd) with winget..."
    winget install --id $tool.id -e --source winget --accept-source-agreements --accept-package-agreements
    Write-Host "    Installed. Close this window, open a NEW PowerShell, and run the script again." -ForegroundColor Yellow
    exit 1
  }
}
Ok 'git and gh found'

# 2. GitHub login ------------------------------------------------------------
Step 'Signing in to GitHub (browser)'
$status = (gh auth status 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) {
  gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'; Check 'gh auth login'
}
elseif ($status -notmatch 'workflow') {
  gh auth refresh --hostname github.com --scopes 'workflow'; Check 'gh auth refresh'
}
$login = gh api user --jq .login; Check 'gh api user'
if ($login -ne $Owner) { throw "Signed in as '$login', expected '$Owner'. Run: gh auth logout; then re-run." }
$uid = gh api user --jq .id
$Email = "$uid+$Owner@users.noreply.github.com"
gh auth setup-git | Out-Null
Ok "Signed in as $login (commit email $Email)"

# 3. Local git repo ------------------------------------------------------------
Step 'Preparing local repository'
if (-not (Test-Path .git)) { git init -b main | Out-Null; Check 'git init' }
git config user.name 'Numan Ul Haq'
git config user.email $Email
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -q -m 'feat: initial wp-headless-kit scaffold' -m 'REST client, Yoast metadata, Gutenberg block parser/renderer, HTML utils, CI and daily automation workflows.' -m 'Co-authored-by: Claude <noreply@anthropic.com>'
  Check 'git commit'
}
Ok 'Committed'

# 4. GitHub repository -------------------------------------------------------
Step "Creating github.com/$Full"
gh repo view $Full *> $null
if ($LASTEXITCODE -ne 0) {
  gh repo create $Full --public --source . --remote origin --push `
    --description 'Typed, zero-dependency toolkit for headless WordPress front ends: REST client, SEO metadata, and Gutenberg block rendering.'
  Check 'gh repo create'
}
else {
  if (-not (git remote | Select-String -SimpleMatch 'origin')) { git remote add origin "https://github.com/$Full.git" }
  git push -u origin main; Check 'git push'
}
gh repo edit $Full --enable-auto-merge --delete-branch-on-merge --enable-squash-merge --enable-merge-commit=false `
  --homepage 'https://www.numanulhaq.com' --add-topic wordpress --add-topic headless-wordpress --add-topic nextjs `
  --add-topic gutenberg --add-topic typescript --add-topic seo
Check 'gh repo edit'
Ok 'Repository ready'

# 5. Labels ------------------------------------------------------------------------
Step 'Creating labels'
$labels = @(
  @('roadmap', '0E8A16', 'Planned work the daily workflow may pick up'),
  @('automated', '5319E7', 'PR opened by the daily workflow'),
  @('low-risk', 'C2E0C6', 'Docs/tests only - auto-merges after CI'),
  @('needs-review', 'FBCA04', 'Owner review required before merge'),
  @('needs-attention', 'D93F0B', 'Tests failing or needs a human'),
  @('in-progress', '1D76DB', 'Being worked on'),
  @('blocked', 'B60205', 'Skipped by automation until unblocked'),
  @('digest', 'BFD4F2', 'Weekly summary'),
  @('area:client', 'C5DEF5', ''), @('area:seo', 'C5DEF5', ''), @('area:blocks', 'C5DEF5', ''),
  @('area:nextjs', 'C5DEF5', ''), @('area:docs', 'C5DEF5', ''), @('area:tooling', 'C5DEF5', '')
)
foreach ($l in $labels) {
  $args2 = @('label', 'create', $l[0], '--repo', $Full, '--color', $l[1], '--force')
  if ($l[2]) { $args2 += @('--description', $l[2]) }
  gh @args2 | Out-Null
}
Ok "$($labels.Count) labels"

# 6. Roadmap issues ---------------------------------------------------------------
Step 'Creating roadmap issues'
$existing = @(gh issue list --repo $Full --state all --limit 500 --json title --jq '.[].title')
$items = Get-Content (Join-Path $Root '.github/roadmap.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$tmp = New-TemporaryFile
$created = 0
foreach ($it in $items) {
  if ($existing -contains $it.title) { continue }
  [IO.File]::WriteAllText($tmp.FullName, $it.body)
  gh issue create --repo $Full --title $it.title --body-file $tmp.FullName --label roadmap --label "area:$($it.area)" | Out-Null
  Check "create issue '$($it.title)'"
  $created++
}
Remove-Item $tmp
Ok "$created issues created ($($items.Count) in roadmap)"

# 7. Secrets and variables ------------------------------------------------------
Step 'Secrets'
Write-Host @"
    You need two secrets. They are sent straight to GitHub's encrypted store and never saved on disk.

    ANTHROPIC_API_KEY - from https://console.anthropic.com/settings/keys
      (set a monthly spend limit in the console; typical use is a few USD/month)

    BOT_PAT - a NEW fine-grained token at https://github.com/settings/personal-access-tokens/new
      Repository access: Only select repositories -> $Repo
      Permissions: Contents = Read and write, Pull requests = Read and write, Issues = Read and write
      Expiration: 1 year (the weekly digest will fail when it expires; that's your reminder)
"@ -ForegroundColor Gray
$existingSecrets = @(gh secret list --repo $Full --json name --jq '.[].name')
foreach ($name in @('ANTHROPIC_API_KEY', 'BOT_PAT')) {
  if ($existingSecrets -contains $name) {
    $ans = Read-Host "    $name already set. Replace it? (y/N)"
    if ($ans -ne 'y') { continue }
  }
  $val = Read-Secret "    Paste $name"
  if ([string]::IsNullOrWhiteSpace($val)) { throw "$name is empty" }
  gh secret set $name --repo $Full --body $val.Trim() | Out-Null; Check "secret $name"
  $val = $null
  Ok "$name saved"
}

gh variable set AUTOMATION_ENABLED --repo $Full --body 'true' | Out-Null
gh variable set MAX_OPEN_PRS --repo $Full --body '3' | Out-Null
gh variable set GIT_AUTHOR_NAME --repo $Full --body 'Numan Ul Haq' | Out-Null
gh variable set GIT_AUTHOR_EMAIL --repo $Full --body $Email | Out-Null
Ok 'Variables set (AUTOMATION_ENABLED=true is the kill switch)'

# 8. Branch protection ------------------------------------------------------------
Step 'Protecting main (CI must pass before any merge)'
$protection = @'
{
  "required_status_checks": { "strict": false, "contexts": ["test"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
'@
$pf = New-TemporaryFile
Set-Content -Path $pf.FullName -Value $protection -Encoding ASCII
gh api -X PUT "repos/$Full/branches/main/protection" --input $pf.FullName | Out-Null; Check 'branch protection'
Remove-Item $pf
Ok 'main is protected'

# 9. Profile README ------------------------------------------------------------------
Step "Profile README (github.com/$Owner)"
$ans = Read-Host '    Add a daily-updated "Currently Building" section to your profile README? (Y/n)'
if ($ans -ne 'n') {
  $pdir = Join-Path ([IO.Path]::GetTempPath()) "profile-$Owner-$(Get-Random)"
  gh repo clone "$Owner/$Owner" $pdir -- -q; Check 'clone profile repo'
  Copy-Item (Join-Path $Src 'scripts/profile/README.md') (Join-Path $pdir 'README.md') -Force
  New-Item -ItemType Directory -Force (Join-Path $pdir '.github/workflows') | Out-Null
  Copy-Item (Join-Path $Src 'scripts/profile/profile-refresh.yml') (Join-Path $pdir '.github/workflows/') -Force
  Push-Location $pdir
  git config user.name 'Numan Ul Haq'; git config user.email $Email
  git add -A
  git commit -q -m 'docs: add auto-updating Currently Building section' -m 'Co-authored-by: Claude <noreply@anthropic.com>'
  git push -q; Check 'push profile'
  Pop-Location
  Remove-Item $pdir -Recurse -Force
  Ok 'Profile README updated'
}

# 10. Kick off ----------------------------------------------------------------------
Step 'Starting the first daily run now'
Start-Sleep -Seconds 3
gh workflow run daily-dev.yml --repo $Full; Check 'workflow run'
Write-Host @"

All set.
  Repo:      https://github.com/$Full
  Runs:      https://github.com/$Full/actions
  Schedule:  daily 10:17 PKT (build), every PR (review + risk check), Mon (planner), Fri (digest)
  Pause:     gh variable set AUTOMATION_ENABLED --repo $Full --body false
"@ -ForegroundColor Green
