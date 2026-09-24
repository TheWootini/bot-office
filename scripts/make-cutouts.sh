#!/usr/bin/env bash
# Batch rembg cutouts: cream-bg mp4/jpg → transparent webm/webp/png under assets/cutout/
# Usage: scripts/make-cutouts.sh [id ...]
# Env: REMBG_MODEL=u2net (default), MAX_FPS=12 (downsample for speed), FORCE=1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ASSETS="$ROOT/assets"
OUT="$ASSETS/cutout"
WORKDIR="$ROOT/tmp-cutout"
PY="${ROOT}/.venv/bin/python"
MODEL="${REMBG_MODEL:-u2net}"
MAX_FPS="${MAX_FPS:-12}"
FORCE="${FORCE:-0}"
STATES=(idle work talk walk movie-highfive)
IDS=("$@")
if [[ ${#IDS[@]} -eq 0 ]]; then
  IDS=(ceo ceo-f game-maker game-artist helen)
fi

mkdir -p "$OUT" "$WORKDIR"
if [[ ! -x "$PY" ]]; then
  echo "Missing venv at .venv — create with: python3 -m venv .venv && .venv/bin/pip install 'rembg[cpu]' onnxruntime pillow" >&2
  exit 1
fi

# Remove legacy chromakey webms that ate cream-colored bodies
if [[ -f "$OUT/ceo-walk.webm" ]] && [[ "$FORCE" == "1" || ! -f "$OUT/.rembg-ok" ]]; then
  # will regenerate
  true
fi

process_still() {
  local id="$1"
  local src=""
  for ext in jpg jpeg png; do
    if [[ -f "$ASSETS/${id}-still.${ext}" ]]; then
      src="$ASSETS/${id}-still.${ext}"
      break
    fi
  done
  [[ -n "$src" ]] || return 0
  local dest="$OUT/${id}-still.png"
  if [[ -f "$dest" && "$FORCE" != "1" ]]; then
    echo "skip still $id (exists)"
    return 0
  fi
  echo "still → $dest"
  "$PY" - "$src" "$dest" "$MODEL" <<'PY'
import sys
from rembg import remove, new_session
from PIL import Image
src, dest, model = sys.argv[1], sys.argv[2], sys.argv[3]
session = new_session(model)
img = Image.open(src).convert("RGBA")
out = remove(img, session=session)
out.save(dest)
print("wrote", dest, out.size)
PY
}

process_video() {
  local id="$1" state="$2"
  local src="$ASSETS/${id}-${state}.mp4"
  [[ -f "$src" ]] || return 0
  local dest="$OUT/${id}-${state}.webm"
  local dest_webp="$OUT/${id}-${state}.webp"
  if [[ -f "$dest" && -f "$dest_webp" && "$FORCE" != "1" ]]; then
    echo "skip video $id-$state (exists)"
    return 0
  fi
  # If webm exists but webp missing, just transcode webm→webp
  if [[ -f "$dest" && ! -f "$dest_webp" && "$FORCE" != "1" ]]; then
    echo "webp only → $dest_webp"
    ffmpeg -y -hide_banner -loglevel error -c:v libvpx-vp9 -i "$dest" \
      -loop 0 -c:v libwebp -q:v 70 "$dest_webp"
    if command -v webpmux >/dev/null 2>&1; then
      "$ROOT/scripts/fix-webp-disposal.sh" "$dest_webp"
    fi
    echo "  wrote $dest_webp ($(du -h "$dest_webp" | cut -f1))"
    return 0
  fi
  local job="$WORKDIR/${id}-${state}"
  rm -rf "$job"
  mkdir -p "$job/src" "$job/out"
  echo "video → $dest (extract @ ${MAX_FPS}fps)"
  # Extract frames at capped fps for rembg throughput
  ffmpeg -y -hide_banner -loglevel error -i "$src" -vf "fps=${MAX_FPS}" -q:v 2 "$job/src/f_%05d.png"
  local n
  n=$(ls -1 "$job/src"/*.png 2>/dev/null | wc -l)
  echo "  frames: $n  model=$MODEL"
  "$PY" - "$job/src" "$job/out" "$MODEL" <<'PY'
import sys, os
from rembg import remove, new_session
from PIL import Image
from pathlib import Path
src_dir, out_dir, model = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
session = new_session(model)
frames = sorted(src_dir.glob("*.png"))
for i, p in enumerate(frames, 1):
    img = Image.open(p).convert("RGBA")
    out = remove(img, session=session)
    out.save(out_dir / p.name)
    if i % 10 == 0 or i == len(frames):
        print(f"  rembg {i}/{len(frames)}", flush=True)
PY
  # Stitch PNG sequence → VP9 with alpha
  # Use rgba → yuva420p via format filter
  # VP9+alpha: encode yuva420p; ffprobe may still print yuv420p but alpha_mode=1 is set.
  # Decode with: ffmpeg -c:v libvpx-vp9 -i file.webm -vf format=rgba …
  ffmpeg -y -hide_banner -loglevel error -framerate "$MAX_FPS" -i "$job/out/f_%05d.png" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 28 -an \
    "$dest"
  # sanity: require alpha_mode in probe
  if ! ffprobe -v error -show_entries stream_tags=alpha_mode -of default=nw=1:nk=1 "$dest" | grep -q 1; then
    echo "WARN: $dest may lack alpha_mode tag" >&2
  fi
  echo "  wrote $dest ($(du -h "$dest" | cut -f1))"

  # Also write animated WebP with alpha — preferred for Chromium stage playback
  # (VP9 WebM alpha is unreliable in <video>; animated WebP works in <img>).
  local dest_webp="$OUT/${id}-${state}.webp"
  ffmpeg -y -hide_banner -loglevel error -c:v libvpx-vp9 -i "$dest" \
    -loop 0 -c:v libwebp -q:v 70 "$dest_webp"
  # ffmpeg writes dispose=none + blend=yes → ghost trails in Chromium <img>; fix flags
  if command -v webpmux >/dev/null 2>&1; then
    "$ROOT/scripts/fix-webp-disposal.sh" "$dest_webp"
  else
    echo "WARN: webpmux missing; cutout WebP may ghost (install webp package)" >&2
  fi
  echo "  wrote $dest_webp ($(du -h "$dest_webp" | cut -f1))"

  rm -rf "$job"
}

echo "=== make-cutouts (model=$MODEL max_fps=$MAX_FPS) ids=${IDS[*]} ==="
for id in "${IDS[@]}"; do
  process_still "$id"
  for state in "${STATES[@]}"; do
    process_video "$id" "$state"
  done
done
date -Iseconds > "$OUT/.rembg-ok"
echo "=== done ==="
ls -la "$OUT"
