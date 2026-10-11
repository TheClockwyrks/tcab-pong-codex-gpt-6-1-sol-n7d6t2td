import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromState, CaromDebugApi } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => engines.splice(0).forEach((e) => e.destroy()));
async function setup(ms = 8) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, down = true) => {
    const event = new Event(down ? "keydown" : "keyup");
    Object.assign(event, { code, repeat: false });
    target.dispatchEvent(event);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: device,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    target.dispatchEvent(event);
  };
  return { e: engine, d: engine.debug, key, pointer };
}
async function flight(ms = 8) {
  const h = await setup(ms);
  h.e.apply((s) => h.d.setScreen(h.d.clearWorld(s), "playing"));
  h.e.apply((s) => h.d.setBallHeld(h.d.spawnBall(s), false));
  return h;
}

describe("Carom through the engine", () => {
  it("opens with complete immutable title state and diagnostics", async () => {
    const { e, d } = await setup();
    const old = e.state;
    expect(d.snapshot(old)).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      score: { p1: 0, p2: 0 },
      ball: { held: true, speed: 0 },
      obstacleClock: 0,
    });
    await e.advance(2);
    expect(e.state.simTime).toBeCloseTo(0.016);
    expect(old.simTime).toBe(0);
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(9);
  });
  it("starts, serves in the chosen direction, and freezes on pause", async () => {
    const { e, key, d } = await setup(10);
    key("Enter");
    await e.advance(1);
    key("Enter", false);
    expect(e.state.screen).toBe("countdown");
    await e.advance(99);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.vx).toBeLessThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      C.SERVE_SPEED,
    );
    key("Escape");
    await e.advance(1);
    const paused = d.snapshot(e.state);
    await e.advance(20);
    expect(d.snapshot(e.state).ball).toEqual(paused.ball);
    expect(e.state.obstacleClock).toBe(paused.obstacleClock);
    expect(e.state.screen).toBe("paused");
    key("Escape", false);
    key("Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
  });
  it("prioritizes menu movement and remembers title choice", async () => {
    const { e, key } = await setup();
    key("KeyS");
    key("Enter");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(1);
    expect(e.state.screen).toBe("title");
    key("KeyS", false);
    key("Enter", false);
    key("Enter");
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.titleIndex).toBe(1);
  });
  it("accepts click and touch only when both edges use the same item", async () => {
    const { e, d, pointer } = await setup();
    const a = d.menuItemRect(e.state, 0)!,
      b = d.menuItemRect(e.state, 1)!;
    pointer("pointerdown", a.x + 20, a.y + 20);
    await e.advance(1);
    pointer("pointerup", b.x + 20, b.y + 20);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", b.x + 20, b.y + 20, 2, "touch");
    pointer("pointerup", b.x + 20, b.y + 20, 2, "touch");
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    expect(d.menuItemRect(e.state, 0)).toBeNull();
  });
  it("clamps driven movement and carries actual contact velocity", async () => {
    const { e, d } = await flight();
    e.apply((s) =>
      d.setPaddleDriven(
        d.setPaddleVy(
          d.setPaddleCy(s, "left", C.PADDLE_MAX_CY),
          "left",
          C.PADDLE_SPEED,
        ),
        "left",
        true,
      ),
    );
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
    e.apply((s) => d.setPaddleCy(s, "left", C.FIELD_CY));
    e.apply((s) =>
      d.setBallVelocity(
        d.setBallPosition(s, C.P1_X1 + C.BALL_R + 2, C.FIELD_CY),
        -C.SERVE_SPEED,
        0,
      ),
    );
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(e.state.ball!.spin).toBeGreaterThan(0);
  });
  it("reflects walls without changing speed and reflects paddle caps", async () => {
    const { e, d } = await flight();
    e.apply((s) =>
      d.setBallVelocity(d.setBallPosition(s, 300, C.BALL_R + 1), 0, -500),
    );
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(500);
    e.apply((s) =>
      d.setBallVelocity(
        d.setBallPosition(s, 56, C.FIELD_CY - C.PADDLE_HALF - C.BALL_R + 1),
        0,
        300,
      ),
    );
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-300);
  });
  it("resolves upright and rotated obstacles and preserves speed", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setObstacleClockRunning(d.spawnObstacle(s, 0), false));
    e.apply((s) => d.setBallVelocity(d.setBallPosition(s, 465, 220), 500, 0));
    await e.advance(2);
    expect(e.state.ball!.vx).toBeLessThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(500);
    e.apply((s) => d.setObstacleClock(s, 0.75));
    const o = e.state.obstacles[0],
      c = Math.cos(o.theta),
      sn = Math.sin(o.theta);
    e.apply((s) =>
      d.setBallVelocity(
        d.setBallPosition(s, o.cx - 23 * c, o.cy - 23 * sn),
        500 * c,
        500 * sn,
      ),
    );
    await e.advance(1);
    expect(e.state.ball!.vx).toBeLessThan(0);
  });
  it("decays spin and agrees across frame lengths", async () => {
    const run = async (ms: number) => {
      const { e, d } = await flight(ms);
      e.apply((s) =>
        d.setBallSpin(
          d.setBallVelocity(d.setBallPosition(s, 350, 350), 500, 0),
          600,
        ),
      );
      await e.advance(800 / ms);
      return e.state.ball!;
    };
    const a = await run(2),
      b = await run(16);
    expect(a.spin).toBeCloseTo(300);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(Math.hypot(b.vx, b.vy));
    expect(Math.sign(a.vy)).toBe(Math.sign(b.vy));
    expect(a.trail.length).toBeGreaterThan(1);
  });
  it("scores, serves to the loser, and requires a two-point lead", async () => {
    const { e, d } = await flight();
    const point = async () => {
      e.apply((s) =>
        d.setScreen(
          d.setBallHeld(
            d.setBallVelocity(
              d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 300),
              500,
              0,
            ),
            false,
          ),
          "playing",
        ),
      );
      await e.advance(1);
    };
    e.apply((s) => d.setScore(s, 10, 10));
    await point();
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toEqual([]);
    await point();
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
  });
  it("gates AI tracking and movement independently", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setBallVelocity(d.setBallPosition(s, 800, 550), 300, 0));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBeGreaterThan(0);
    e.apply((s) => d.setAiMovement(s, false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) =>
      d.setAiTracking(
        d.setAiMovement(d.setPaddleCy(s, "right", 500), true),
        false,
      ),
    );
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBeLessThan(0);
  });
  it("poses absent entities loudly and reconciles without advancing", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 2)).toThrow();
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    e.apply((s) => d.spawnBall(s));
    e.apply((s) =>
      d.setBallServeSign(
        d.setBallHoldTimer(
          d.setBallSpin(
            d.setBallPosition(d.setBallVelocity(s, 100, 200), 20, 30),
            44,
          ),
          0.2,
        ),
        -1,
      ),
    );
    expect(d.snapshot(e.state).ball).toMatchObject({
      x: 20,
      y: 30,
      vx: 100,
      vy: 200,
      spin: 44,
      holdTimer: 0.2,
      serveSign: -1,
    });
    const before = e.state;
    e.apply((s) => d.reconcile(s));
    expect(e.state).toEqual(before);
    e.apply((s) =>
      d.setMuted(
        d.setTitleIndex(
          d.setMenuIndex(
            d.setResumeScreen(
              d.setMode(
                d.setWinner(d.setReceiver(s, "right"), "left"),
                "versus",
              ),
              "countdown",
            ),
            2,
          ),
          1,
        ),
        true,
      ),
    );
    await e.advance(1);
    expect(e.state.muted).toBe(true);
    e.apply((s) => d.reset(s));
    expect(e.state).toMatchObject({
      screen: "title",
      simTime: 0,
      muted: true,
      titleIndex: 0,
    });
  });
  it("plays at most one cue of each kind in a frame", async () => {
    const { e, d } = await flight(100);
    const cues: string[] = [];
    e.events.on("cue:played", (x) => cues.push(x.cue));
    e.apply((s) => d.setBallVelocity(d.setBallPosition(s, 300, 12), 0, -980));
    await e.advance(1);
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
});

describe("Menu paths and world poses", () => {
  it("opens instructions and returns with the remembered selection", async () => {
    const { e, d, key } = await setup();
    e.apply((s) => d.setMenuIndex(s, 2));
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    key("Enter", false);
    key("Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(2);
    expect(e.state.titleIndex).toBe(2);
  });
  it("restarts and quits a paused match", async () => {
    const { e, d, key } = await setup();
    e.apply((s) =>
      d.setMenuIndex(d.setScreen(d.setScore(s, 5, 4), "paused"), 1),
    );
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.score).toEqual({ p1: 0, p2: 0 });
    key("Enter", false);
    e.apply((s) => d.setMenuIndex(d.setScreen(s, "paused"), 2));
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.ball?.held).toBe(true);
  });
  it("replays a completed match or returns to menu", async () => {
    const { e, d, key } = await setup();
    e.apply((s) => d.setScreen(d.setWinner(s, "right"), "matchover"));
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    key("Enter", false);
    e.apply((s) =>
      d.setMenuIndex(d.setScreen(d.setWinner(s, "left"), "matchover"), 1),
    );
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
  });
  it("keeps missing worlds missing and records countdown trails", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.setScreen(d.clearWorld(s), "countdown"));
    await e.advance(1);
    expect(e.state.ball).toBeNull();
    expect(e.state.obstacles).toEqual([]);
    e.apply((s) => d.spawnObstacle(d.spawnBall(s), 1));
    e.apply((s) => d.drawBallServeSign(s));
    await e.advance(1);
    expect(e.state.ball?.trail.length).toBe(1);
    expect(e.state.obstacles[0].index).toBe(1);
    expect([-1, 1]).toContain(e.state.ball?.serveSign);
  });
  it("maps solo arrows to player one and independent versus input", async () => {
    const { e, d, key } = await setup();
    e.apply((s) => d.setScreen(s, "countdown"));
    key("ArrowDown");
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(C.PADDLE_SPEED);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) => d.setMode(s, "versus"));
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
    key("KeyM");
    await e.advance(1);
    expect(e.state.muted).toBe(true);
  });
});
