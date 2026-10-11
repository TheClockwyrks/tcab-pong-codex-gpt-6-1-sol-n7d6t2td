# Carom

A browser paddle duel built around spin and bank shots. Slide through a hit to curve the ball; use two swaying, rotating obstacles to find an angle past your opponent. Play against the machine or share a keyboard with a friend. First to 11 wins, with a two-point lead.

Everything is drawn on canvas and the sounds are synthesized by the Simple 2D engine. No assets, services, or credentials are needed at runtime.

## Run

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Build

```sh
npm run build
npm run preview
```

The complete static site is in `dist/`. Serve that directory at the root of any static server.

## Controls

- Solo: W/S or Up/Down moves the left paddle.
- Versus: W/S moves the left paddle; Up/Down moves the right.
- Menus: either pair of movement keys selects; Enter or Space confirms. Mouse and touch select and activate menu items.
- P or Escape pauses and resumes. Escape also returns from instructions and match results.
- M toggles sound. Backquote toggles engine diagnostics.
- Touchscreen controls appear when you touch the game: one vertical slider on each side and menu controls at the top.

## Development

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` validate the implementation. Tests run the actual engine with a native canvas and deterministic clocks, covering collisions, spin, scores, AI, input, and immutable state transitions.

The game state and exports live in `src/game.ts`; world/debug operations, simulation, collision resolution, and rendering live in separate modules beside it. The supplied runtime owns input, audio, timing, canvas fitting, diagnostics, and recording.

`showcase/` contains screenshots and a recorded rally. To reproduce them while the development server is running, run `node tools/capture.mjs`. Chromium launches without a sandbox for this container.
