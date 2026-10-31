<#
.SYNOPSIS
  Runs development phases with headless Claude Code sessions (claude -p).

.DESCRIPTION
  For each phase:
    1. Build session (fresh context) following harness/prompts/build.md.
    2. Gate: npm run verify + open criteria in plan/acceptance.json.
       If not done, resume the same session with harness/state/continue.md (max -MaxContinuations).
    3. git commit checkpoint.
    4. Review session (fresh context, no Edit tool) following harness/prompts/review.md.
       Verdict saved to progress/reviews/phase-N.md.
       NEEDS_WORK -> fix session (fresh context) -> gate -> review again (max -MaxFixRounds).

  This file is ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File harness/run-phase.ps1 -Phase 1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File harness/run-phase.ps1 -Phase 2 -Through 6
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][int]$Phase,
    [int]$Through = 0,
    [string]$Model = 'opus',
    [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')][string]$BuildEffort = 'medium',
    [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')][string]$ReviewEffort = 'high',
    [ValidateSet('auto', 'acceptEdits', 'bypassPermissions')][string]$PermissionMode = 'auto',
    [int]$MaxContinuations = 2,
    [int]$MaxFixRounds = 2,
    [double]$MaxBudgetUsd = 0,
    [switch]$SkipReview,
    [switch]$SkipGate
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$Utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $Utf8
$OutputEncoding = $Utf8

$AcceptanceFile = Join-Path $Root 'plan/acceptance.json'
$ReviewDir = Join-Path $Root 'progress/reviews'
$LogDir = Join-Path $Root 'harness/logs'
$StateDir = Join-Path $Root 'harness/state'
$ContinueFile = Join-Path $StateDir 'continue.md'
foreach ($d in @($ReviewDir, $LogDir, $StateDir)) {
    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

# Appended to the system prompt. Keep these free of double quotes (PowerShell 5.1 native argument quoting).
$BuildSystem = 'You are running unattended inside a scripted harness. No human will answer until this run ends. ' +
'Do not end a turn with a summary that announces the next step; take the step instead. ' +
'Do not stop to ask for confirmation on routine product or code decisions; choose what fits docs/prd.md and docs/architecture.md best and record notable choices in docs/adr.md. ' +
'Put short status notes in the same message as your next tool call. ' +
'End the session only when every acceptance criterion of the current phase passes with evidence you observed and the session-end steps in harness/prompts/build.md are done, ' +
'or when you are blocked by something only a human can resolve, such as an account login, a payment, or a physical device. ' +
'In that case set blocked on the phase in plan/acceptance.json with the reason, then do the session-end steps. ' +
'Never push to a git remote, deploy, change git config, or touch files outside this project.'

$ReviewSystem = 'You are running unattended as an independent reviewer inside a scripted harness. No human will answer until this run ends. ' +
'You did not write this code and you have no stake in it passing. ' +
'Do not modify project files and do not commit; the only files you may create are throwaway specs and screenshots under e2e/_review/. ' +
'Your final message is saved verbatim as the review report, so it must follow the format in harness/prompts/review.md and start with the VERDICT line.'

function Write-Info([string]$msg) { Write-Host ('[harness] ' + $msg) -ForegroundColor Cyan }
function Write-Warn([string]$msg) { Write-Host ('[harness] ' + $msg) -ForegroundColor Yellow }
function Write-Err([string]$msg) { Write-Host ('[harness] ' + $msg) -ForegroundColor Red }
function Get-Stamp { (Get-Date).ToString('yyyyMMdd-HHmmss') }

function Get-Short([string]$text, [int]$max) {
    if (-not $text) { return '' }
    $one = ($text -replace '\s+', ' ').Trim()
    if ($one.Length -gt $max) { return $one.Substring(0, $max) + '...' }
    return $one
}

function Get-ToolDetail($inputObj) {
    if ($null -eq $inputObj) { return '' }
    foreach ($k in @('command', 'file_path', 'path', 'pattern', 'url', 'description')) {
        $v = $inputObj.$k
        if ($v) { return (Get-Short ([string]$v) 140) }
    }
    return ''
}

function Test-Preflight {
    foreach ($cmd in @('claude', 'node', 'npm', 'git')) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            Write-Err "$cmd was not found on PATH. See harness/README.md (Prerequisites)."
            return $false
        }
    }
    $ver = (& claude --version 2>$null | Select-Object -First 1)
    Write-Info "claude $ver, model $Model, permission mode $PermissionMode"
    if (-not (Test-Path -LiteralPath (Join-Path $Root '.git'))) {
        Write-Info 'No git repository yet; running git init.'
        & git init -q | Out-Null
    }
    $email = (& git config user.email 2>$null)
    if (-not $email) {
        Write-Err 'git user.email is not set. Set your identity once, then rerun:'
        Write-Err '  git config --global user.name  "Your Name"'
        Write-Err '  git config --global user.email "you@example.com"'
        return $false
    }
    if (-not (Test-Path -LiteralPath $AcceptanceFile)) {
        Write-Err 'plan/acceptance.json was not found.'
        return $false
    }
    return $true
}

function Save-Checkpoint([string]$message) {
    $status = (& git status --porcelain 2>$null)
    if (-not $status) { return }
    & git add -A 2>$null | Out-Null
    & git commit -q -m $message 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Info "Committed: $message" }
    else { Write-Warn 'git commit failed; continuing without a checkpoint.' }
}

function Get-PhaseState([int]$PhaseId) {
    try {
        $acc = Get-Content -Raw -Encoding UTF8 -LiteralPath $AcceptanceFile | ConvertFrom-Json
    }
    catch {
        return [pscustomobject]@{ Found = $false; Error = 'plan/acceptance.json is not valid JSON. Fix the syntax.'; Name = ''; Blocked = $null; Open = @(); Total = 0 }
    }
    $p = $acc.phases | Where-Object { $_.id -eq $PhaseId } | Select-Object -First 1
    if (-not $p) {
        return [pscustomobject]@{ Found = $false; Error = "Phase $PhaseId is not defined in plan/acceptance.json."; Name = ''; Blocked = $null; Open = @(); Total = 0 }
    }
    $open = @($p.criteria | Where-Object { $_.passes -ne $true })
    return [pscustomobject]@{ Found = $true; Error = $null; Name = $p.name; Blocked = $p.blocked; Open = $open; Total = @($p.criteria).Count }
}

function Invoke-Gate {
    if ($SkipGate) { return [pscustomobject]@{ Ok = $true; Tail = '' } }
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'package.json'))) {
        return [pscustomobject]@{ Ok = $false; Tail = 'package.json does not exist yet, so npm run verify cannot run.' }
    }
    Write-Info 'Gate: npm run verify'
    $out = & cmd /c 'npm run verify 2>&1'
    $code = $LASTEXITCODE
    $tail = (@($out) | Select-Object -Last 80) -join "`n"
    if ($code -eq 0) { Write-Info 'Gate passed.' } else { Write-Warn "Gate failed (exit $code)." }
    return [pscustomobject]@{ Ok = ($code -eq 0); Tail = $tail }
}

function Invoke-Claude {
    param(
        [int]$PhaseId,
        [string]$Prompt,
        [string]$Effort,
        [string]$System,
        [string]$Label,
        [string]$ResumeId = '',
        [string[]]$Extra = @()
    )
    $logFile = Join-Path $LogDir ('phase{0}-{1}-{2}.jsonl' -f $PhaseId, $Label, (Get-Stamp))
    $cliArgs = @('-p', $Prompt,
        '--model', $Model,
        '--effort', $Effort,
        '--permission-mode', $PermissionMode,
        '--output-format', 'stream-json', '--verbose',
        '--append-system-prompt', $System)
    if ($ResumeId) { $cliArgs += @('--resume', $ResumeId) }
    if ($MaxBudgetUsd -gt 0) { $cliArgs += @('--max-budget-usd', [string]$MaxBudgetUsd) }
    if ($Extra.Count -gt 0) { $cliArgs += $Extra }

    Write-Info "Session '$Label' (effort $Effort). Log: harness/logs/$(Split-Path -Leaf $logFile)"
    $script:LastResult = $null
    $writer = New-Object System.IO.StreamWriter($logFile, $true, $Utf8)
    try {
        & claude @cliArgs | ForEach-Object {
            $line = [string]$_
            $writer.WriteLine($line)
            $writer.Flush()
            $evt = $null
            try { $evt = $line | ConvertFrom-Json } catch { $evt = $null }
            if ($null -eq $evt) {
                if ($line.Trim()) { Write-Host ('  ' + (Get-Short $line 200)) }
                return
            }
            if ($evt.type -eq 'assistant' -and $evt.message -and $evt.message.content) {
                foreach ($c in $evt.message.content) {
                    if ($c.type -eq 'text' -and $c.text) {
                        Write-Host ('  > ' + (Get-Short $c.text 300)) -ForegroundColor Gray
                    }
                    elseif ($c.type -eq 'tool_use') {
                        Write-Host ('  [' + $c.name + '] ' + (Get-ToolDetail $c.input)) -ForegroundColor DarkGray
                    }
                }
            }
            elseif ($evt.type -eq 'result') {
                $script:LastResult = $evt
            }
        }
    }
    finally {
        $writer.Close()
    }

    $res = $script:LastResult
    if ($null -eq $res) {
        Write-Warn 'Session ended without a result event (crash, login problem, or interruption).'
    }
    elseif ($res.is_error) {
        Write-Warn ('Session ended with an error: ' + $res.subtype)
    }
    else {
        Write-Info ('Session finished: ' + $res.num_turns + ' turns, cost USD ' + $res.total_cost_usd)
    }
    return $res
}

function Write-ContinueNote([int]$PhaseId, $state, $gate) {
    $lines = @("# Continue: phase $PhaseId", '', 'The harness checked your work after your last turn. The phase is not done yet.', '')
    if (-not $state.Found) {
        $lines += ('- ' + $state.Error)
    }
    elseif ($state.Open.Count -gt 0) {
        $lines += ('- Open acceptance criteria (' + $state.Open.Count + ' of ' + $state.Total + '):')
        foreach ($c in $state.Open) { $lines += ('  - ' + $c.id + ' ' + $c.text) }
    }
    if (-not $gate.Ok) {
        $lines += @('', '- npm run verify failed. Last lines of its output:', '', '```', $gate.Tail, '```')
    }
    $lines += @('',
        'Fix these, rerun the checks, update plan/acceptance.json, then do the session-end steps in harness/prompts/build.md.',
        'If something only a human can resolve blocks you, set blocked on the phase instead.')
    [System.IO.File]::WriteAllText($ContinueFile, ($lines -join "`n"), $Utf8)
}

function Invoke-BuildLoop([int]$PhaseId, [string]$Label) {
    $sessionId = ''
    for ($i = 0; $i -le $MaxContinuations; $i++) {
        if ($i -eq 0 -or -not $sessionId) {
            $prompt = "Phase $PhaseId. Read harness/prompts/build.md and follow it for phase $PhaseId."
            $res = Invoke-Claude -PhaseId $PhaseId -Prompt $prompt -Effort $BuildEffort -System $BuildSystem -Label $Label
        }
        else {
            $prompt = "Read harness/state/continue.md and keep working on phase $PhaseId until it is done."
            $res = Invoke-Claude -PhaseId $PhaseId -Prompt $prompt -Effort $BuildEffort -System $BuildSystem -Label "$Label-cont$i" -ResumeId $sessionId
        }
        if ($null -eq $res) { return 'error' }
        if ($res.is_error -and ([string]$res.subtype -match 'budget')) { return 'budget' }
        if ($res.session_id) { $sessionId = $res.session_id }

        $state = Get-PhaseState $PhaseId
        if ($state.Found -and $state.Blocked) {
            Write-Err ("Phase $PhaseId is blocked: " + $state.Blocked)
            return 'blocked'
        }
        $gate = Invoke-Gate
        if ($state.Found -and $state.Open.Count -eq 0 -and $gate.Ok) {
            Write-Info ("Phase ${PhaseId}: all " + $state.Total + ' criteria pass and the gate is green.')
            return 'done'
        }
        Write-ContinueNote $PhaseId $state $gate
        if ($i -lt $MaxContinuations) {
            Write-Warn ("Phase $PhaseId is not done (" + $state.Open.Count + ' open criteria, gate ok=' + $gate.Ok + '). Continuation ' + ($i + 1) + ' of ' + $MaxContinuations + '.')
        }
    }
    return 'incomplete'
}

function Invoke-Review([int]$PhaseId, [int]$Round) {
    $prompt = "Review phase $PhaseId. Read harness/prompts/review.md and follow it for phase $PhaseId."
    $res = Invoke-Claude -PhaseId $PhaseId -Prompt $prompt -Effort $ReviewEffort -System $ReviewSystem -Label "review$Round" -Extra @('--disallowedTools', 'Edit,NotebookEdit')
    if ($null -eq $res -or -not $res.result) { return 'error' }
    $text = ([string]$res.result).Trim()
    $file = Join-Path $ReviewDir "phase-$PhaseId.md"
    $footer = '<!-- written by harness/run-phase.ps1, review round ' + $Round + ', ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' -->'
    [System.IO.File]::WriteAllText($file, ($text + "`n`n" + $footer + "`n"), $Utf8)
    Write-Info "Review saved: progress/reviews/phase-$PhaseId.md"
    $first = ($text -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
    if ($first -match 'VERDICT:\s*PASS') { return 'pass' }
    if ($first -match 'VERDICT:\s*NEEDS_WORK') { return 'needs_work' }
    Write-Warn 'The review did not start with a VERDICT line; treating it as NEEDS_WORK.'
    return 'needs_work'
}

function Invoke-Phase([int]$PhaseId) {
    $state = Get-PhaseState $PhaseId
    if (-not $state.Found) { Write-Err $state.Error; return $false }
    Write-Info "===== Phase ${PhaseId}: $($state.Name) ====="
    Save-Checkpoint "chore: checkpoint before phase $PhaseId"

    $outcome = Invoke-BuildLoop $PhaseId 'build'
    Save-Checkpoint "phase ${PhaseId}: build session"
    if ($outcome -ne 'done') {
        Write-Err "Phase $PhaseId stopped ($outcome). Read progress/handoff.md, harness/state/continue.md and harness/logs, then rerun this phase."
        return $false
    }
    if ($SkipReview) {
        Write-Warn 'Review skipped (-SkipReview).'
        return $true
    }

    for ($round = 1; $round -le ($MaxFixRounds + 1); $round++) {
        $verdict = Invoke-Review $PhaseId $round
        Save-Checkpoint "phase ${PhaseId}: review $round"
        if ($verdict -eq 'pass') {
            Write-Info "Phase $PhaseId PASSED independent review."
            return $true
        }
        if ($verdict -eq 'error') {
            Write-Err 'The review session failed. Check harness/logs and rerun.'
            return $false
        }
        if ($round -gt $MaxFixRounds) { break }
        Write-Warn "Review round $round found blocking issues; starting fix session $round."
        $outcome = Invoke-BuildLoop $PhaseId "fix$round"
        Save-Checkpoint "phase ${PhaseId}: fix session $round"
        if ($outcome -ne 'done') {
            Write-Err "Fix session stopped ($outcome). Read progress/handoff.md and progress/reviews/phase-$PhaseId.md."
            return $false
        }
    }
    Write-Err "Phase $PhaseId still has blocking findings after $MaxFixRounds fix rounds. See progress/reviews/phase-$PhaseId.md."
    return $false
}

if (-not (Test-Preflight)) { exit 1 }
$last = $Phase
if ($Through -gt $Phase) { $last = $Through }
for ($ph = $Phase; $ph -le $last; $ph++) {
    $ok = Invoke-Phase $ph
    if (-not $ok) { exit 1 }
}
Write-Info "Finished phase(s) $Phase to $last."
exit 0
