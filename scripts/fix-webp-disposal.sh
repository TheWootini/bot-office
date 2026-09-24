#!/usr/bin/env bash
# Rewrite animated WebPs: dispose=background, blend=no (fixes ghost trails in Chromium <img>).
# Usage: scripts/fix-webp-disposal.sh [path.webp ...]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=("$@")
if [[ ${#FILES[@]} -eq 0 ]]; then
  FILES=("$ROOT"/assets/cutout/*.webp)
fi
fix_one() {
  local src="$1"
  [[ -f "$src" ]] || return 0
  local info n
  info=$(webpmux -info "$src" 2>/dev/null || true)
  [[ "$info" == *animation* ]] || return 0
  n=$(echo "$info" | awk '/Number of frames/{print $4}')
  [[ -n "$n" && "$n" -gt 0 ]] || return 0
  local td frames=() i d line mm
  td=$(mktemp -d)
  trap 'rm -rf "$td"' RETURN
  mapfile -t durs < <(echo "$info" | awk '
    match($0, /([0-9]+)[[:space:]]+(none|background)[[:space:]]+(yes|no)/, a) { print a[1] }
  ')
  if [[ ${#durs[@]} -ne "$n" ]]; then
    durs=()
    for ((i=0; i<n; i++)); do durs+=(83); done
  fi
  for ((i=1; i<=n; i++)); do
    webpmux -get frame "$i" "$src" -o "$td/f_$(printf '%05d' "$i").webp" >/dev/null
  done
  {
    for ((i=1; i<=n; i++)); do
      d="${durs[$((i-1))]}"
      echo "-frame $td/f_$(printf '%05d' "$i").webp +${d}+0+0+1-b"
    done
    echo "-loop 0"
    echo "-bgcolor 0,0,0,0"
    echo "-o $td/out.webp"
  } >"$td/args.txt"
  webpmux "$td/args.txt" >/dev/null
  mv "$td/out.webp" "$src"
  echo "fixed disposal $src ($n frames)"
}
for f in "${FILES[@]}"; do
  fix_one "$f"
done
