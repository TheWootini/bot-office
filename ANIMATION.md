# Animation clip guide

Character motion lives as cream-background source MP4s under `assets/`, then AI-cutout WebMs + animated WebPs under `assets/cutout/`. The stage prefers cutouts when present — **WebP first** for reliable alpha.

## Required loops / beats

| Clip | File | Notes |
|------|------|--------|
| idle | `{id}-idle.mp4` | Soft breathe / sway; feet planted |
| walk | `{id}-walk.mp4` | Cycle facing camera-right; UI mirrors for left |
| talk | `{id}-talk.mp4` | Gesture while speaking |
| work (sit) | `{id}-work.mp4` | Seated at desk / typing |
| movie-highfive | `{id}-movie-highfive.mp4` | One-shot celebrate / high-five |

## Transition clips (add when ready)

| Clip | File | Notes |
|------|------|--------|
| sit-down | `{id}-sit-down.mp4` | Standing → seated; play once before work |
| stand-up | `{id}-stand-up.mp4` | Seated → standing; play once before walk |
| turn-left | `{id}-turn-left.mp4` | In-place turn; replaces CSS mirror when available |
| turn-right | `{id}-turn-right.mp4` | In-place turn the other way |

Until turn clips exist, walk L/R stays CSS `facing-left` (scaleX −1 on `.sprite` only — nameplate stays upright).

## Still

`{id}-still.jpg|png` — master portrait. Cutout pipeline writes `assets/cutout/{id}-still.png` with alpha.

## Cutout pipeline

```bash
# one-time
python3 -m venv .venv
.venv/bin/pip install 'rembg[cpu]' onnxruntime pillow

# all characters (uses rembg u2net, not chromakey — cream bodies match #F2DCBD)
scripts/make-cutouts.sh

# one id
scripts/make-cutouts.sh ceo
FORCE=1 MAX_FPS=12 REMBG_MODEL=u2net scripts/make-cutouts.sh ceo-f
```

Outputs:

- `assets/cutout/{id}-{state}.webp` — **preferred** animated WebP with alpha (stage uses `<img>`)
- `assets/cutout/{id}-{state}.webm` — VP9 `yuva420p` with alpha (fallback)
- `assets/cutout/{id}-still.png` — RGBA

**Do not chromakey #F2DCBD** on current cast: body paint matches the cream plate and holes out. Keep chromakey only for future pure green-screen regenerations.

## Imagine / generation prompt rules

When generating or editing stills and motion plates:

1. **Solid cream plate** `#F2DCBD` (RGB 242, 220, 189) — flat, no gradient, no floor grid
2. **Same framing** across idle / walk / talk / work / still — full body, centered, consistent scale
3. **Feet planted** on an invisible ground line; no floating; soft contact shadow optional but same every shot
4. **No room props** — no desks, plants, walls, coffee mugs in frame (stage composites the room)
5. Match sweater / beanie / proportions to the character still; small edits only change the requested detail

## Stage playback

- Dual-layer crossfade (~280–320 ms) between modes — no hard cuts
- Prefer `/assets/cutout/…` **WebP** (then WebM, then source MP4) / PNG from `/api/cast`
- Animated WebP plays in `<img>`; WebM/MP4 use `<video>`
- Facing flips `.sprite` with a ~280 ms transform transition

## Lessons log (append on every win)

- **2026-09-23** Chromakey of `#F2DCBD` destroys cream robot bodies — use rembg (`scripts/make-cutouts.sh`), not chromakey.
- **2026-09-23** Without HTTP Range/206 on the static server, Chromium `<video>` fails and the UI looks “stills only.” Keep Range support in `server.js`.
- **2026-09-23** CEO walk/idle/talk/work share ~448×672 framing and cream plate — that consistency is what makes cutouts and mode swaps viable; lock it for every new id.
- **2026-09-23** Meet / wander / desks / coffee E2E passed; treat that script as the behavior smoke for each new cast member.
- **2026-09-23** FFmpeg ken-burns from stills are interim only — never mark a character complete on those.
- **2026-09-23** rembg sometimes eats white clipboard paper (hole when composited); prefer colored clipboard or prop-aware rembg pass.
- **2026-09-23** Chromium often ignores VP9 WebM alpha in `<video>` (plates remain). Prefer **animated WebP with alpha** via `<img>` for stage playback; keep WebM as secondary.
- **2026-09-23** Characters are `<button>`s — UA default white fill looked like cream plates even with transparent WebP. Set `appearance:none; background:transparent; border:none; padding:0` on `.char`.
