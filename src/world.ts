import * as C from "./constants";
import type {
  BallState,
  CaromState,
  ReadState,
  Side,
  Screen,
  Mode,
} from "./game";

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function park(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: drawSign(),
    trail: [],
  };
}
export function obstacle(index: number, t: number) {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new Error(`Unknown obstacle ${index}`);
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle = () => ({ cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: park(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function menuItems(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: ReadState, index: number) {
  if (index < 0 || index >= menuItems(s).length || !Number.isInteger(index))
    return null;
  return {
    x: 480,
    y: (s.screen === "howto" ? 590 : 360) + index * 66,
    w: 320,
    h: 54,
  };
}
export function toTitle(s: ReadState): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
export function startMatch(s: ReadState, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: park(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstacle(o.index, 0)),
  };
}
function ballPose(s: ReadState, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePose(
  s: ReadState,
  side: Side,
  patch: Partial<CaromState["paddles"]["left"]>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug() {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s: ReadState): CaromState => ({
      ...s,
      ball: null,
      obstacles: [],
    }),
    spawnBall: (s: ReadState): CaromState => ({ ...s, ball: park() }),
    spawnObstacle: (s: ReadState, index: number): CaromState => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s: ReadState) => initialState(s.muted),
    reconcile: (s: ReadState): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: ReadState, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: ReadState, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: ReadState, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: ReadState, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: ReadState,
      resumeScreen: "countdown" | "playing",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: ReadState, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: ReadState, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: ReadState, receiver: Side): CaromState => ({
      ...s,
      receiver,
    }),
    setPaddleCy: (s: ReadState, side: Side, cy: number) =>
      paddlePose(s, side, { cy }),
    setPaddleVy: (s: ReadState, side: Side, drivenVy: number) =>
      paddlePose(s, side, { drivenVy }),
    setPaddleDriven: (s: ReadState, side: Side, driven: boolean) =>
      paddlePose(s, side, { driven }),
    setBallPosition: (s: ReadState, x: number, y: number) =>
      ballPose(s, { x, y }),
    setBallVelocity: (s: ReadState, vx: number, vy: number) =>
      ballPose(s, { vx, vy }),
    setBallSpin: (s: ReadState, spin: number) => ballPose(s, { spin }),
    setBallHeld: (s: ReadState, held: boolean) => ballPose(s, { held }),
    setBallHoldTimer: (s: ReadState, holdTimer: number) =>
      ballPose(s, { holdTimer }),
    setBallServeSign: (s: ReadState, serveSign: 1 | -1) =>
      ballPose(s, { serveSign }),
    drawBallServeSign: (s: ReadState) => ballPose(s, { serveSign: drawSign() }),
    setAiTracking: (s: ReadState, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: ReadState, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: ReadState, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: ReadState, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: ReadState,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    snapshot: (s: ReadState) => {
      const { menuGestures: _menuGestures, ...state } = s;
      return {
        ...structuredClone(state),
        version: C.CAROM_DEBUG_VERSION,
        ball: s.ball
          ? {
              ...structuredClone(s.ball),
              speed: Math.hypot(s.ball.vx, s.ball.vy),
            }
          : null,
      };
    },
    menuItemRect,
  };
}
