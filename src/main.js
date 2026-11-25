import * as THREE from 'three';
import {
  createWorld, updateWorld, playWinEffect, playGoalEffect, playHitEffect,
  setTheme, getThemeName, getBloomTarget, getEnvironmentNames
} from './world.js';
import { createPostProcessing, updatePostProcessing } from './postfx.js';
import {
  createPlayer, updatePlayer, getPlayerBox, getPlayerLane, getPlayerKickOrigin,
  setPlayerMode, resetPlayer, knockDownPlayer, consumePlayerEvents
} from './player.js';
import {
  createBall, updateBall, launchBall, releaseBall, attachBall, consumeBallArrival
} from './ball.js';
import {
  createGoal, showGoal, hideGoal, updateGoal, updateReticle, setReticleVisible,
  planShot, startKeeperDive, triggerNetImpact
} from './goal.js';
import {
  createDefender, updateDefender, checkCollision, isDefenderOffscreen,
  nextDefender, resetDefender, consumeDefenderEvents, markDefenderContact,
  getDefenderContactPoint
} from './defender.js';
import {
  createUI, updateHUD, showPopup, showBanner, flashScreen, setAimHint,
  hideOverlay, showPause, showGameOver, setMuteIndicator, setEnvironment,
  setLoadingProgress
} from './ui.js';
import { playSound, toggleMute, isMuted } from './audio.js';
import { loadCharacterAssets } from './assets.js';
import { attachRig, isRigReady } from './actor.js';
import {
  GAME_STATE, PLAYER_Z, PLAYER_WIDTH, DEFENDER_WIDTH, TACKLE_HEIGHT,
  WORLD_SCROLL_SPEED, MENU_SCROLL_SPEED, SCROLL_SPEED_PER_LEVEL, MAX_SCROLL_SPEED,
  CAMERA_POSITION, CAMERA_LOOK_AT, BASE_FOV,
  SCORE_PER_DUEL, BONUS_CLOSE_CALL, BONUS_JUMP, GOAL_POINTS, COMBO_STEP, MAX_COMBO_STEPS,
  CLOSE_CALL_GAP, SLOW_MO_DURATION, SLOW_MO_SCALE, GAME_OVER_DELAY,
  MATCH_SECONDS, MATCH_MINUTES, MAX_CONCEDED, DUELS_PER_ATTACK,
  KICK_DELAY, AIM_TIME_LIMIT, GOAL_DISTANCE, DEFAULT_ENVIRONMENT
} from './config.js';

const DEV_STATS = new URLSearchParams(window.location.search).get('stats') === '1';
const DEV_VIEWER = new URLSearchParams(window.location.search).get('dev') === 'viewer';
const { scene, camera, renderer } = createWorld();
const fx = createPostProcessing(renderer, scene, camera);
const player = createPlayer(scene);
const ball = createBall(scene);
const defender = createDefender(scene);
const goal = createGoal(scene);
defender.group.visible = false;

// Dev-only handles for profiling and clip inspection (never exposed in normal play).
if (DEV_STATS) {
  window.__ddDebug = {
    renderer, scene, camera, fx, player, ball, defender, goal
  };
}

window.addEventListener('resize', () => {
  fx.composer.setSize(window.innerWidth, window.innerHeight);
});

// Hitbox helpers (toggled with the H key)
const hitboxHelpers = [
  new THREE.Box3Helper(player.box, 0x00e676),
  new THREE.Box3Helper(defender.box, 0xff1744)
];
hitboxHelpers.forEach((helper) => {
  helper.visible = false;
  scene.add(helper);
});

// ---------- Game state ----------
const PHASE = {
  DUEL: 'duel',
  GOAL_APPROACH: 'goal_approach',
  AIM: 'aim',
  SHOT: 'shot',
  CONCEDED: 'conceded'
};

let gameState = GAME_STATE.MENU;
let phase = PHASE.DUEL;
let matchTime = 0;
let score = 0;
let goals = 0;
let conceded = 0;
let duels = 0;
let combo = 0;
let level = 1;
let attackDuels = 0;
let currentScroll = MENU_SCROLL_SPEED;
let slowMoTimer = 0;
let timeScale = 1;
let shakeAmount = 0;
let hitFx = 0;
let phaseTimer = 0;
let aimTime = 0;
let launchTimer = 0;
let gameOverTimer = 0;
let lastDodge = null;
let shot = null;
let lastHudMinute = -1;
let finalReason = 'time';
let elapsed = 0;
let selectedEnvironment = DEFAULT_ENVIRONMENT;
let matchEnvironment = DEFAULT_ENVIRONMENT;
let gameAssets = null;
const cameraLookTarget = new THREE.Vector3(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);
const contactPoint = new THREE.Vector3();

function getMultiplier() {
  return 1 + COMBO_STEP * Math.min(combo, MAX_COMBO_STEPS);
}

function getMinute() {
  return Math.min(MATCH_MINUTES, Math.floor((matchTime / MATCH_SECONDS) * MATCH_MINUTES));
}

function refreshHUD() {
  const minute = getMinute();
  lastHudMinute = minute;
  // In the menu the HUD previews the environment that is about to be played;
  // during and after a match it shows the fixed theme chosen at kick-off.
  const isLive = gameState === GAME_STATE.PLAYING
    || gameState === GAME_STATE.PAUSED
    || gameState === GAME_STATE.GAME_OVER;
  updateHUD({
    score, goals, conceded, minute, combo,
    multiplier: getMultiplier(),
    level,
    themeName: getThemeName(isLive ? matchEnvironment : selectedEnvironment)
  });
}

// ---------- Match flow ----------
function startGame() {
  if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.PAUSED) return;
  resetPlayer(player);
  attachBall(ball);
  resetDefender(defender);
  hideGoal(goal);
  defender.group.visible = true;
  matchTime = 0;
  score = 0;
  goals = 0;
  conceded = 0;
  duels = 0;
  combo = 0;
  level = 1;
  attackDuels = 0;
  phase = PHASE.DUEL;
  lastDodge = null;
  shot = null;
  slowMoTimer = 0;
  shakeAmount = 0;
  hitFx = 0;
  // The environment is chosen BEFORE the match and stays fixed for 90 minutes.
  matchEnvironment = selectedEnvironment;
  setTheme(matchEnvironment, true);
  setAimHint(false, 0, '');
  refreshHUD();
  hideOverlay();
  playSound('whistle');
  showBanner("COUP D'ENVOI !", 'info');
  gameState = GAME_STATE.PLAYING;
}

function pauseGame() {
  if (gameState !== GAME_STATE.PLAYING) return;
  gameState = GAME_STATE.PAUSED;
  showPause();
}

function resumeGame() {
  if (gameState !== GAME_STATE.PAUSED) return;
  hideOverlay();
  gameState = GAME_STATE.PLAYING;
}

// New attack: everything is back to its starting position.
function kickoff() {
  hideGoal(goal);
  attachBall(ball);
  resetPlayer(player);
  attackDuels = 0;
  nextDefender(defender, level);
  defender.group.visible = true;
  lastDodge = null;
  shot = null;
  phase = PHASE.DUEL;
  refreshHUD();
}

function finishMatch(reason) {
  gameState = GAME_STATE.GAME_OVER;
  finalReason = reason;
  setAimHint(false, 0, '');
  setReticleVisible(goal, false);
  if (!player.isKnockedDown) {
    setPlayerMode(player, goals > conceded ? 'CELEBRATE' : 'IDLE');
  }
  playSound('final');
  gameOverTimer = GAME_OVER_DELAY;
}

function concede() {
  phase = PHASE.CONCEDED;
  conceded += 1;
  combo = 0;
  hitFx = 1;
  shakeAmount = 0.9;
  knockDownPlayer(player);
  // Real contact point: the ball leaves the defender's foot/body, not the void.
  markDefenderContact(defender);
  getDefenderContactPoint(defender, contactPoint);
  const pushDirection = Math.sign(ball.mesh.position.x - defender.group.position.x) || 1;
  releaseBall(ball, pushDirection * 3.2, 1.6, 4.2);
  playHitEffect(contactPoint.x, contactPoint.y, contactPoint.z);
  playSound('hit');
  flashScreen('hit');
  showBanner('BALLE PERDUE !', 'danger');
  showPopup('CONTRE-ATTAQUE... BUT ADVERSE', 'danger');
  phaseTimer = 2.2;
  refreshHUD();
}

// How did the player avoid the defender? Evaluated when the defender crosses the player.
function classifyDodge() {
  const gap = Math.abs(defender.group.position.x - player.group.position.x);
  const isAirborne = player.group.position.y > TACKLE_HEIGHT + 0.05;
  const isSlideAttack = defender.attackType === 'SLIDE' && defender.state === 'ATTACK';
  if (isSlideAttack && isAirborne && gap < (PLAYER_WIDTH + DEFENDER_WIDTH) / 2) return 'jump';
  if (gap < CLOSE_CALL_GAP) return 'close';
  return 'clean';
}

function awardDuel() {
  const dodge = lastDodge || 'clean';
  lastDodge = null;

  let bonus = 0;
  let label = 'DRIBBLE !';
  let kind = 'good';
  if (dodge === 'close') {
    bonus = BONUS_CLOSE_CALL;
    label = 'DRIBBLE PARFAIT !';
    kind = 'perfect';
    combo += 1;
  } else if (dodge === 'jump') {
    bonus = BONUS_JUMP;
    label = 'SAUT !';
    kind = 'jump';
    combo += 1;
  } else {
    combo = 0;
  }

  const previousLevel = level;
  const points = Math.round((SCORE_PER_DUEL + bonus) * getMultiplier());
  score += points;
  duels += 1;
  attackDuels += 1;
  level = duels + 1;

  showPopup(label + ' +' + points, kind);
  if (level > previousLevel) showPopup('NIVEAU ' + level + ' · DÉFENSEURS PLUS RAPIDES', 'level');
  playSound(dodge === 'clean' ? 'win' : 'perfect');
  playWinEffect();
  if (dodge !== 'clean') {
    slowMoTimer = SLOW_MO_DURATION;
    flashScreen('win');
  }
  refreshHUD();
}

// ---------- Goal approach, aiming and shooting ----------
function beginGoalApproach() {
  phase = PHASE.GOAL_APPROACH;
  defender.group.visible = false;
  showGoal(goal);
  showBanner('OCCASION !', 'info');
  playSound('whistle');
}

function startAim() {
  phase = PHASE.AIM;
  aimTime = 0;
  setPlayerMode(player, 'AIM');
  setReticleVisible(goal, true);
}

function takeShot() {
  shot = planShot(goal, getPlayerKickOrigin(player), level);
  setReticleVisible(goal, false);
  setAimHint(false, 0, '');
  setPlayerMode(player, 'KICK');
  launchTimer = KICK_DELAY;
  phase = PHASE.SHOT;
}

function launchShot() {
  launchBall(ball, getPlayerKickOrigin(player), shot.target, shot.flightTime,
    shot.outcome, shot.goalZ, shot.sideSign);
  startKeeperDive(goal, shot);
  playSound('kick');
  shot.launched = true;
}

function resolveShot(outcome) {
  if (outcome === 'GOAL') {
    combo += 1;
    goals += 1;
    const points = Math.round(GOAL_POINTS * getMultiplier());
    score += points;
    triggerNetImpact(goal, shot.targetLocal.x, shot.targetLocal.y, 1.15);
    playSound('net');
    playSound('goal');
    playGoalEffect();
    flashScreen('win');
    showBanner('BUUUUT !', 'goal');
    showPopup('+' + points, 'perfect');
    slowMoTimer = 1.1;
    shakeAmount = 0.35;
    setPlayerMode(player, 'CELEBRATE');
    phaseTimer = 3.0;
  } else if (outcome === 'SAVE') {
    combo = 0;
    playSound('save');
    const caught = shot.keeper && shot.keeper.mode === 'CATCH';
    showBanner(caught ? 'CAPTURE DU GARDIEN !' : 'ARRÊT DU GARDIEN !', 'save');
    setPlayerMode(player, 'IDLE');
    phaseTimer = 2.0;
  } else if (outcome === 'POST') {
    combo = 0;
    playSound('post');
    showBanner('POTEAU !', 'save');
    shakeAmount = 0.25;
    setPlayerMode(player, 'IDLE');
    phaseTimer = 2.0;
  } else if (outcome === 'BAR') {
    combo = 0;
    playSound('post');
    showBanner('BARRE TRANSVERSALE !', 'save');
    shakeAmount = 0.25;
    setPlayerMode(player, 'IDLE');
    phaseTimer = 2.0;
  } else {
    combo = 0;
    showBanner('HORS CADRE', 'miss');
    setPlayerMode(player, 'IDLE');
    phaseTimer = 1.8;
  }
  shot.resolved = true;
  refreshHUD();
}

function finishAttack() {
  if (matchTime >= MATCH_SECONDS) {
    finishMatch('time');
    return;
  }
  kickoff();
}

// ---------- Per-state updates ----------
function updateMenu(delta) {
  currentScroll += (MENU_SCROLL_SPEED - currentScroll) * Math.min(1, delta * 2);
  updateWorld(delta, currentScroll);
  updatePlayer(player, delta);
  updateBall(ball, delta, player);
}

function updatePlaying(delta, realDelta) {
  matchTime += delta;
  const minute = getMinute();
  if (minute !== lastHudMinute) refreshHUD();

  const baseScroll = Math.min(WORLD_SCROLL_SPEED + (level - 1) * SCROLL_SPEED_PER_LEVEL, MAX_SCROLL_SPEED);
  let scrollTarget = baseScroll;
  if (phase === PHASE.GOAL_APPROACH) {
    const remaining = -GOAL_DISTANCE - goal.group.position.z;
    scrollTarget = Math.min(baseScroll, Math.max(2.5, remaining * 0.9));
  } else if (phase !== PHASE.DUEL) {
    scrollTarget = 0;
  }
  currentScroll += (scrollTarget - currentScroll) * Math.min(1, delta * 2.5);

  updateWorld(delta, currentScroll);
  updatePlayer(player, delta);
  updateBall(ball, delta, player);
  updateGoal(goal, delta, currentScroll);

  const playerEvents = consumePlayerEvents(player);
  if (playerEvents.jumped) playSound('jump');
  if (playerEvents.landed) playSound('land');
  if (playerEvents.moved) playSound('lane');

  if (phase === PHASE.DUEL) {
    const previousZ = defender.group.position.z;
    updateDefender(defender, delta, getPlayerLane(player));
    const defenderEvents = consumeDefenderEvents(defender);
    if (defenderEvents.attackStarted) {
      playSound('tackle');
      showPopup(defender.attackType === 'SLIDE' ? 'TACLE !' : 'BLOCAGE !', 'danger');
    }
    if (previousZ < PLAYER_Z && defender.group.position.z >= PLAYER_Z) {
      lastDodge = classifyDodge();
    }
    if (checkCollision(defender, getPlayerBox(player))) {
      concede();
      return;
    }
    if (defenderEvents.passed) awardDuel();
    if (isDefenderOffscreen(defender)) {
      if (attackDuels >= DUELS_PER_ATTACK) beginGoalApproach();
      else nextDefender(defender, level);
    }
  } else if (phase === PHASE.GOAL_APPROACH) {
    if (goal.arrived) startAim();
  } else if (phase === PHASE.AIM) {
    aimTime += realDelta;
    updateReticle(goal, aimTime, level);
    setAimHint(true, 1 - aimTime / AIM_TIME_LIMIT, 'ESPACE / CLIC : TIRER');
    if (playerEvents.shoot || aimTime >= AIM_TIME_LIMIT) takeShot();
  } else if (phase === PHASE.SHOT) {
    if (!shot.launched) {
      launchTimer -= delta;
      if (launchTimer <= 0) launchShot();
    }
    const outcome = consumeBallArrival(ball);
    if (outcome) resolveShot(outcome);
    if (shot.resolved) {
      phaseTimer -= realDelta;
      if (phaseTimer <= 0) finishAttack();
    }
  } else if (phase === PHASE.CONCEDED) {
    updateDefender(defender, delta, getPlayerLane(player));
    phaseTimer -= realDelta;
    if (phaseTimer <= 0) {
      if (conceded >= MAX_CONCEDED) finishMatch('crush');
      else if (matchTime >= MATCH_SECONDS) finishMatch('time');
      else kickoff();
    }
  }

  if (matchTime >= MATCH_SECONDS && (phase === PHASE.DUEL || phase === PHASE.GOAL_APPROACH)) {
    finishMatch('time');
  }
}

function updateGameOver(delta, realDelta) {
  currentScroll += (0 - currentScroll) * Math.min(1, delta * 3);
  updateWorld(delta, currentScroll);
  updatePlayer(player, delta);
  updateBall(ball, delta, player);
  updateGoal(goal, delta, 0);
  updateDefender(defender, delta, getPlayerLane(player));

  if (gameOverTimer > 0) {
    gameOverTimer -= realDelta;
    if (gameOverTimer <= 0) {
      const result = goals > conceded ? 'win' : goals === conceded ? 'draw' : 'loss';
      showGameOver({
        score, goals, conceded, duels, result,
        reasonText: finalReason === 'crush' ? '3 BUTS ENCAISSÉS' : 'COUP DE SIFFLET FINAL'
      });
    }
  }
}

// ---------- Camera ----------
function updateCamera(realDelta) {
  const smoothing = Math.min(1, realDelta * 5);
  const playerX = player.group.position.x;
  const goalZ = goal.group.position.z;
  const isSlow = timeScale < 0.8;
  const isShotCamera = gameState === GAME_STATE.PLAYING
    && (phase === PHASE.AIM || phase === PHASE.SHOT);

  let desiredX;
  let desiredY;
  let desiredZ;
  let lookX;
  let lookY;
  let lookZ;
  let desiredFov;

  if (gameState === GAME_STATE.MENU) {
    desiredX = Math.sin(elapsed * 0.45) * 2.6;
    desiredY = 3.0;
    desiredZ = 6.5;
    lookX = 0;
    lookY = 1.2;
    lookZ = -6;
    desiredFov = BASE_FOV;
  } else if (isShotCamera) {
    desiredX = playerX * 0.4;
    desiredY = 2.3;
    desiredZ = 5.6;
    if (phase === PHASE.SHOT && ball.mode !== 'DRIBBLE') {
      const weight = 0.7;
      lookX = ball.mesh.position.x * weight;
      lookY = 1.3 * (1 - weight) + ball.mesh.position.y * weight;
      lookZ = goalZ * (1 - weight) + ball.mesh.position.z * weight;
    } else {
      lookX = 0;
      lookY = 1.3;
      lookZ = goalZ;
    }
    desiredFov = 48 + (isSlow ? 6 : 0);
  } else {
    desiredX = CAMERA_POSITION.x + playerX * 0.35;
    desiredY = CAMERA_POSITION.y + player.group.position.y * 0.2;
    desiredZ = CAMERA_POSITION.z;
    lookX = CAMERA_LOOK_AT.x + playerX * 0.25;
    lookY = CAMERA_LOOK_AT.y;
    lookZ = CAMERA_LOOK_AT.z;
    desiredFov = BASE_FOV + Math.min(level - 1, 8) + (isSlow ? 7 : 0);
  }

  camera.position.x += (desiredX - camera.position.x) * smoothing;
  camera.position.y += (desiredY - camera.position.y) * smoothing;
  camera.position.z += (desiredZ - camera.position.z) * smoothing;
  cameraLookTarget.x += (lookX - cameraLookTarget.x) * smoothing;
  cameraLookTarget.y += (lookY - cameraLookTarget.y) * smoothing;
  cameraLookTarget.z += (lookZ - cameraLookTarget.z) * smoothing;

  shakeAmount = Math.max(0, shakeAmount - realDelta * 2.5);
  camera.lookAt(
    cameraLookTarget.x + (Math.random() - 0.5) * shakeAmount,
    cameraLookTarget.y + (Math.random() - 0.5) * shakeAmount,
    cameraLookTarget.z
  );
  camera.fov += (desiredFov - camera.fov) * smoothing;
  camera.updateProjectionMatrix();
}

// ---------- Setup ----------
createUI({
  onStart: startGame,
  onResume: resumeGame,
  onEnvironmentSelect: (index) => {
    selectedEnvironment = index;
    setTheme(index);
    setEnvironment(index, getEnvironmentNames());
    refreshHUD();
  }
});
setEnvironment(selectedEnvironment, getEnvironmentNames());
setTheme(selectedEnvironment, true);
refreshHUD();
setMuteIndicator(isMuted());

// Assets load in the background: the game is playable immediately with the
// procedural bodies, then swaps to the rigged Mixamo characters when ready.
loadCharacterAssets((progress) => {
  setLoadingProgress(progress.loaded / progress.total, progress.error ? 'Assets manquants' : 'Chargement des joueurs');
}).then((assets) => {
  gameAssets = assets;
  if (assets.ready) {
    attachRig(player.actor, assets);
    attachRig(defender.actor, assets);
    attachRig(goal.keeper, assets);
    setLoadingProgress(1, 'Joueurs prêts');
    console.info('[assets] Rigged characters ready', {
      heightCm: assets.heightCm,
      scale: assets.scale,
      clips: assets.clipInfo.length,
      missing: assets.missing
    });
  } else {
    setLoadingProgress(1, 'Mode procédural');
    console.warn('[assets] Procedural fallback active. Missing:', assets.missing);
  }
  window.setTimeout(() => setLoadingProgress(null, ''), 1600);
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'p' || key === 'escape') {
    if (gameState === GAME_STATE.PLAYING) pauseGame();
    else if (gameState === GAME_STATE.PAUSED) resumeGame();
  }
  if (key === 'm') setMuteIndicator(toggleMute());
  if (key === 'h') hitboxHelpers.forEach((helper) => { helper.visible = !helper.visible; });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ---------- Dev diagnostics (URL params only) ----------
const statsElement = DEV_STATS ? document.createElement('div') : null;
if (statsElement) {
  renderer.info.autoReset = false;
  statsElement.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;font:11px monospace;'
    + 'color:#0f0;background:rgba(0,0,0,.65);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(statsElement);
}
let statsTimer = 0;
let frames = 0;
let fps = 0;

if (DEV_VIEWER) {
  const uiRoot = document.getElementById('dd-root');
  if (uiRoot) uiRoot.style.display = 'none';
  renderer.domElement.style.display = 'none';
  import('./devViewer.js').then((module) => module.startDevViewer());
}

// ---------- Main loop ----------
const clock = new THREE.Clock();

function animate() {
  if (DEV_VIEWER) return;
  requestAnimationFrame(animate);
  const realDelta = Math.min(clock.getDelta(), 0.05);
  elapsed += realDelta;

  if (slowMoTimer > 0) slowMoTimer -= realDelta;
  const targetScale = slowMoTimer > 0 ? SLOW_MO_SCALE : 1;
  timeScale += (targetScale - timeScale) * Math.min(1, realDelta * 10);
  const delta = realDelta * timeScale;

  if (gameState === GAME_STATE.MENU) updateMenu(delta);
  else if (gameState === GAME_STATE.PLAYING) updatePlaying(delta, realDelta);
  else if (gameState === GAME_STATE.GAME_OVER) updateGameOver(delta, realDelta);

  updateCamera(realDelta);

  // Post-processing reacts to the game: slow motion, goals, hits.
  const isSlow = timeScale < 0.8;
  hitFx = Math.max(0, hitFx - realDelta * 1.5);
  fx.targets.aberration = 0.0012 + hitFx * 0.012 + (isSlow ? 0.003 : 0);
  fx.targets.vignette = 0.5 + (isSlow ? 0.25 : 0) + hitFx * 0.3;
  fx.targets.saturation = 1.08 - hitFx * 0.5;
  fx.targets.bloom = getBloomTarget() + (isSlow ? 0.2 : 0);
  updatePostProcessing(fx, realDelta);
  if (statsElement) renderer.info.reset();
  fx.composer.render(realDelta);

  if (statsElement) {
    frames += 1;
    statsTimer += realDelta;
    if (statsTimer >= 0.5) {
      fps = Math.round(frames / statsTimer);
      frames = 0;
      statsTimer = 0;
      const info = renderer.info;
      statsElement.textContent = 'FPS ' + fps
        + ' | appels ' + info.render.calls
        + ' | triangles ' + info.render.triangles
        + ' | rig ' + (isRigReady(player.actor) ? 'FBX' : 'procédural');
    }
  }
}
animate();
