import * as C from "./constants";
import type { BallState, ReadState, Side } from "./game";
import { clamp } from "./world";

type Flight = { -readonly [K in keyof BallState]: BallState[K] };
/** A frame owns this scratch copy; no reference into the incoming state is changed. */
export function fly(
  s: ReadState,
  dt: number,
  events: Set<C.CueName>,
): BallState | null {
  if (!s.ball) return null;
  const b: Flight = { ...s.ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let step = 0; step < n; step++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx;
      b.vx = vx * cos - b.vy * sin;
      b.vy = vx * sin + b.vy * cos;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) paddle(b, s, side, events);
    for (const o of s.obstacles) {
      const cos = Math.cos(o.theta),
        sin = Math.sin(o.theta),
        dx = b.x - o.cx,
        dy = b.y - o.cy;
      const lx = dx * cos + dy * sin,
        ly = -dx * sin + dy * cos;
      const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
        qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
      const dist = Math.hypot(lx - qx, ly - qy);
      if (dist >= C.BALL_R) continue;
      let nx: number, ny: number, push: number;
      if (dist > 0) {
        nx = (lx - qx) / dist;
        ny = (ly - qy) / dist;
        push = C.BALL_R - dist;
      } else {
        const depths = [
          lx + C.OBSTACLE_HW,
          C.OBSTACLE_HW - lx,
          ly + C.OBSTACLE_HH,
          C.OBSTACLE_HH - ly,
        ];
        const face = depths.indexOf(Math.min(...depths));
        nx = face === 0 ? -1 : face === 1 ? 1 : 0;
        ny = face === 2 ? -1 : face === 3 ? 1 : 0;
        push = depths[face] + C.BALL_R;
      }
      const wx = nx * cos - ny * sin,
        wy = nx * sin + ny * cos,
        dot = b.vx * wx + b.vy * wy;
      if (dot < 0) {
        b.vx -= 2 * dot * wx;
        b.vy -= 2 * dot * wy;
        events.add(C.CUES.obstacleBounce);
      }
      b.x += wx * push;
      b.y += wy * push;
    }
  }
  return b;
}
function paddle(b: Flight, s: ReadState, side: Side, events: Set<C.CueName>) {
  const p = s.paddles[side],
    x0 = side === "left" ? C.P1_X0 : C.P2_X0,
    x1 = side === "left" ? C.P1_X1 : C.P2_X1,
    y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  if (!(
    b.x > x0 - C.BALL_R &&
    b.x < x1 + C.BALL_R &&
    b.y > y0 - C.BALL_R &&
    b.y < y1 + C.BALL_R
  ))
    return;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const angle =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    events.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
  }
}
