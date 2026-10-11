import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { ReadState } from "./game";
import { menuItems, menuItemRect } from "./world";
const cyan = "#6de5de",
  coral = "#ff8c78",
  gold = "#f5cb75",
  white = "#edf4ee",
  muted = "#80959f";
function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size = 16,
  color = white,
  align: CanvasTextAlign = "center",
) {
  ctx.fillStyle = color;
  ctx.font = `${size >= 40 ? "bold " : ""}${size}px ${size >= 40 ? "Arial, sans-serif" : "monospace"}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 6));
  ctx.fill();
  ctx.shadowBlur = 0;
}
export function render(s: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    40,
    C.FIELD_CX,
    C.FIELD_CY,
    740,
  );
  gradient.addColorStop(0, "#16272f");
  gradient.addColorStop(1, "#0b151c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.strokeStyle = "#20333c";
  ctx.lineWidth = 1;
  for (let x = 120; x < C.FIELD_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.FIELD_H);
    ctx.stroke();
  }
  for (let y = 40; y < C.FIELD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.FIELD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#38505b";
  ctx.setLineDash([7, 14]);
  ctx.beginPath();
  ctx.moveTo(C.NET_X, 26);
  ctx.lineTo(C.NET_X, C.FIELD_H - 26);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#435a63";
  ctx.beginPath();
  ctx.moveTo(32, 1);
  ctx.lineTo(C.FIELD_W - 32, 1);
  ctx.moveTo(32, C.FIELD_H - 1);
  ctx.lineTo(C.FIELD_W - 32, C.FIELD_H - 1);
  ctx.stroke();
  ctx.globalAlpha = s.screen === "title" || s.screen === "howto" ? 0.3 : 1;
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    cyan,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    coral,
  );
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    bar(ctx, -C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, gold);
    ctx.restore();
  }
  if (s.ball) {
    const trail = s.ball.trail;
    for (let i = 1; i < trail.length; i++) {
      ctx.globalAlpha = (i / trail.length) * 0.48;
      ctx.strokeStyle = cyan;
      ctx.lineWidth = (C.BALL_R * 2 * i) / trail.length;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = s.screen === "title" || s.screen === "howto" ? 0.3 : 1;
    ctx.fillStyle = white;
    ctx.shadowColor = white;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  if (s.screen !== "title" && s.screen !== "howto") {
    text(ctx, "PLAYER 01", 420, 30, 12, cyan);
    text(
      ctx,
      s.mode === "solo" ? "THE MACHINE" : "PLAYER 02",
      860,
      30,
      12,
      coral,
    );
    text(ctx, String(s.score.p1), 420, 77, 58, cyan);
    text(ctx, String(s.score.p2), 860, 77, 58, coral);
    text(
      ctx,
      s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL",
      C.FIELD_CX,
      31,
      12,
      muted,
    );
    text(ctx, "FIRST TO 11 · WIN BY 2", C.FIELD_CX, 58, 11, muted);
    text(ctx, "W / S", 100, 685, 12, cyan);
    text(
      ctx,
      s.mode === "solo" ? "W / S OR ↑ / ↓" : "↑ / ↓",
      1180,
      685,
      12,
      coral,
    );
    if (s.screen === "countdown") {
      text(ctx, "READY", C.FIELD_CX, 285, 24, white);
      text(
        ctx,
        "SERVE TO " +
          (s.receiver === "left"
            ? "PLAYER 01"
            : s.mode === "solo"
              ? "THE MACHINE"
              : "PLAYER 02"),
        C.FIELD_CX,
        320,
        11,
        muted,
      );
    }
  }
  const items = menuItems(s);
  if (items.length) {
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#081218c9";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    }
    if (s.screen === "title") {
      text(ctx, "A GAME OF ANGLES", C.FIELD_CX, 130, 14, gold);
      text(ctx, C.TITLE_TEXT, C.FIELD_CX, 230, 112, white);
      text(
        ctx,
        "PUT A DIFFERENT SPIN ON THE DUEL.",
        C.FIELD_CX,
        310,
        14,
        muted,
      );
      text(ctx, "01 / MOVE", 235, 575, 12, cyan);
      text(ctx, "02 / CURVE", C.FIELD_CX, 575, 12, white);
      text(ctx, "03 / BANK", 1045, 575, 12, gold);
      text(ctx, "Slide into the shot.", 235, 607, 14, muted);
      text(ctx, "Your motion bends the ball.", C.FIELD_CX, 607, 14, muted);
      text(ctx, "Find the unexpected angle.", 1045, 607, 14, muted);
    } else if (s.screen === "howto") {
      text(ctx, "THE ART OF THE CAROM", C.FIELD_CX, 125, 48);
      const rows = [
        [
          "01",
          "TAKE YOUR SIDE",
          "Solo: W / S or ↑ / ↓. Versus: W / S left, ↑ / ↓ right.",
        ],
        [
          "02",
          "MOVE THROUGH THE HIT",
          "Strike while moving to add spin. Down bends clockwise; up reverses it.",
        ],
        [
          "03",
          "PLAY THE ANGLES",
          "The gold bars sway and rotate. Bank a shot past your opponent.",
        ],
        [
          "04",
          "FINISH THE DUEL",
          "First to 11, with a two-point lead. P / Esc pauses. M toggles sound.",
        ],
      ];
      rows.forEach(([num, title, body], i) => {
        const y = 230 + i * 82;
        text(ctx, num, 185, y, 22, gold);
        text(ctx, title, 235, y, 18, white, "left");
        text(ctx, body, 235, y + 29, 14, muted, "left");
      });
    } else if (s.screen === "paused") {
      text(ctx, "TIME OUT", C.FIELD_CX, 235, 64);
      text(ctx, "THE NEXT ANGLE CAN WAIT.", C.FIELD_CX, 305, 14, muted);
    } else {
      text(
        ctx,
        s.winner === "left"
          ? "PLAYER 01 WINS"
          : s.mode === "solo"
            ? "THE MACHINE WINS"
            : "PLAYER 02 WINS",
        C.FIELD_CX,
        220,
        52,
        s.winner === "left" ? cyan : coral,
      );
      text(ctx, `${s.score.p1}  :  ${s.score.p2}`, C.FIELD_CX, 302, 32, white);
    }
    items.forEach((item, i) => {
      const r = menuItemRect(s, i);
      if (!r) return;
      const selected = i === s.menuIndex;
      ctx.fillStyle = selected ? cyan : "#152630";
      ctx.strokeStyle = selected ? cyan : "#31444d";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 5);
      ctx.fill();
      ctx.stroke();
      text(
        ctx,
        item,
        C.FIELD_CX,
        r.y + r.h / 2,
        16,
        selected ? "#10232a" : white,
      );
      if (selected) text(ctx, "›", r.x + 25, r.y + r.h / 2, 24, "#10232a");
    });
    text(
      ctx,
      "↑ ↓ / W S  SELECT     ENTER  CONFIRM",
      C.FIELD_CX,
      680,
      11,
      muted,
    );
  } else text(ctx, "P / ESC  PAUSE", C.FIELD_CX, 689, 11, muted);
  text(
    ctx,
    s.muted ? "M / SOUND OFF" : "M / SOUND ON",
    C.FIELD_W - 34,
    22,
    10,
    muted,
    "right",
  );
  if (s.screen === "title") text(ctx, "CAROM / 01", 34, 22, 10, muted, "left");
  ctx.restore();
}
