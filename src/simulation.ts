import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, ReadState, PaddleState, Side } from "./game";
import {
  clamp,
  menuItems,
  menuItemRect,
  obstacle,
  park,
  startMatch,
  toTitle,
} from "./world";
import { fly } from "./physics";

function confirm(s: ReadState): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 1 ? "versus" : "solo");
    }
    case "howto":
      return toTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : toTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : toTitle(s);
    default:
      return { ...s };
  }
}
function input(state: ReadState, api: UpdateApi): CaromState {
  const edge = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  api.input.pointerContacts();
  let s: CaromState = {
    ...state,
    muted: edge.mute ? !state.muted : state.muted,
  };
  api.audio.setMuted(s.muted);
  if (
    (state.screen === "playing" || state.screen === "countdown") &&
    edge.pause
  )
    return {
      ...s,
      screen: "paused",
      resumeScreen: state.screen,
      menuIndex: 0,
      menuGestures: {},
    };
  if (state.screen === "paused" && (edge.pause || edge.back))
    return { ...s, screen: s.resumeScreen, menuGestures: {} };
  if ((state.screen === "howto" || state.screen === "matchover") && edge.back)
    return toTitle(s);
  const items = menuItems(state);
  if (items.length === 0) return s;
  let keyboardConfirm = false;
  if (edge["p1-up"] || edge["p2-up"])
    s = { ...s, menuIndex: (s.menuIndex + items.length - 1) % items.length };
  else if (edge["p1-down"] || edge["p2-down"])
    s = { ...s, menuIndex: (s.menuIndex + 1) % items.length };
  else if (edge.confirm) {
    s = confirm(s);
    keyboardConfirm = true;
  }
  const gestures = { ...state.menuGestures };
  for (const sample of samples) {
    if (sample.button && sample.button !== "primary") continue;
    const index = items.findIndex((_, i) => {
      const r = menuItemRect(state, i);
      return (
        r &&
        sample.x >= r.x &&
        sample.x <= r.x + r.w &&
        sample.y >= r.y &&
        sample.y <= r.y + r.h
      );
    });
    if (index >= 0 && !keyboardConfirm) s = { ...s, menuIndex: index };
    if (sample.type === "down")
      gestures[sample.id] = { item: index, screen: state.screen };
    if (sample.type === "up") {
      const origin = gestures[sample.id];
      delete gestures[sample.id];
      if (
        !keyboardConfirm &&
        index >= 0 &&
        origin?.item === index &&
        origin.screen === state.screen
      ) {
        s = confirm({ ...s, menuIndex: index });
        keyboardConfirm = true;
      }
    }
  }
  return { ...s, menuGestures: s.screen === state.screen ? gestures : {} };
}
function move(
  s: ReadState,
  side: Side,
  api: UpdateApi,
  dt: number,
): PaddleState {
  const p = s.paddles[side];
  let vy = p.drivenVy;
  if (!p.driven) {
    if (side === "right" && s.mode === "solo") {
      let target = C.AI_HOME_Y,
        deadzone = C.AI_HOME_DEADZONE;
      if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
        target = s.ball.y - s.ball.vy * C.AI_REACT;
        deadzone = C.AI_DEADZONE;
      }
      const diff = target - p.cy;
      vy =
        !s.ai.movement || Math.abs(diff) <= deadzone || dt === 0
          ? 0
          : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    } else {
      const up =
        api.input.value(side === "left" ? "p1-up" : "p2-up") > 0 ||
        (s.mode === "solo" && api.input.value("p2-up") > 0);
      const down =
        api.input.value(side === "left" ? "p1-down" : "p2-down") > 0 ||
        (s.mode === "solo" && api.input.value("p2-down") > 0);
      vy = (Number(down) - Number(up)) * C.PADDLE_SPEED;
    }
  }
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (raw !== cy && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}
export function update(
  state: ReadState,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s = { ...input(state, api), simTime: state.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = {
    ...s,
    paddles: {
      left: move(s, "left", api, dt),
      right: move(s, "right", api, dt),
    },
  };
  const events = new Set<C.CueName>();
  if (s.screen === "countdown" && s.ball) {
    const holdTimer = Math.max(0, s.ball.holdTimer - dt);
    s = { ...s, ball: { ...s.ball, holdTimer } };
    if (holdTimer <= 0 && s.ball) {
      s = {
        ...s,
        screen: "playing",
        ball: {
          ...s.ball,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: s.ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        },
      };
    }
  } else if (s.ball && !s.ball.held) {
    s = { ...s, ball: fly(s, dt, events) };
  }
  if (s.ball)
    s = {
      ...s,
      ball: {
        ...s.ball,
        trail: [
          ...s.ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
          { x: s.ball.x, y: s.ball.y, t: s.simTime },
        ],
      },
    };
  if (
    s.ball &&
    !s.ball.held &&
    (s.ball.x - C.BALL_R > C.FIELD_W || s.ball.x + C.BALL_R < 0)
  ) {
    const scorer = s.ball.x > C.FIELD_W ? "left" : "right";
    const score = {
      p1: s.score.p1 + Number(scorer === "left"),
      p2: s.score.p2 + Number(scorer === "right"),
    };
    events.add(C.CUES.score);
    if (
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD)
    )
      s = { ...s, score, winner: scorer, screen: "matchover", menuIndex: 0 };
    else
      s = {
        ...s,
        score,
        receiver: scorer === "left" ? "right" : "left",
        screen: "countdown",
        ball: park(),
      };
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  events.forEach((cue) => api.audio.play(cue));
  return { ...s, muted: api.audio.muted() };
}
