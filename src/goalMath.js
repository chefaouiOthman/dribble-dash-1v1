// goalMath.js - pure geometry and keeper-decision helpers.
//
// Design rule: the visible goal frame and the scoring opening are described by
// the SAME constants and the SAME function. The reticle highlight and the shot
// resolution both call classifyGoalPoint(), so a shot can never be "visually in"
// while being counted out (or the other way around).
//
// The ball is a sphere of BALL_RADIUS: a centre is only a clean goal when the
// whole sphere fits between the inner faces of the posts and under the bar.
// A centre that overlaps a post/crossbar is reported as POST/BAR, never GOAL.
import {
  BALL_RADIUS, BALL_GRAVITY, GOAL_WIDTH, GOAL_HEIGHT, POST_RADIUS, CROSSBAR_RADIUS,
  KEEPER_BASE_Y, KEEPER_REACTION_BASE, KEEPER_REACTION_PER_LEVEL, KEEPER_REACTION_MIN,
  KEEPER_DIVE_SPEED, KEEPER_DIVE_SPEED_PER_LEVEL, KEEPER_DIVE_SPEED_MAX,
  KEEPER_VERTICAL_SPEED, KEEPER_SAVE_RADIUS, KEEPER_CENTRAL_RADIUS,
  KEEPER_READ_ERROR_MAX, KEEPER_READ_ERROR_PER_LEVEL,
  KEEPER_MAX_X, KEEPER_MAX_Y, KEEPER_MIN_Y
} from './config.js';

export const SHOT_RESULT = {
  GOAL: 'GOAL',
  POST: 'POST',
  BAR: 'BAR',
  MISS: 'MISS',
  SAVE: 'SAVE'
};

const HALF_WIDTH = GOAL_WIDTH / 2;
const INNER_HALF = HALF_WIDTH - POST_RADIUS;
const INNER_TOP = GOAL_HEIGHT - CROSSBAR_RADIUS;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Returns GOAL, POST, BAR or MISS for a ball centre (x, y) on the goal plane.
// radius lets callers reason about the actual ball size (defaults to the game ball).
export function classifyGoalPoint(x, y, radius = BALL_RADIUS) {
  const absX = Math.abs(x);

  // Post: the sphere overlaps the vertical post cylinder.
  const postHit = Math.abs(absX - HALF_WIDTH) <= POST_RADIUS + radius
    && y >= -radius && y <= GOAL_HEIGHT + radius;
  if (postHit) return SHOT_RESULT.POST;

  // Crossbar: the sphere overlaps the horizontal bar cylinder.
  const barHit = Math.abs(y - GOAL_HEIGHT) <= CROSSBAR_RADIUS + radius
    && absX <= HALF_WIDTH + radius;
  if (barHit) return SHOT_RESULT.BAR;

  // Clean goal: the whole sphere is inside the inner opening.
  const inside = absX + radius <= INNER_HALF
    && y - radius >= 0
    && y + radius <= INNER_TOP;
  return inside ? SHOT_RESULT.GOAL : SHOT_RESULT.MISS;
}

// The valid aiming window for the reticle centre (same maths as above).
export function isGoalWindow(x, y) {
  return classifyGoalPoint(x, y) === SHOT_RESULT.GOAL;
}

// Clamp a raw aim point so the ball centre stays inside the clean opening.
export function clampAimPoint(x, y) {
  const maxX = Math.max(0.05, INNER_HALF - BALL_RADIUS);
  const minY = Math.max(BALL_RADIUS, 0.05);
  const maxY = Math.max(minY, INNER_TOP - BALL_RADIUS);
  return { x: clamp(x, -maxX, maxX), y: clamp(y, minY, maxY) };
}

// Ball position/time when it crosses a plane z = planeZ.
// from/target: {x,y,z}; flightTime is the time from `from` to `target`.
// Writes {x, y, time} into `out` (no allocation) and returns it.
export function predictBallAtZ(from, target, planeZ, flightTime, out) {
  const dz = target.z - from.z;
  const fraction = Math.abs(dz) < 1e-6 ? 1 : clamp((planeZ - from.z) / dz, 0, 1);
  const time = flightTime * fraction;
  const velocityY = (target.y - from.y + 0.5 * BALL_GRAVITY * flightTime * flightTime) / flightTime;
  out.x = from.x + (target.x - from.x) * fraction;
  out.y = from.y + velocityY * time - 0.5 * BALL_GRAVITY * time * time;
  out.time = time;
  return out;
}

// Deterministic keeper decision based on the real predicted crossing point.
// errorFactor (0..1) adds a small read error on the SAME side as the shot:
// the keeper may under/over-commit, but can never dive against the trajectory.
export function planKeeperSave(options) {
  const {
    fromX, fromY = KEEPER_BASE_Y, crossingX, crossingY, time, level,
    errorFactor = 0
  } = options;

  const reaction = Math.max(
    KEEPER_REACTION_MIN,
    KEEPER_REACTION_BASE - (level - 1) * KEEPER_REACTION_PER_LEVEL
  );
  const speed = Math.min(
    KEEPER_DIVE_SPEED_MAX,
    KEEPER_DIVE_SPEED + (level - 1) * KEEPER_DIVE_SPEED_PER_LEVEL
  );
  const available = Math.max(0.05, time - reaction);
  const maxLateral = speed * available;
  const maxVertical = KEEPER_VERTICAL_SPEED * available;

  const readErrorMax = Math.max(0, KEEPER_READ_ERROR_MAX - (level - 1) * KEEPER_READ_ERROR_PER_LEVEL);
  const offset = crossingX - fromX;
  const readError = Math.sign(offset) * readErrorMax * clamp(errorFactor, 0, 1);
  const desiredX = clamp(crossingX + readError, -KEEPER_MAX_X, KEEPER_MAX_X);
  const desiredY = clamp(crossingY, KEEPER_MIN_Y, KEEPER_MAX_Y);

  const central = Math.abs(offset) <= KEEPER_CENTRAL_RADIUS;
  // No lateral movement on a central shot: the keeper uses a catch or a body block.
  const endX = central ? fromX : fromX + clamp(desiredX - fromX, -maxLateral, maxLateral);
  const endY = fromY + clamp(desiredY - fromY, -maxVertical, maxVertical);

  const distance = Math.hypot(crossingX - endX, crossingY - endY);
  const save = distance <= KEEPER_SAVE_RADIUS;
  let mode = 'DIVE';
  if (central) mode = crossingY >= 1.05 ? 'CATCH' : 'BLOCK';
  else if (save && crossingY < 0.7) mode = 'BLOCK';

  return {
    reaction,
    duration: available,
    endX,
    endY,
    save,
    central,
    mode,
    direction: Math.abs(endX - fromX) < 0.05 ? 0 : Math.sign(endX - fromX),
    readError,
    crossingX,
    crossingY
  };
}
