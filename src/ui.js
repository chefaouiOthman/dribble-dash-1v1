import {
  STORAGE_KEY_BEST_SCORE, MATCH_DURATION_PRESETS, DIFFICULTY_PRESETS, ON_FIRE_COMBO
} from './config.js';

const STYLE = `
#dd-root{position:fixed;inset:0;pointer-events:none;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;overflow:hidden}
#dd-root *{box-sizing:border-box}
.dd-card{background:linear-gradient(180deg,rgba(14,24,52,.78),rgba(6,12,30,.78));border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 16px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 12px 32px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12)}
#dd-hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px;transition:opacity .3s}
#dd-hud.dd-hidden{opacity:0}
.dd-label{font-size:11px;letter-spacing:.2em;opacity:.7;font-weight:700}
.dd-big{font-size:34px;font-weight:900;line-height:1.05;font-variant-numeric:tabular-nums}
.dd-mid{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.dd-small{font-size:12px;opacity:.8;margin-top:2px}
.dd-chip{margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.12em;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.14);display:inline-block}
.dd-right{text-align:right}
#dd-board-wrap{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#dd-board{display:flex;align-items:center;gap:12px;padding:6px 14px}
.dd-team{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.12em;font-size:13px}
.dd-team i{width:10px;height:26px;border-radius:3px;display:block}
.dd-home i{background:#e53935}.dd-away i{background:#1e88e5}
.dd-goals{font-size:30px;font-weight:900;font-variant-numeric:tabular-nums;display:flex;gap:10px;align-items:center}
.dd-goals em{opacity:.5;font-style:normal}
.dd-clock{font-size:14px;font-weight:800;background:rgba(255,255,255,.14);border-radius:8px;padding:3px 9px;min-width:50px;text-align:center}
#dd-phase-pill{font-size:10px;font-weight:800;letter-spacing:.18em;padding:3px 12px;border-radius:999px;background:rgba(6,12,30,.72);border:1px solid rgba(255,255,255,.16);color:#cfd8dc;backdrop-filter:blur(8px)}
#dd-phase-pill.dd-shot-ready{color:#ffd600;border-color:rgba(255,214,0,.45)}
#dd-combo-wrap{position:absolute;left:50%;top:102px;transform:translateX(-50%)}
#dd-combo{padding:5px 16px;border-radius:999px;font-weight:900;letter-spacing:.1em;font-size:14px;background:linear-gradient(90deg,#ff9100,#ffd600);color:#2b1a00;opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;box-shadow:0 0 24px rgba(255,200,0,.55);white-space:nowrap}
#dd-combo.dd-active{opacity:1;transform:scale(1)}
#dd-combo.dd-fire{background:linear-gradient(90deg,#ff1744,#ff9100,#ffd600);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5);box-shadow:0 0 30px rgba(255,61,0,.75)}
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
.dd-screen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(ellipse at center,rgba(6,14,34,.42),rgba(3,8,20,.88));opacity:0;pointer-events:none;transition:opacity .35s;overflow-y:auto}
.dd-screen.dd-visible{opacity:1;pointer-events:auto}
.dd-lobby{width:min(94vw,920px);padding:26px 28px;border-radius:22px;background:linear-gradient(160deg,rgba(14,26,58,.86),rgba(6,12,30,.92));border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 24px 70px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.14)}
.dd-lobby-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}
.dd-kicker{font-size:11px;letter-spacing:.28em;color:#ffd600;font-weight:800}
.dd-title{margin:4px 0 0;font-size:clamp(30px,5vw,52px);line-height:.96;font-weight:900;font-style:italic;letter-spacing:.02em;text-shadow:0 6px 24px rgba(0,0,0,.5)}
.dd-title span{background:linear-gradient(90deg,#ffd600,#ff6d00);-webkit-background-clip:text;background-clip:text;color:transparent}
.dd-record-pill{padding:10px 16px;border-radius:14px;background:rgba(255,214,0,.1);border:1px solid rgba(255,214,0,.35);text-align:right;flex-shrink:0}
.dd-record-pill small{display:block;font-size:10px;letter-spacing:.2em;color:#ffd600;font-weight:800}
.dd-record-pill b{font-size:26px;font-weight:900;font-variant-numeric:tabular-nums}
.dd-lobby-grid{display:grid;grid-template-columns:1.15fr 0.85fr;gap:18px;margin-top:18px}
.dd-box{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px 16px}
.dd-box-title{font-size:11px;letter-spacing:.22em;font-weight:800;opacity:.72;margin-bottom:10px}
.dd-seg{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.dd-seg:last-child{margin-bottom:0}
.dd-seg button{pointer-events:auto;cursor:pointer;flex:1;min-width:92px;font:inherit;font-weight:800;font-size:12px;letter-spacing:.08em;padding:9px 10px;border-radius:10px;color:#e3ecff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);transition:transform .12s,background .15s,border-color .15s}
.dd-seg button:hover{transform:translateY(-1px);background:rgba(255,255,255,.14)}
.dd-seg button.dd-active{color:#201300;border-color:transparent;background:linear-gradient(90deg,#ffd600,#ff9100);box-shadow:0 6px 18px rgba(255,160,0,.4)}
.dd-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
.dd-controls div{background:rgba(255,255,255,.06);border-radius:9px;padding:7px 9px;font-size:12px;line-height:1.35}
.dd-controls b{color:#ffd600}
.dd-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.dd-badge{font-size:10px;font-weight:700;letter-spacing:.08em;padding:4px 9px;border-radius:999px;background:rgba(0,229,255,.12);border:1px solid rgba(0,229,255,.28);color:#80d8ff}
.dd-lobby-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);flex-wrap:wrap}
.dd-tagline{margin:0;font-size:13px;opacity:.8;max-width:460px;line-height:1.4}
.dd-btn{pointer-events:auto;cursor:pointer;border:none;font:inherit;display:inline-flex;align-items:center;gap:10px;padding:14px 32px;border-radius:999px;font-weight:900;letter-spacing:.12em;font-size:17px;color:#1d1200;background:linear-gradient(90deg,#ffd600,#ff9100);box-shadow:0 10px 28px rgba(255,160,0,.45);transition:transform .14s,box-shadow .14s}
.dd-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 14px 34px rgba(255,160,0,.55)}
.dd-btn span{font-size:11px;opacity:.7}
.dd-btn-sec{pointer-events:auto;cursor:pointer;font:inherit;padding:13px 22px;border-radius:999px;font-weight:800;letter-spacing:.1em;font-size:14px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24)}
.dd-btn-sec:hover{background:rgba(255,255,255,.18)}
.dd-panel{text-align:center;padding:28px 34px;max-width:min(92vw,620px);border-radius:22px;background:linear-gradient(160deg,rgba(14,26,58,.88),rgba(6,12,30,.94));border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(14px);box-shadow:0 24px 64px rgba(0,0,0,.6)}
.dd-result{font-size:clamp(32px,6.5vw,58px);margin-bottom:4px}
.dd-win{color:#00e676}.dd-draw{color:#ffd600}.dd-loss{color:#ff5252}
.dd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 14px}
.dd-stat{background:rgba(255,255,255,.08);border-radius:12px;padding:10px 8px}
.dd-stat b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.dd-stat small{font-size:10px;letter-spacing:.12em;opacity:.7}
.dd-stars{font-size:28px;letter-spacing:.2em;color:#ffd600;margin:4px 0 16px}
.dd-record{display:none;margin:6px 0;font-weight:900;letter-spacing:.2em;color:#ffd600;text-shadow:0 0 18px rgba(255,200,0,.8)}
.dd-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px}
#dd-loading{position:absolute;left:50%;bottom:46px;transform:translateX(-50%);width:min(86vw,320px);padding:9px 14px;opacity:0;transition:opacity .3s;pointer-events:none}
#dd-loading.dd-on{opacity:1}
#dd-loading-label{font-size:10px;letter-spacing:.18em;font-weight:700;opacity:.8;margin-bottom:6px;text-align:center}
.dd-settings{text-align:left}
.dd-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;font-size:13px}
.dd-setting-row input[type=range]{width:130px;accent-color:#ffd600;cursor:pointer}
.dd-toggle{cursor:pointer;font:inherit;font-weight:800;font-size:11px;letter-spacing:.1em;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff}
.dd-toggle.dd-on{background:linear-gradient(90deg,#ffd600,#ff9100);color:#201300;border-color:transparent}
.dd-voice-note{font-size:11px;opacity:.72;margin-top:8px}
@media (max-width: 760px) {
  .dd-lobby{padding:18px 16px}
  .dd-lobby-grid{grid-template-columns:1fr;gap:12px}
  .dd-lobby-head{flex-direction:column;align-items:flex-start}
  .dd-record-pill{text-align:left}
  .dd-lobby-foot{flex-direction:column;align-items:stretch}
  .dd-btn{justify-content:center}
}
@media (max-width: 680px) {
  #dd-hud{padding:8px 10px}
  .dd-card{padding:6px 10px;border-radius:10px}
  .dd-big{font-size:24px}
  .dd-mid{font-size:18px}
  #dd-board-wrap{top:74px}
  #dd-board{padding:4px 10px;gap:8px}
  .dd-goals{font-size:22px;gap:6px}
  .dd-team{font-size:11px}
  #dd-combo-wrap{top:138px}
  .dd-panel{padding:20px 18px}
  .dd-controls{grid-template-columns:1fr;gap:6px}
  .dd-stats{grid-template-columns:repeat(2,1fr)}
  #dd-bottom{display:none}
}
`;

const TEMPLATE = `
<div id="dd-hud" class="dd-hidden">
  <div class="dd-card">
    <div class="dd-label">SCORE</div>
    <div class="dd-big" id="dd-score">0</div>
    <div class="dd-chip" id="dd-level">NIVEAU 1</div>
  </div>
  <div id="dd-board-wrap">
    <div id="dd-board" class="dd-card">
      <div class="dd-team dd-home"><i></i><b>VOUS</b></div>
      <div class="dd-goals"><span id="dd-goals">0</span><em>-</em><span id="dd-conceded">0</span></div>
      <div class="dd-team dd-away"><b>ADV</b><i></i></div>
      <div class="dd-clock" id="dd-clock">0'</div>
    </div>
    <div id="dd-phase-pill">DUEL 1 / 2</div>
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
  <div class="dd-lobby">
    <div class="dd-lobby-head">
      <div>
        <div class="dd-kicker">FEUILLE DE MATCH · WEBGL THREE.JS</div>
        <h1 class="dd-title">DRIBBLE <span>DASH</span> 1v1</h1>
      </div>
      <div class="dd-record-pill">
        <small>RECORD PERSONNEL</small>
        <b id="dd-menu-best">0</b>
      </div>
    </div>
    <div class="dd-lobby-grid">
      <div class="dd-box">
        <div class="dd-box-title">AMBIANCE DU STADE (FIXE PENDANT LE MATCH)</div>
        <div class="dd-seg" id="dd-env"></div>
        <div class="dd-box-title">DURÉE DU MATCH</div>
        <div class="dd-seg" id="dd-duration"></div>
        <div class="dd-box-title">NIVEAU DE DIFFICULTÉ</div>
        <div class="dd-seg" id="dd-difficulty"></div>
      </div>
      <div class="dd-box">
        <div class="dd-box-title">STUDIO AUDIO & COMMENTATEUR</div>
        <div class="dd-settings" id="dd-menu-settings"></div>
        <div class="dd-controls">
          <div><b>← → / Q D</b> : couloir</div>
          <div><b>ESPACE / ↑</b> : saut & tir</div>
          <div><b>Lucarne</b> : +200 bonus</div>
          <div><b>3 buts encaissés</b> = KO</div>
        </div>
        <div class="dd-badges">
          <span class="dd-badge">ANIMATIONS MIXAMO</span>
          <span class="dd-badge">COMMENTATEUR FR</span>
          <span class="dd-badge">MODE EN FEU</span>
        </div>
      </div>
    </div>
    <div class="dd-lobby-foot">
      <p class="dd-tagline">Efface les deux défenseurs, ajuste la lucarne face au gardien et enflamme le stade !</p>
      <button type="button" class="dd-btn" id="dd-start-btn">COUP D'ENVOI <span>ENTRÉE</span></button>
    </div>
  </div>
</div>
<div class="dd-screen" id="dd-gameover">
  <div class="dd-panel">
    <div class="dd-kicker" id="dd-go-reason">COUP DE SIFFLET FINAL</div>
    <h2 class="dd-title dd-result" id="dd-go-result">VICTOIRE !</h2>
    <div class="dd-record" id="dd-record">★ NOUVEAU RECORD ★</div>
    <div class="dd-stats">
      <div class="dd-stat"><b id="dd-go-score">0</b><small>SCORE</small></div>
      <div class="dd-stat"><b id="dd-go-goals">0</b><small>BUTS (LUCARNES)</small></div>
      <div class="dd-stat"><b id="dd-go-accuracy">0%</b><small>PRÉCISION TIRS</small></div>
      <div class="dd-stat"><b id="dd-go-duels">0</b><small>DUELS GAGNÉS</small></div>
      <div class="dd-stat"><b id="dd-go-combo">x1.00</b><small>MEILLEUR COMBO</small></div>
      <div class="dd-stat"><b id="dd-go-best">0</b><small>RECORD</small></div>
    </div>
    <div class="dd-stars" id="dd-go-stars"></div>
    <div class="dd-actions">
      <button type="button" class="dd-btn" id="dd-replay-btn">REJOUER <span>ENTRÉE</span></button>
      <button type="button" class="dd-btn-sec" id="dd-menu-btn">LOBBY MATCH</button>
    </div>
  </div>
</div>
<div class="dd-screen" id="dd-pause">
  <div class="dd-panel">
    <h2 class="dd-title">PAUSE</h2>
    <p class="dd-tagline" style="margin:10px 0 14px">Appuie sur P, Échap ou ENTRÉE pour reprendre.</p>
    <div class="dd-box" style="margin-bottom:18px">
      <div class="dd-box-title">STUDIO AUDIO & COMMENTATEUR</div>
      <div class="dd-settings" id="dd-pause-settings"></div>
    </div>
    <div class="dd-actions">
      <button type="button" class="dd-btn" id="dd-resume-btn">REPRENDRE</button>
      <button type="button" class="dd-btn-sec" id="dd-pause-menu-btn">QUITTER AU LOBBY</button>
    </div>
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
let durationButtons = [];
let difficultyButtons = [];

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
  refs.phasePill = find('#dd-phase-pill');
  refs.aimText = find('#dd-aim-text');
  refs.aimFill = find('#dd-aim-fill');
  refs.menuBest = find('#dd-menu-best');
  refs.loading = find('#dd-loading');
  refs.loadingFill = find('#dd-loading-fill');
  refs.loadingLabel = find('#dd-loading-label');
  refs.env = find('#dd-env');
  refs.duration = find('#dd-duration');
  refs.difficulty = find('#dd-difficulty');
  refs.menuSettings = find('#dd-menu-settings');
  refs.pauseSettings = find('#dd-pause-settings');
  ['reason', 'result', 'score', 'goals', 'accuracy', 'duels', 'combo', 'best', 'stars'].forEach((name) => {
    refs['go' + name] = find('#dd-go-' + name);
  });
  screens.menu = find('#dd-menu');
  screens.gameover = find('#dd-gameover');
  screens.pause = find('#dd-pause');

  find('#dd-start-btn').addEventListener('click', () => callbacks.onStart());
  find('#dd-replay-btn').addEventListener('click', () => callbacks.onStart());
  find('#dd-menu-btn').addEventListener('click', () => {
    if (typeof callbacks.onMenu === 'function') callbacks.onMenu();
    else showMenu();
  });
  find('#dd-resume-btn').addEventListener('click', () => callbacks.onResume());
  find('#dd-pause-menu-btn').addEventListener('click', () => {
    if (typeof callbacks.onMenu === 'function') callbacks.onMenu();
    else showMenu();
  });

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

// stats: { score, goals, conceded, minute, combo, multiplier, level, themeName, phaseLabel, isShotPhase }
export function updateHUD(stats) {
  refs.score.textContent = String(stats.score);
  refs.goals.textContent = String(stats.goals);
  refs.conceded.textContent = String(stats.conceded);
  refs.clock.textContent = stats.minute + "'";
  refs.level.textContent = 'NIVEAU ' + stats.level;
  refs.theme.textContent = stats.themeName;
  if (refs.phasePill && stats.phaseLabel) {
    refs.phasePill.textContent = stats.phaseLabel;
    refs.phasePill.classList.toggle('dd-shot-ready', Boolean(stats.isShotPhase));
  }
  if (stats.combo >= 1) {
    const isOnFire = stats.combo >= ON_FIRE_COMBO;
    refs.combo.textContent = (isOnFire ? '🔥 EN FEU · ' : 'COMBO ') + 'x' + stats.multiplier.toFixed(2);
    refs.combo.classList.add('dd-active');
    refs.combo.classList.toggle('dd-fire', isOnFire);
  } else {
    refs.combo.classList.remove('dd-active', 'dd-fire');
  }
}

export function showPopup(text, kind) {
  const element = document.createElement('div');
  element.className = 'dd-popup dd-popup-' + (kind || 'good');
  element.textContent = text;
  popupLayer.appendChild(element);
  setTimeout(() => element.remove(), 1300);
}

export function showBanner(text, kind) {
  refs.banner.className = '';
  void refs.banner.offsetWidth;
  refs.banner.textContent = text;
  refs.banner.className = 'dd-banner-show dd-b-' + kind;
}

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
  refs.gogoals.textContent = stats.topCorners > 0
    ? stats.goals + ' (' + stats.topCorners + ')'
    : String(stats.goals);
  refs.goaccuracy.textContent = (stats.shots > 0 ? Math.round((stats.shotsOnTarget / stats.shots) * 100) : 0) + '%';
  refs.goduels.textContent = String(stats.duels);
  refs.gocombo.textContent = 'x' + (stats.bestMultiplier || 1).toFixed(2);
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

const ENV_ICONS = ['☀️ ', '🌅 ', '🌙 '];

export function setEnvironment(index, names) {
  if (!refs.env || !Array.isArray(names)) return;
  if (envButtons.length !== names.length) {
    refs.env.textContent = '';
    envButtons = names.map((name, buttonIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (ENV_ICONS[buttonIndex] || '') + name;
      button.addEventListener('click', () => {
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

export function setMatchOptions(durationIndex, difficultyIndex, onSelectDuration, onSelectDifficulty) {
  if (refs.duration && durationButtons.length === 0) {
    MATCH_DURATION_PRESETS.forEach((preset, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => onSelectDuration(idx));
      refs.duration.appendChild(btn);
      durationButtons.push(btn);
    });
  }
  durationButtons.forEach((btn, idx) => btn.classList.toggle('dd-active', idx === durationIndex));

  if (refs.difficulty && difficultyButtons.length === 0) {
    DIFFICULTY_PRESETS.forEach((preset, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => onSelectDifficulty(idx));
      refs.difficulty.appendChild(btn);
      difficultyButtons.push(btn);
    });
  }
  difficultyButtons.forEach((btn, idx) => btn.classList.toggle('dd-active', idx === difficultyIndex));
}

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

const audioControls = [];

export function initAudioSettingsUI(initialSettings, voiceStatus, onChange) {
  const containers = [refs.menuSettings, refs.pauseSettings].filter(Boolean);
  audioControls.length = 0;

  const statusText = !voiceStatus.supported
    ? 'Synthèse vocale non supportée par ce navigateur.'
    : !voiceStatus.hasFrenchVoice
      ? 'Aucune voix française détectée (effets sonores actifs).'
      : 'Voix : ' + voiceStatus.voiceName;

  containers.forEach((container) => {
    container.innerHTML = `
      <div class="dd-setting-row">
        <span>Commentateur français</span>
        <button type="button" class="dd-toggle" data-role="toggle"></button>
      </div>
      <div class="dd-setting-row">
        <span>Volume commentaires</span>
        <input type="range" min="0" max="1" step="0.05" data-role="commVol">
      </div>
      <div class="dd-setting-row">
        <span>Volume effets & foule</span>
        <input type="range" min="0" max="1" step="0.05" data-role="sfxVol">
      </div>
      <div class="dd-voice-note" data-role="note"></div>
    `;

    const toggle = container.querySelector('[data-role="toggle"]');
    const commVol = container.querySelector('[data-role="commVol"]');
    const sfxVol = container.querySelector('[data-role="sfxVol"]');
    const note = container.querySelector('[data-role="note"]');
    note.textContent = statusText;

    toggle.addEventListener('click', () => {
      const next = onChange({ enabled: !toggle.classList.contains('dd-on') });
      syncAudioSettingsUI(next);
    });
    commVol.addEventListener('input', () => {
      const next = onChange({ volume: Number(commVol.value) });
      syncAudioSettingsUI(next);
    });
    sfxVol.addEventListener('input', () => {
      const next = onChange({ sfxVolume: Number(sfxVol.value) });
      syncAudioSettingsUI(next);
    });

    audioControls.push({ toggle, commVol, sfxVol, note });
  });

  syncAudioSettingsUI(initialSettings);
}

export function syncAudioSettingsUI(settings, voiceStatus) {
  audioControls.forEach((ctrl) => {
    ctrl.toggle.classList.toggle('dd-on', settings.enabled);
    ctrl.toggle.textContent = settings.enabled ? 'ACTIVÉ' : 'COUPÉ';
    ctrl.commVol.value = String(settings.volume);
    ctrl.sfxVol.value = String(settings.sfxVolume);
    if (voiceStatus) {
      ctrl.note.textContent = !voiceStatus.supported
        ? 'Synthèse vocale non supportée par ce navigateur.'
        : !voiceStatus.hasFrenchVoice
          ? 'Aucune voix française détectée (effets sonores actifs).'
          : 'Voix : ' + voiceStatus.voiceName;
    }
  });
}
