// Unit tests for the shared goal boundary and the deterministic keeper decision.
// Run with: node tools/test-goalmath.mjs
import {
  classifyGoalPoint, clampAimPoint, predictBallAtZ, planKeeperSave, SHOT_RESULT
} from '../src/goalMath.js';
import { GOAL_WIDTH, GOAL_HEIGHT, BALL_RADIUS, POST_RADIUS } from '../src/config.js';

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const half = GOAL_WIDTH / 2;

// --- Boundary classification -------------------------------------------------
check('centre is a goal', classifyGoalPoint(0, 1), SHOT_RESULT.GOAL);
check('inside near post is a goal', classifyGoalPoint(half - 0.8, 1), SHOT_RESULT.GOAL);
check('post hit', classifyGoalPoint(half, 1), SHOT_RESULT.POST);
check('post outer edge hit', classifyGoalPoint(half + POST_RADIUS + BALL_RADIUS - 0.001, 1), SHOT_RESULT.POST);
check('crossbar hit', classifyGoalPoint(0, GOAL_HEIGHT), SHOT_RESULT.BAR);
check('wide miss', classifyGoalPoint(half + 1.2, 1), SHOT_RESULT.MISS);
check('over the bar', classifyGoalPoint(0, GOAL_HEIGHT + 1), SHOT_RESULT.MISS);
check('on the ground is a miss (ball centre at 0)', classifyGoalPoint(0, 0), SHOT_RESULT.MISS);
check('ball touching ground inside', classifyGoalPoint(0, BALL_RADIUS + 0.001), SHOT_RESULT.GOAL);
check('ball overlapping the post is a post', classifyGoalPoint(half - 0.1, 1), SHOT_RESULT.POST);
check('ball clear of the post is a goal', classifyGoalPoint(half - 0.4, 1), SHOT_RESULT.GOAL);

const aim = clampAimPoint(99, 99);
check('clamped aim stays inside', classifyGoalPoint(aim.x, aim.y), SHOT_RESULT.GOAL);
check('clamped aim is reachable', Math.abs(aim.x) <= half - BALL_RADIUS, true);

// --- Keeper decision ---------------------------------------------------------
const central = planKeeperSave({
  fromX: 0, crossingX: 0.2, crossingY: 1.4, time: 0.7, level: 1, errorFactor: 1
});
check('central shot is central', central.central, true);
check('central shot does not move laterally', central.endX, 0);
check('central high shot is a catch', central.mode, 'CATCH');
check('central low shot is a body block', planKeeperSave({
  fromX: 0, crossingX: 0, crossingY: 0.5, time: 0.7, level: 1
}).mode, 'BLOCK');

const right = planKeeperSave({ fromX: 0, crossingX: 1.0, crossingY: 1.2, time: 0.7, level: 1, errorFactor: 1 });
check('right shot dives right', Math.sign(right.direction), 1);
check('right shot end is to the right', right.endX > 0, true);
check('right shot can be saved', right.save, true);

const left = planKeeperSave({ fromX: 0, crossingX: -1.0, crossingY: 1.2, time: 0.7, level: 1, errorFactor: 1 });
check('left shot dives left', Math.sign(left.direction), -1);
check('left shot end is to the left', left.endX < 0, true);
check('left shot can be saved', left.save, true);

// A huge read error must never flip the dive side.
for (const errorFactor of [0, 0.5, 1]) {
  for (const crossingX of [-3, -1, -0.8, 0.8, 1, 3]) {
    const plan = planKeeperSave({
      fromX: 0, crossingX, crossingY: 1.2, time: 0.8, level: 1, errorFactor
    });
    if (Math.sign(plan.endX) !== Math.sign(crossingX)) {
      failures += 1;
      console.log(`FAIL dive side flipped: crossingX=${crossingX} error=${errorFactor} endX=${plan.endX}`);
    }
  }
}

// Unreachable shot: keeper dives but cannot get there -> no save.
const far = planKeeperSave({ fromX: 0, crossingX: 3.3, crossingY: 1.2, time: 0.25, level: 1 });
check('unreachable shot is not saved', far.save, false);
check('keeper stays inside the goal', Math.abs(far.endX) <= GOAL_WIDTH / 2, true);
check('keeper stays under the bar', far.endY <= GOAL_HEIGHT, true);

// Level scaling: a better keeper reacts faster and moves further in the same time.
const low = planKeeperSave({ fromX: 0, crossingX: 2.5, crossingY: 1.2, time: 0.7, level: 1 });
const high = planKeeperSave({ fromX: 0, crossingX: 2.5, crossingY: 1.2, time: 0.7, level: 8 });
check('higher level reacts faster', high.reaction < low.reaction, true);
check('higher level reaches further', high.endX > low.endX, true);

// --- Trajectory prediction ---------------------------------------------------
const from = { x: 0.1, y: 0.24, z: -0.58 };
const target = { x: 1, y: 1.5, z: -22 };
const predicted = predictBallAtZ(from, target, -21.1, 0.7, { x: 0, y: 0, time: 0 });
check('prediction hits the keeper plane', Math.abs(predicted.x - 0.96) < 0.02, true);
check('prediction time is shorter than flight time', predicted.time < 0.7, true);
check('prediction is on the shot side', Math.sign(predicted.x), 1);

console.log(failures === 0 ? 'OK: goalMath tests passed.' : failures + ' failure(s).');
process.exitCode = failures === 0 ? 0 : 1;
