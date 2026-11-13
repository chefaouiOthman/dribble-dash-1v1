// config.js - shared constants. Edited only through a pull request.

// ----- Lanes and ground -----
export const LANE_POSITIONS = [-3, 0, 3];   // x of left, center, right lanes
export const LANE_COUNT = 3;
export const GROUND_Y = 0;
export const PLAYER_Z = 0;                  // fixed z of the player

// ----- Player -----
export const PLAYER_WIDTH = 1;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_DEPTH = 1;
export const GRAVITY = -30;
export const JUMP_FORCE = 11;               // jump apex is about 2 units
export const LANE_CHANGE_SPEED = 10;        // lateral smoothing factor

// ----- Defender -----
export const DEFENDER_WIDTH = 1;
export const DEFENDER_HEIGHT = 2.2;         // standing: jump alone cannot pass
export const DEFENDER_DEPTH = 1;
export const TACKLE_HEIGHT = 0.6;           // lying during the tackle: jump passes
export const TACKLE_DEPTH = 2.2;
export const SPAWN_DISTANCE = 70;           // spawn at z = -SPAWN_DISTANCE
export const TRACK_START_DISTANCE = 45;     // starts following the player lane
export const TACKLE_DISTANCE = 18;          // starts the slide tackle
export const TRACK_LANE_SPEED = 6;          // lateral speed (units per second)
export const BASE_DEFENDER_SPEED = 10;      // units per second at level 1
export const SPEED_PER_LEVEL = 1.2;
export const MAX_DEFENDER_SPEED = 28;
export const TACKLE_SPEED_FACTOR = 1.8;
export const BASE_REACTION_TIME = 0.8;      // seconds, level 1
export const REACTION_DECREASE_PER_LEVEL = 0.05;
export const MIN_REACTION_TIME = 0.25;

// ----- World -----
export const FIELD_LENGTH = 200;
export const FIELD_WIDTH = 24;
export const WORLD_SCROLL_SPEED = 14;       // visual scrolling of the field
export const CAMERA_POSITION = { x: 0, y: 4.5, z: 8 };
export const CAMERA_LOOK_AT = { x: 0, y: 1, z: -8 };

// ----- Game -----
export const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  GAME_OVER: 'gameover'
};
export const STORAGE_KEY_BEST_SCORE = 'dribbleDash1v1BestScore';