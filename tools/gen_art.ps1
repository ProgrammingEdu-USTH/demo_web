# ============================================================================
# Tạo ảnh minh hoạ cho motion graphic bằng Antigravity CLI (agy)
# Dùng: powershell -File tools/gen_art.ps1 -Spec tools/art_specs/m1.json
# - Mỗi mục trong spec: { "name": "...", "prompt": "...", "bg": true|false }
#   bg=false  → vật thể, nền hồng #FF00FF để tách nền (web/scripts/key-art.mjs)
#   bg=true   → ảnh nền 16:9, giữ nguyên
# - CHẠY TUẦN TỰ: agy không chạy được nhiều phiên tạo ảnh cùng lúc (các phiên song
#   song thất bại im lặng). Mỗi ảnh ~1–1,5 phút.
# - Ảnh agy tạo nằm trong ~/.gemini/antigravity-cli/brain/...; script tìm và
#   chép về _ref/ai-art/raw/<name>.jpg. Ảnh đã có thì bỏ qua (xoá file để tạo lại).
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Spec,
  # Thư mục lưu ảnh gốc (mặc định _ref/ai-art/raw; bản mẫu phong cách dùng thư mục khác)
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$raw = if ($OutDir) { $OutDir } else { Join-Path $root '_ref\ai-art\raw' }
New-Item -ItemType Directory -Force $raw | Out-Null
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
$brain = Join-Path $env:USERPROFILE '.gemini\antigravity-cli\brain'

$STYLE = 'Style guide (must follow exactly): 2D game asset for a cute educational coding game, flat vector illustration, clean thick dark plum-brown outlines, soft two-tone cel shading, rounded friendly shapes, warm cozy palette (amber, wood brown, lavender, teal accents), consistent lighting from top-left, crisp edges, no text, no letters, no numbers, no watermark.'
$OBJ = 'Composition: one single object, front view with a slight top-down angle, centered with generous empty margin, isolated on a pure flat solid magenta background (#FF00FF) filling the whole canvas edge to edge, no ground shadow, no gradient in the background, square 1:1.'
$BG = 'Composition: wide 16:9 landscape game background, no characters, the middle area must stay empty for foreground objects, muted slightly darker tones so foreground objects stand out.'

$items = Get-Content $Spec -Raw -Encoding UTF8 | ConvertFrom-Json
Set-Location $raw
foreach ($it in $items) {
  $dst = Join-Path $raw "$($it.name).jpg"
  if (Test-Path $dst) { Write-Output "skip $($it.name)"; continue }
  # Mục trong spec có thể tự đặt "style" riêng (dùng cho bản mẫu so sánh phong cách)
  $style = if ($it.style) { "Style guide (must follow exactly): $($it.style) No text, no letters, no numbers, no watermark." } else { $STYLE }
  $full = "Use ONLY your image generation tool to create exactly ONE image named $($it.name). Do not run any shell commands, do not copy, move or edit any files; just generate the image and stop. Subject: $($it.prompt) $style $(if ($it.bg) { $BG } else { $OBJ }) Reply only DONE."
  $t0 = Get-Date
  # agy ghi cảnh báo ra stderr; không để PowerShell coi đó là lỗi dừng cả lô
  $ErrorActionPreference = 'Continue'
  & $agy --mode accept-edits --print-timeout 300s "--print=$full" 2>&1 | Out-Null
  $ErrorActionPreference = 'Stop'
  $cands = Get-ChildItem $brain -Recurse -File -Include *.jpg, *.png, *.webp -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt $t0 -and $_.FullName -notmatch '\\logs\\' } |
    Sort-Object LastWriteTime
  # Ưu tiên file đúng tên "<name>_<số>", sau đó mới tới các biến thể khác
  $f = $cands | Where-Object { $_.BaseName -match "^$([regex]::Escape($it.name))_\d+$" } | Select-Object -First 1
  if (-not $f) { $f = $cands | Select-Object -First 1 }
  $dt = [int]((Get-Date) - $t0).TotalSeconds
  if ($f) { Copy-Item $f.FullName $dst -Force; Write-Output "ok   $($it.name) <- $($f.Name) (${dt}s)" }
  else { Write-Output "FAIL $($it.name) (${dt}s, không thấy ảnh)" }
}
