# Character look intake

Fill this when adding a new bot avatar to the office. Keep answers short.

**Name / id:**  
**Role (one line):**  
**Body (robot / creature / other + size):**  
**Colors (primary + accent):**  
**Outfit / props:**  
**Default expression:**  
**Personality (3 adjectives):**  
**Do-nots:**  

---

## Edit (same character later)

Only describe the change. Examples: “sweater red”, “pirate hat”, “add round glasses”.

**Character id:**  
**Change:**  

---

## Animation checklist (run after still or big edit)

- [ ] idle  
- [ ] work  
- [ ] talk  
- [ ] walk  
- [ ] movie-highfive (and any other movie beats)
- [ ] transitions (when available): sit-down, stand-up, turn-left, turn-right  
- [ ] cutouts: `scripts/make-cutouts.sh {id}` → `assets/cutout/{id}-*.webm` + `{id}-still.png`

## Cutout + transition rules

- Generate plates on solid cream `#F2DCBD`, same framing, feet planted, no room props (see `ANIMATION.md`).
- Run rembg cutouts — **do not chromakey cream** (body paint matches the plate).
- Until turn clips exist, walk L/R uses CSS `facing-left` (sprite mirror only).
- Stage crossfades between modes; prefer cutout WebM/PNG when present.

## Behavior checklist

- [ ] Assigned desk home  
- [ ] Collision with others  
- [ ] Can meet another bot: walk → talk → high-five on agree → return to desks  
