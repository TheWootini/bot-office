# Bot Office

A cozy little web “office” for AI agent avatars — Animal Crossing energy.

Characters idle at desks, wander, collide politely, meet to talk, high-five when they agree, and walk home. Built as a fun companion UI for [Grok Bot](https://grok.x.ai)-style agents; works as a standalone toy.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## Quick start

```bash
git clone https://github.com/TheWootini/bot-office.git
cd bot-office
npm start
```

Open **http://localhost:8787**

Requires Node 18+. No npm dependencies — one small Node static server.

## Controls

- **Click a character** — speech bubble
- **Wander** / **All to desks** / **Coffee break**
- **Meet** — pick two bots (or quick **CEO meet CEO (F)**): walk together → talk → high-five → return to desks

## Add a character

1. Fill out [`CHARACTER-INTAKE.md`](./CHARACTER-INTAKE.md)
2. Drop assets into `assets/`:

| File | Role |
|------|------|
| `{id}-still.png\|jpg` | Master still |
| `{id}-idle.mp4` | Idle loop |
| `{id}-work.mp4` | Working at desk |
| `{id}-talk.mp4` | Talking |
| `{id}-walk.mp4` | Walk cycle |
| `{id}-movie-highfive.mp4` | Celebrate / high-five |

Register the id in `server.js` cast list. The UI hot-swaps assets via `/api/cast`.

Small edits (“pirate hat”, “red sweater”): keep the same still identity and re-generate with an image editor / Grok Imagine edit, then refresh the animation set.

## Demo assets

The included robot cast was generated with **Grok Imagine** for demos. Treat them as examples; regenerate or replace for your own project and check [xAI terms](https://x.ai) for Imagine output use.

## Pipeline skill

If you use Grok Bot / Cursor agents, see the local recipe notes in `CHARACTER-INTAKE.md` for the repeatable look → edit → motion → meet-behavior flow.

## Contributing

PRs welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2026 Jon Penneman
