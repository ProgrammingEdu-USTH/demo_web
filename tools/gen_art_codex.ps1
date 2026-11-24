# ============================================================================
# Tạo ảnh minh hoạ bằng Codex CLI (công cụ image_generation) — dùng khi Antigravity
# hết hạn mức. Cùng định dạng spec với gen_art.ps1.
# Dùng: powershell -File tools/gen_art_codex.ps1 -Spec tools/art_specs/x.json [-OutDir ...]
# - Codex chạy trong sandbox workspace-write với thư mục làm việc = OutDir, nên chỉ
#   ghi được vào đó. Ảnh lưu thành <name>.png. Ảnh đã có (jpg/png) thì bỏ qua.
# - Chạy tuần tự, ~1 phút/ảnh.
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Spec,
  [string]$OutDir = ''
)

$root = Split-Path -Parent $PSScriptRoot
$raw = if ($OutDir) { $OutDir } else { Join-Path $root '_ref\ai-art\raw' }
New-Item -ItemType Directory -Force $raw | Out-Null

$STYLE = 'flat vector illustration for a cute educational coding game, clean thick dark plum-brown outlines, soft two-tone cel shading, rounded friendly shapes, warm cozy palette, lighting from top-left, crisp edges.'
$OBJ = 'Composition: one single object, front view with a slight top-down angle, centered with generous empty margin, isolated on a pure flat solid magenta background (#FF00FF) filling the whole canvas edge to edge, no ground shadow, no gradient in the background, square 1:1.'
$BG = 'Composition: wide 16:9 landscape game background, no characters, the middle area must stay empty for foreground objects, muted slightly darker tones so foreground objects stand out.'

$items = Get-Content $Spec -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($it in $items) {
  $exists = Get-ChildItem $raw -File -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -eq $it.name }
  if ($exists) { Write-Output "skip $($it.name)"; continue }
  $style = if ($it.style) { $it.style } else { $STYLE }
  $prompt = "Use your image generation tool to create exactly ONE image, then save it in the current working directory as $($it.name).png. Subject: $($it.prompt) Style guide: $style No text, no letters, no numbers, no watermark. $(if ($it.bg) { $BG } else { $OBJ }) Do not modify any other files. Reply with only the saved file path."
  $t0 = Get-Date
  $ErrorActionPreference = 'Continue'
  codex exec --skip-git-repo-check --ephemeral --sandbox workspace-write -C $raw $prompt 2>&1 | Out-Null
  $dt = [int]((Get-Date) - $t0).TotalSeconds
  if (Test-Path (Join-Path $raw "$($it.name).png")) { Write-Output "ok   $($it.name) (${dt}s)" }
  else { Write-Output "FAIL $($it.name) (${dt}s)" }
}
