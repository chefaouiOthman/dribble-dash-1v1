import { STORAGE_KEY_BEST_SCORE } from './config.js';

const STYLE = `
#dd-root{position:fixed;inset:0;pointer-events:none;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;overflow:hidden}
#dd-root *{box-sizing:border-box}
.dd-card{background:linear-gradient(180deg,rgba(14,24,52,.72),rgba(6,12,30,.72));border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 16px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.12)}
#dd-hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px;transition:opacity .3s}
#dd-hud.dd-hidden{opacity:0}
.dd-label{font-size:11px;letter-spacing:.2em;opacity:.7;font-weight:700}
.dd-big{font-size:34px;font-weight:900;line-height:1.05;font-variant-numeric:tabular-nums}
.dd-mid{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.dd-small{font-size:12px;opacity:.8;margin-top:2px}
.dd-chip{margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.14);display:inline-block}
.dd-right{text-align:right}
#dd-board{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:6px 14px}
.dd-team{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.12em;font-size:13px}
.dd-team i{width:10px;height:26px;border-radius:3px;display:block}
.dd-home i{background:#e53935}.dd-away i{background:#1e88e5}
.dd-goals{font-size:30px;font-weight:900;font-variant-numeric:tabular-nums;display:flex;gap:10px;align-items:center}
.dd-goals em{opacity:.5;font-style:normal}
.dd-clock{font-size:14px;font-weight:800;background:rgba(255,255,255,.14);border-radius:8px;padding:3px 9px;min-width:50px;text-align:center}
#dd-combo-wrap{position:absolute;left:50%;top:76px;transform:translateX(-50%)}
#dd-combo{padding:5px 16px;border-radius:999px;font-weight:900;letter-spacing:.1em;font-size:15px;background:linear-gradient(90deg,#ff9100,#ffd600);color:#2b1a00;opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;box-shadow:0 0 24px rgba(255,200,0,.55);white-space:nowrap}
#dd-combo.dd-active{opacity:1;transform:scale(1)}
#dd-bottom{position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:space-between;padding:0 18px;font-size:12px;opacity:.75}
#dd-aim{position:absolute;left:50%;bottom:50px;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .25s}
#dd-aim.dd-on{opacity:1}
#dd-aim-text{font-weight:900;letter-spacing:.18em;font-size:18px;text-shadow:0 2px 12px rgba(0,0,0,.7);margin-bottom:8px}
.dd-bar{width:240px;height:8px;border-radius:99px;background:rgba(255,255,255,.2);overflow:hidden}
#dd-aim-fill{height:100%;width:100%;background:linear-gradient(90deg,#ff5252,#ffd600,#00e676);transform-origin:left}
#dd-popups{position:absolute;inset:0;overflow:hidden}
.dd-popup{position:absolute;left:50%;top:40%;white-space:nowrap;font-weight:900;font-style:italic;font-size:clamp(24px,4.5vw,48px);text-shadow:0 4px 18px rgba(0,0,0,.6);animation:dd-pop 1.2s ease-out forwards}
.dd-popup-good{color:#fff}
.dd-popup-perfect{color:#ffd600;text-shadow:0 0 24px rgba(255,170,0,.9)}
.dd-popup-jump{color:#4fc3f7}
.dd-popup-danger{color:#ff5252;top:30%;font-size:clamp(22px,4vw,40px)}
.dd-popup-level{color:#b388ff;top:24%;font-size:clamp(18px,3vw,30px)}
@keyframes dd-pop{0%{opacity:0;transform:translate(-50%,10px) scale(.6)}15%{opacity:1;transform:translate(-50%,-6px) scale(1.15)}70%{opacity:1;transform:translate(-50%,-40px) scale(1)}100%{opacity:0;transform:translate(-50%,-70px) scale(1)}}
#dd-banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) scale(.6);font-weight:900;font-style:italic;font-size:clamp(36px,9vw,110px);letter-spacing:.04em;opacity:0;white-space:nowrap;text-shadow:0 8px 40px rgba(0,0,0,.6)}
#dd-banner.dd-banner-show{animation:dd-banner 2.2s cubic-bezier(.2,.9,.3,1) forwards}
.dd-b-goal{background:linear-gradient(180deg,#fff7b0,#ffd600 45%,#ff6d00);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(255,170,0,.8))}
.dd-b-save{color:#4fc3f7}.dd-b-miss{color:#cfd8dc}.dd-b-danger{color:#ff5252}.dd-b-info{color:#fff}
@keyframes dd-banner{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}22%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%) scale(1.05)}}
.dd-flash{position:absolute;inset:0;animation:dd-flash .6s ease-out forwards}
.dd-flash-hit{background:radial-gradient(ellipse at center,rgba(255,0,0,0) 30%,rgba(255,0,0,.65))}
.dd-flash-win{background:radial-gradient(ellipse at center,rgba(255,230,120,0) 35%,rgba(255,220,100,.5))}
@keyframes dd-flash{0%{opacity:1}100%{opacity:0}}
.dd-screen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(5,10,25,.35),rgba(5,10,25,.82));opacity:0;pointer-events:none;transition:opacity .35s;cursor:pointer}
.dd-screen.dd-visible{opacity:1;pointer-events:auto}
.dd-panel{text-align:center;padding:30px 40px;max-width:min(92vw,600px)}
.dd-kicker{font-size:12px;letter-spacing:.35em;opacity:.75;font-weight:700}
.dd-title{margin:8px 0 6px;font-size:clamp(40px,9vw,84px);line-height:.95;font-weight:900;font-style:italic;letter-spacing:.02em;text-shadow:0 6px 30px rgba(0,0,0,.5)}
.dd-title span{background:linear-gradient(90deg,#ffd600,#ff6d00);-webkit-background-clip:text;background-clip:text;color:transparent}
.dd-title small{display:block;font-size:.38em;letter-spacing:.5em;font-style:normal;opacity:.9}
.dd-result{font-size:clamp(34px,7vw,64px)}
.dd-win{color:#00e676}.dd-draw{color:#ffd600}.dd-loss{color:#ff5252}
.dd-tagline{opacity:.85;margin:10px 0 18px;line-height:1.4}
.dd-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 20px;text-align:left}
.dd-controls div{background:rgba(255,255,255,.08);border-radius:10px;padding:8px 10px;font-size:13px}
.dd-controls b{color:#ffd600}
.dd-button{display:inline-block;padding:14px 34px;border-radius:999px;font-weight:900;letter-spacing:.12em;font-size:18px;color:#1d1200;background:linear-gradient(90deg,#ffd600,#ff9100);box-shadow:0 10px 30px rgba(255,160,0,.45);animation:dd-pulse 1.4s ease-in-out infinite}
.dd-button span{font-size:11px;opacity:.7;margin-left:8px}
@keyframes dd-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.dd-best{margin-top:14px;font-size:14px;opacity:.85}
.dd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0 14px}
.dd-stat{background:rgba(255,255,255,.1);border-radius:12px;padding:10px 6px}
.dd-stat b{display:block;font-size:24px;font-variant-numeric:tabular-nums}
.dd-stat small{font-size:10px;letter-spacing:.12em;opacity:.7}
.dd-stars{font-size:30px;letter-spacing:.2em;color:#ffd600;margin:4px 0 16px}
.dd-record{display:none;margin:6px 0;font-weight:900;letter-spacing:.2em;color:#ffd600;text-shadow:0 0 18px rgba(255,200,0,.8)}
.dd-env{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 18px}
.dd-env button{pointer-events:auto;cursor:pointer;font:inherit;font-weight:800;font-size:12px;letter-spacing:.12em;padding:9px 15px;border-radius:999px;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.24);transition:transform .15s,box-shadow .15s,background .15s}
.dd-env button:hover{transform:translateY(-1px);background:rgba(255,255,255,.16)}
.dd-env button.dd-active{color:#201300;border-color:transparent;background:linear-gradient(90deg,#ffd600,#ff9100);box-shadow:0 6px 20px rgba(255,160,0,.45)}
.dd-env-label{margin:0 0 8px;font-size:11px;letter-spacing:.28em;font-weight:700;opacity:.7}
#dd-loading{position:absolute;left:50%;bottom:46px;transform:translateX(-50%);width:min(86vw,320px);padding:9px 14px;opacity:0;transition:opacity .3s;pointer-events:none}
#dd-loading.dd-on{opacity:1}
#dd-loading-label{font-size:10px;letter-spacing:.18em;font-weight:700;opacity:.8;margin-bottom:6px;text-align:center}
`;

const TEMPLATE = `
<div id="dd-hud" class="dd-hidden">
  <div class="dd-card">
    <div class="dd-label">SCORE</div>
    <div class="dd-big" id="dd-score">0</div>
    <div class="dd-chip" id="dd-level">NIVEAU 1</div>
  </div>
  <div id="dd-board" class="dd-card">
    <div class="dd-team dd-home"><i></i><b>VOUS</b></div>
    <div class="dd-goals"><span id="dd-goals">0</span><em>-</em><span id="dd-conceded">0</span></div>
    <div class="dd-team dd-away"><b>ADV</b><i></i></div>
    <div class="dd-clock" id="dd-clock">0'</div>
  </div>
  <div class="dd-card dd-right">
    <div class="dd-label">RECORD</div>
    <div class="dd-mid" id="dd-best">0</div>
    <div class="dd-small" id="dd-theme">JOUR</div>
  </div>
</div>
<div id="dd-combo-wrap"><div id="dd-combo"></div></div>
<div id="dd-popups"></div>
<div id="dd-banner"></div>
<div id="dd-aim"><div id="dd-aim-text"></div><div class="dd-bar"><div id="dd-aim-fill"></div></div></div>
<div id="dd-bottom">
  <div>← → / Q D : couloir &nbsp;·&nbsp; ESPACE / ↑ / CLIC : sauter ou tirer</div>
  <div>P pause &nbsp;·&nbsp; H hitbox &nbsp;·&nbsp; M <span id="dd-sound">🔊</span></div>
</div>
<div id="dd-loading" class="dd-card">
  <div id="dd-loading-label">CHARGEMENT DES JOUEURS</div>
  <div class="dd-bar"><div id="dd-loading-fill"></div></div>
</div>
<div class="dd-screen dd-visible" id="dd-menu">
  <div class="dd-panel">
    <div class="dd-kicker">PROJET WEBGL · THREE.JS</div>
    <h1 class="dd-title">DRIBBLE <span>DASH</span><small>1 v 1</small></h1>
    <p class="dd-tagline">Dribble les défenseurs, déjoue le gardien et marque plus de buts que l'adversaire en 90 minutes.</p>
    <div class="dd-controls">
      <div><b>← →</b> ou <b>Q D</b> : changer de couloir</div>
      <div><b>ESPACE</b> / <b>↑</b> : sauter le tacle</div>
      <div><b>Face au but</b> : vise avec le réticule, <b>ESPACE</b> ou <b>CLIC</b> pour tirer</div>
      <div><b>3 buts encaissés</b> = match perdu</div>
    </div>
    <div class="dd-env-label">AMBIANCE DU MATCH (FIXE PENDANT 90 MINUTES)</div>
    <div class="dd-env" id="dd-env"></div>
    <div class="dd-button">COUP D'ENVOI <span>ENTRÉE</span></div>
    <div class="dd-best">Record : <b id="dd-menu-best">0</b></div>
  </div>
</div>
<div class="dd-screen" id="dd-gameover">
  <div class="dd-panel">
    <div class="dd-kicker" id="dd-go-reason">COUP DE SIFFLET FINAL</div>
    <h2 class="dd-title dd-result" id="dd-go-result">VICTOIRE !</h2>
    <div class="dd-record" id="dd-record">★ NOUVEAU RECORD ★</div>
    <div class="dd-stats">
      <div class="dd-stat"><b id="dd-go-score">0</b><small>SCORE</small></div>
      <div class="dd-stat"><b id="dd-go-goals">0</b><small>BUTS</small></div>
      <div class="dd-stat"><b id="dd-go-duels">0</b><small>DUELS</small></div>
      <div class="dd-stat"><b id="dd-go-best">0</b><small>RECORD</small></div>
    </div>
    <div class="dd-stars" id="dd-go-stars"></div>
    <div class="dd-button">REJOUER <span>ENTRÉE</span></div>
  </div>
</div>
<div class="dd-screen" id="dd-pause">
  <div class="dd-panel">
    <h2 class="dd-title">PAUSE</h2>
    <p class="dd-tagline">Appuie sur P, Échap ou ENTRÉE pour reprendre.</p>
    <div class="dd-button">REPRENDRE</div>
  </div>
</div>
`;

let rootElement = null;
let hudElement = null;
let popupLayer = null;
let currentScreen = null;
let uiCallbacks = {};
const screens = {};
const refs = {};
let envButtons = [];

function readBestScore() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY_BEST_SCORE));
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(value));
  } catch (error) {
    // storage unavailable: the record is simply not saved
  }
}

function showScreen(name) {
  Object.keys(screens).forEach((key) => screens[key].classList.toggle('dd-visible', key === name));
  currentScreen = name;
  hudElement.classList.toggle('dd-hidden', name === 'menu');
}

// Builds every HTML element. callbacks: onStart, onResume.
export function createUI(callbacks) {
  uiCallbacks = callbacks || {};
  const styleElement = document.createElement('style');
  styleElement.textContent = STYLE;
  document.head.appendChild(styleElement);

  rootElement = document.createElement('div');
  rootElement.id = 'dd-root';
  rootElement.innerHTML = TEMPLATE;
  document.body.appendChild(rootElement);

  const find = (selector) => rootElement.querySelector(selector);
  hudElement = find('#dd-hud');
  popupLayer = find('#dd-popups');
  ['score', 'level', 'goals', 'conceded', 'clock', 'best', 'theme', 'combo', 'banner', 'sound',
    'aim', 'record'].forEach((name) => { refs[name] = find('#dd-' + name); });
  refs.aimText = find('#dd-aim-text');
  refs.aimFill = find('#dd-aim-fill');
  refs.menuBest = find('#dd-menu-best');
  refs.loading = find('#dd-loading');
  refs.loadingFill = find('#dd-loading-fill');
  refs.loadingLabel = find('#dd-loading-label');
  refs.env = find('#dd-env');
  ['reason', 'result', 'score', 'goals', 'duels', 'best', 'stars'].forEach((name) => {
    refs['go' + name] = find('#dd-go-' + name);
  });
  screens.menu = find('#dd-menu');
  screens.gameover = find('#dd-gameover');
  screens.pause = find('#dd-pause');

  screens.menu.addEventListener('click', () => callbacks.onStart());
  screens.gameover.addEventListener('click', () => callbacks.onStart());
  screens.pause.addEventListener('click', () => callbacks.onResume());

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.repeat) return;
    if (currentScreen === 'menu' || currentScreen === 'gameover') {
      event.preventDefault();
      callbacks.onStart();
    } else if (currentScreen === 'pause') {
      event.preventDefault();
      callbacks.onResume();
    }
  });

  const best = readBestScore();
  refs.best.textContent = String(best);
  refs.menuBest.textContent = String(best);
  showScreen('menu');
}

// stats: { score, goals, conceded, minute, combo, multiplier, level, themeName }
export function updateHUD(stats) {
  refs.score.textContent = String(stats.score);
  refs.goals.textContent = String(stats.goals);
  refs.conceded.textContent = String(stats.conceded);
  refs.clock.textContent = stats.minute + "'";
  refs.level.textContent = 'NIVEAU ' + stats.level;
  refs.theme.textContent = stats.themeName;
  if (stats.combo >= 1) {
    refs.combo.textContent = 'COMBO x' + stats.multiplier.toFixed(2);
    refs.combo.classList.add('dd-active');
  } else {
    refs.combo.classList.remove('dd-active');
  }
}

// kind: good, perfect, jump, danger, level
export function showPopup(text, kind) {
  const element = document.createElement('div');
  element.className = 'dd-popup dd-popup-' + (kind || 'good');
  element.textContent = text;
  popupLayer.appendChild(element);
  setTimeout(() => element.remove(), 1300);
}

// Big central banner. kind: goal, save, miss, danger, info
export function showBanner(text, kind) {
  refs.banner.className = '';
  void refs.banner.offsetWidth;
  refs.banner.textContent = text;
  refs.banner.className = 'dd-banner-show dd-b-' + kind;
}

// kind: hit, win
export function flashScreen(kind) {
  const element = document.createElement('div');
  element.className = 'dd-flash dd-flash-' + kind;
  rootElement.appendChild(element);
  setTimeout(() => element.remove(), 700);
}

export function setAimHint(isVisible, fraction, text) {
  refs.aim.classList.toggle('dd-on', isVisible);
  if (!isVisible) return;
  refs.aimText.textContent = text;
  refs.aimFill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, fraction)) + ')';
}

export function showMenu() {
  showScreen('menu');
}

export function hideOverlay() {
  showScreen(null);
}

export function showPause() {
  showScreen('pause');
}

function getStars(score) {
  const count = score < 500 ? 1 : score < 1500 ? 2 : score < 3000 ? 3 : score < 5000 ? 4 : 5;
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

// stats: { score, goals, conceded, duels, result ('win' | 'draw' | 'loss'), reasonText }
export function showGameOver(stats) {
  const previousBest = readBestScore();
  const isNewRecord = stats.score > previousBest;
  const best = Math.max(previousBest, stats.score);
  if (isNewRecord) writeBestScore(best);

  const titles = { win: 'VICTOIRE !', draw: 'MATCH NUL', loss: 'DÉFAITE' };
  refs.goreason.textContent = stats.reasonText + ' · ' + stats.goals + ' - ' + stats.conceded;
  refs.goresult.textContent = titles[stats.result];
  refs.goresult.className = 'dd-title dd-result dd-' + stats.result;
  refs.goscore.textContent = String(stats.score);
  refs.gogoals.textContent = String(stats.goals);
  refs.goduels.textContent = String(stats.duels);
  refs.gobest.textContent = String(best);
  refs.gostars.textContent = getStars(stats.score);
  refs.best.textContent = String(best);
  refs.menuBest.textContent = String(best);
  refs.record.style.display = isNewRecord ? 'block' : 'none';
  showScreen('gameover');
}

export function setMuteIndicator(isMutedNow) {
  refs.sound.textContent = isMutedNow ? '🔇' : '🔊';
}

// Pre-match environment selector. The selection is applied before kick-off and
// never changes during the match.
export function setEnvironment(index, names) {
  if (!refs.env || !Array.isArray(names)) return;
  if (envButtons.length !== names.length) {
    refs.env.textContent = '';
    envButtons = names.map((name, buttonIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      // The menu screen itself is clickable (start): do not start a match here.
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (typeof uiCallbacks.onEnvironmentSelect === 'function') {
          uiCallbacks.onEnvironmentSelect(buttonIndex);
        }
      });
      refs.env.appendChild(button);
      return button;
    });
  }
  envButtons.forEach((button, buttonIndex) => {
    button.classList.toggle('dd-active', buttonIndex === index);
  });
}

// fraction: null hides the bar, a number fills it and updates the label.
export function setLoadingProgress(fraction, label) {
  if (!refs.loading) return;
  if (fraction === null || fraction === undefined) {
    refs.loading.classList.remove('dd-on');
    return;
  }
  refs.loading.classList.add('dd-on');
  const clamped = Math.max(0, Math.min(1, fraction));
  refs.loadingFill.style.transform = 'scaleX(' + clamped + ')';
  if (label) refs.loadingLabel.textContent = label.toUpperCase();
}