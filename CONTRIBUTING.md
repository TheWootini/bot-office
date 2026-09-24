# Contributing

Thanks for helping make Bot Office better.

## Ideas that fit well

- New meet scripts (greet, disagree, celebrate, coffee chat)
- Better collision / pathfinding
- Character packs (still + idle/work/talk/walk/movie clips)
- Accessibility, mobile layout, performance
- Tests for meet state machine

## Character assets

Follow `CHARACTER-INTAKE.md`. Drop files in `assets/` as `{id}-still.jpg|png` and optional `{id}-{idle|work|talk|walk|movie-highfive}.mp4`.

Demo stills/clips in this repo were generated with **Grok Imagine**. Prefer your own assets or regenerate; do not assume commercial rights beyond what xAI’s terms allow for Imagine outputs.

## Dev

```bash
npm start
# http://localhost:8787
```

Open a PR against `main` with a short description of what you changed and how to try it.
