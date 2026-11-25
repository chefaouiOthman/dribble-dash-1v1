// config.js - single source of truth for every tuning value.

// ----- Lanes and ground -----
export const LANE_POSITIONS = [-3, 0, 3];
export const LANE_COUNT = 3;
export const GROUND_Y = 0;
export const PLAYER_Z = 0;

// ----- Player -----
export const PLAYER_WIDTH = 0.8;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_DEPTH = 0.8;
export const GRAVITY = -30;
export const JUMP_FORCE = 11;
export const LANE_CHANGE_SPEED = 10;

// ----- Defender -----
export const DEFENDER_WIDTH = 0.9;
export const DEFENDER_HEIGHT = 2.2;
export const DEFENDER_DEPTH = 0.9;
export const BLOCK_WIDTH = 1.7;
export const TACKLE_HEIGHT = 0.6;
export const TACKLE_DEPTH = 2.2;
export const SPAWN_DISTANCE = 55;
export const TRACK_START_DISTANCE = 40;
export const FEINT_DISTANCE = 30;
export const ATTACK_DISTANCE = 20;
export const TRACK_LANE_SPEED = 6;
export const BASE_DEFENDER_SPEED = 14;
export const SPEED_PER_LEVEL = 1.4;
export const MAX_DEFENDER_SPEED = 32;
export const SLIDE_SPEED_FACTOR = 1.8;
export const BLOCK_SPEED_FACTOR = 0.55;
export const BASE_REACTION_TIME = 0.9;
export const REACTION_DECREASE_PER_LEVEL = 0.06;
export const MIN_REACTION_TIME = 0.25;
export const BASE_WINDUP_TIME = 0.34;
export const MIN_WINDUP_TIME = 0.14;

// ----- World and camera -----
export const FIELD_LENGTH = 200;
export const FIELD_WIDTH = 24;
export const WORLD_SCROLL_SPEED = 12;
export const MENU_SCROLL_SPEED = 4;
export const SCROLL_SPEED_PER_LEVEL = 0.8;
export const MAX_SCROLL_SPEED = 22;
export const CAMERA_POSITION = { x: 0, y: 4.5, z: 8 };
export const CAMERA_LOOK_AT = { x: 0, y: 1, z: -8 };
export const BASE_FOV = 60;

// ----- Match -----
export const MATCH_SECONDS = 180;       // real seconds for 90 minutes
export const MATCH_MINUTES = 90;
export const MAX_CONCEDED = 3;
export const DUELS_PER_ATTACK = 2;

// ----- Goal (real dimensions, 1 unit = 1 meter) -----
export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
export const GOAL_DEPTH = 2.0;
export const GOAL_DISTANCE = 22;        // goal line z when shooting = -GOAL_DISTANCE
export const GOAL_SPAWN_Z = -140;

// ----- Ball and goal frame (shared by rendering and collision) -----
// The visible frame and the scoring opening use the SAME radii: one single
// goal-boundary function (goalMath.js) is used by the reticle and by planShot.
export const BALL_RADIUS = 0.22;
export const BALL_GRAVITY = 9.8;
export const POST_RADIUS = 0.06;
export const CROSSBAR_RADIUS = 0.06;

// ----- Shooting and keeper -----
export const SHOT_SPEED = 30;
export const KICK_DELAY = 0.22;
export const AIM_TIME_LIMIT = 4.5;
export const RETICLE_X_RANGE = 4.4;
export const RETICLE_SIZE = 1.0;            // constant, never shrinks with the level
export const RETICLE_SPEED_BASE = 1.9;      // rad/s of the aiming pattern
export const RETICLE_SPEED_PER_LEVEL = 0.11;
export const RETICLE_SPEED_MAX = 3.4;
export const RETICLE_CENTER_Y = 1.22;
export const RETICLE_Y_AMPLITUDE = 0.95;    // keeps the reticle above the grass

export const KEEPER_BASE_Y = 1.0;
export const KEEPER_Z_OFFSET = 0.9;
export const KEEPER_REACTION_BASE = 0.34;   // seconds before the keeper reacts
export const KEEPER_REACTION_PER_LEVEL = 0.015;
export const KEEPER_REACTION_MIN = 0.20;
export const KEEPER_DIVE_SPEED = 3.2;       // lateral metres per second
export const KEEPER_DIVE_SPEED_PER_LEVEL = 0.20;
export const KEEPER_DIVE_SPEED_MAX = 5.0;
export const KEEPER_VERTICAL_SPEED = 2.0;
export const KEEPER_SAVE_RADIUS = 0.50;
export const KEEPER_CENTRAL_RADIUS = 0.65;  // inside this radius: no lateral dive
export const KEEPER_READ_ERROR_MAX = 0.35;  // low level: small, never side-swapping
export const KEEPER_READ_ERROR_PER_LEVEL = 0.03;
export const KEEPER_DIVE_MARGIN = 0.25;
export const KEEPER_MAX_X = GOAL_WIDTH / 2 - 0.3;
export const KEEPER_MAX_Y = GOAL_HEIGHT - 0.25;
export const KEEPER_MIN_Y = 0.35;

// ----- Environment (pre-match selection, fixed for the whole match) -----
export const ENVIRONMENT_COUNT = 3;
export const DEFAULT_ENVIRONMENT = 0;

// ----- Animation / interaction feel -----
export const ANIMATION_CROSSFADE = 0.18;
export const SIDE_STEP_TIME = 0.55;
export const PLAYER_DRIBBLE_FOLLOW = 14;
export const PLAYER_FALL_DISPLACEMENT = 0.65;
export const DEFENDER_CONTACT_TIME = 0.45;
export const BALL_SAVE_DEFLECTION = 0.55;
export const NET_IMPACT_RADIUS = 2.6;

// ----- Scoring and game feel -----
export const SCORE_PER_DUEL = 100;
export const BONUS_CLOSE_CALL = 50;
export const BONUS_JUMP = 30;
export const GOAL_POINTS = 500;
export const COMBO_STEP = 0.25;
export const MAX_COMBO_STEPS = 8;
export const CLOSE_CALL_GAP = 2.2;
export const SLOW_MO_DURATION = 0.5;
export const SLOW_MO_SCALE = 0.35;
export const GAME_OVER_DELAY = 1.6;

// ----- Game -----
export const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover'
};
export const STORAGE_KEY_BEST_SCORE = 'dribbleDash1v1BestScore';