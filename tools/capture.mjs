/* global document */
import { Buffer } from "node:buffer";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await page.route("http://localhost:5173/capture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<style>body{margin:0}canvas{width:1280px;height:720px;display:block}</style><canvas id="capture"></canvas>',
    }),
  );
  await page.goto("http://localhost:5173/capture");
  const recording = await page.evaluate(async () => {
    const { createEngine, ConstantClock } =
      await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
    const { game, BACKGROUND } = await import("/src/game.ts");
    const e = createEngine({
      canvas: document.querySelector("canvas"),
      width: 1280,
      height: 720,
      game,
      background: BACKGROUND,
      clock: new ConstantClock(8),
      layout: "dual-vertical",
    });
    await e.initialize();
    await e.advance(1);
    // Keep the handle off the page; this scoped capture controls the engine directly.
    const title = document.querySelector("canvas").toDataURL();
    const d = e.debug;
    e.apply((s) =>
      d.setScreen(
        d.setBallHeld(
          d.setBallSpin(
            d.setBallVelocity(d.setBallPosition(s, 880, 340), -740, -180),
            720,
          ),
          false,
        ),
        "playing",
      ),
    );
    e.apply((s) => d.setScore(s, 7, 6));
    e.startRecording();
    let rally;
    for (let i = 0; i < 500; i++) {
      e.apply((s) => d.setPaddleCy(s, "left", s.ball?.y ?? 360));
      await e.advance(1);
      if (i === 56) rally = document.querySelector("canvas").toDataURL();
    }
    const replay = e.stopRecording();
    e.apply((s) => d.setMode(d.setScreen(s, "playing"), "versus"));
    e.apply((s) =>
      d.setBallHeld(
        d.setBallSpin(
          d.setBallVelocity(d.setBallPosition(s, 690, 400), 670, -340),
          -650,
        ),
        false,
      ),
    );
    await e.advance(12);
    const versus = document.querySelector("canvas").toDataURL();
    e.destroy();
    return { title, rally, versus, replay };
  });
  for (const name of ["title", "rally", "versus"])
    await writeFile(
      `showcase/${name}.png`,
      Buffer.from(recording[name].split(",")[1], "base64"),
    );
  await writeFile(
    "showcase/rally.json.gz",
    gzipSync(JSON.stringify(recording.replay)),
  );
} finally {
  await browser.close();
}
