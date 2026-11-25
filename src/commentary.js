// commentary.js - French spoken commentary using Web Speech API (with optional
// pre-recorded audio clip manifest override).
//
// Architecture:
// - Asynchronous voice discovery (`voiceschanged`) preferring high-quality fr-FR voices.
// - Single active utterance at a time; priority queue with per-event cooldowns and
//   stale-event expiration so commentary never floods or lags behind gameplay.
// - Higher priority events (e.g. GOAL) can interrupt lower priority filler.
// - Integrates with audio.js ducking so crowd ambience lowers during speech.
import {
  COMMENTARY_EVENTS, COMMENTARY_STORAGE_KEY, COMMENTARY_AUDIO_MANIFEST, PRIORITY
} from './commentaryData.js';

const MAX_RECENT_PHRASES = 6;
const GLOBAL_GAP_MS = 1100;

function readSettings() {
  try {
    const raw = window.localStorage.getItem(COMMENTARY_STORAGE_KEY);
    if (!raw) return { enabled: true, volume: 0.9, sfxVolume: 0.8 };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.9,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 0.8
    };
  } catch (error) {
    return { enabled: true, volume: 0.9, sfxVolume: 0.8 };
  }
}

function writeSettings(settings) {
  try {
    window.localStorage.setItem(COMMENTARY_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Storage unavailable: keep in-memory settings only.
  }
}

function rankFrenchVoice(voice) {
  const lang = (voice.lang || '').toLowerCase();
  if (!lang.startsWith('fr')) return -1;
  let score = lang === 'fr-fr' ? 20 : 10;
  const name = (voice.name || '').toLowerCase();
  if (name.includes('natural')) score += 15;
  if (name.includes('online')) score += 10;
  if (name.includes('google')) score += 8;
  if (name.includes('microsoft')) score += 6;
  if (voice.localService) score += 2;
  return score;
}

function formatLine(template, context) {
  if (!context) return template;
  const envMap = {
    JOUR: 'le soleil',
    'COUCHER DE SOLEIL': 'le coucher de soleil',
    NUIT: 'les projecteurs'
  };
  return template
    .replace('{env}', envMap[context.env] || 'le stade')
    .replace('{combo}', context.combo ? 'x' + context.combo.toFixed(2) : '')
    .replace('{level}', context.level ? String(context.level) : '')
    .replace('{scoreText}', context.scoreText || '');
}

export function createCommentaryManager(options = {}) {
  const onSpeakingChange = typeof options.onSpeakingChange === 'function'
    ? options.onSpeakingChange
    : () => {};

  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;

  const settings = readSettings();
  const cooldowns = new Map();
  const recentLines = [];
  const queue = [];

  let selectedVoice = null;
  let hasFrenchVoice = false;
  let unlocked = false;
  let speaking = false;
  let currentPriority = 0;
  let lastSpokenAt = -GLOBAL_GAP_MS;
  let activeAudio = null;
  let audioManifest = null;
  let processTimer = null;

  // Optional pre-recorded clip manifest (never required, silently ignored if absent).
  if (typeof fetch === 'function') {
    fetch(COMMENTARY_AUDIO_MANIFEST)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && typeof data === 'object') audioManifest = data; })
      .catch(() => {});
  }

  function refreshVoices() {
    if (!synth) return;
    const voices = synth.getVoices() || [];
    let best = null;
    let bestScore = -1;
    for (const voice of voices) {
      const score = rankFrenchVoice(voice);
      if (score > bestScore) {
        bestScore = score;
        best = voice;
      }
    }
    selectedVoice = best;
    hasFrenchVoice = Boolean(best);
  }

  if (synth) {
    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
    } else {
      synth.onvoiceschanged = refreshVoices;
    }
  }

  function setSpeaking(isNowSpeaking) {
    if (speaking === isNowSpeaking) return;
    speaking = isNowSpeaking;
    onSpeakingChange(isNowSpeaking);
  }

  function pickLine(eventName, context) {
    const def = COMMENTARY_EVENTS[eventName];
    if (!def || !def.lines.length) return null;
    const candidates = def.lines.filter((line) => !recentLines.includes(line));
    const pool = candidates.length > 0 ? candidates : def.lines;
    const raw = pool[Math.floor(Math.random() * pool.length)];
    recentLines.push(raw);
    if (recentLines.length > MAX_RECENT_PHRASES) recentLines.shift();
    return formatLine(raw, context);
  }

  function finishCurrent() {
    currentPriority = 0;
    lastSpokenAt = performance.now();
    setSpeaking(false);
    scheduleProcess(120);
  }

  function playPreRecorded(eventName) {
    if (!audioManifest || !audioManifest[eventName]) return false;
    const list = Array.isArray(audioManifest[eventName])
      ? audioManifest[eventName]
      : [audioManifest[eventName]];
    if (!list.length) return false;
    const src = list[Math.floor(Math.random() * list.length)];
    try {
      const audio = new Audio(src);
      audio.volume = settings.volume;
      activeAudio = audio;
      setSpeaking(true);
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
        finishCurrent();
      };
      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        finishCurrent();
      };
      audio.play().catch(() => {
        activeAudio = null;
        finishCurrent();
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  function speakItem(item) {
    const def = COMMENTARY_EVENTS[item.eventName];
    currentPriority = def.priority;

    if (playPreRecorded(item.eventName)) return;
    if (!synth || !hasFrenchVoice || typeof SpeechSynthesisUtterance === 'undefined') {
      currentPriority = 0;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice ? selectedVoice.lang : 'fr-FR';
    utterance.volume = settings.volume;
    const jitter = (Math.random() - 0.5) * 0.05;
    utterance.rate = Math.max(0.85, Math.min(1.35, def.rate + jitter));
    utterance.pitch = Math.max(0.85, Math.min(1.3, def.pitch + jitter));

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = finishCurrent;
    utterance.onerror = finishCurrent;

    try {
      setSpeaking(true);
      synth.speak(utterance);
    } catch (error) {
      finishCurrent();
    }
  }

  function scheduleProcess(delayMs) {
    if (processTimer !== null) return;
    processTimer = window.setTimeout(() => {
      processTimer = null;
      processQueue();
    }, delayMs);
  }

  function processQueue() {
    if (!settings.enabled || !unlocked || speaking || queue.length === 0) return;
    const now = performance.now();

    // Drop stale lines whose moment has passed.
    while (queue.length > 0 && now - queue[0].timestamp > queue[0].maxAgeMs) {
      queue.shift();
    }
    if (queue.length === 0) return;

    const next = queue[0];
    if (next.priority < PRIORITY.CRITICAL && now - lastSpokenAt < GLOBAL_GAP_MS) {
      scheduleProcess(GLOBAL_GAP_MS - (now - lastSpokenAt));
      return;
    }

    queue.shift();
    speakItem(next);
  }

  function cancelSpeech() {
    queue.length = 0;
    if (processTimer !== null) {
      window.clearTimeout(processTimer);
      processTimer = null;
    }
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (synth) {
      try { synth.cancel(); } catch (error) { /* ignore */ }
    }
    currentPriority = 0;
    setSpeaking(false);
  }

  function trigger(eventName, context) {
    if (!settings.enabled || !unlocked) return;
    const def = COMMENTARY_EVENTS[eventName];
    if (!def) return;

    const now = performance.now();
    const nextAllowed = cooldowns.get(eventName) || 0;
    if (now < nextAllowed) return;

    const text = pickLine(eventName, context);
    if (!text) return;

    cooldowns.set(eventName, now + def.cooldownMs);

    // Higher-priority event (e.g. GOAL) can interrupt lower-priority filler.
    if (speaking && def.priority > currentPriority && def.priority >= PRIORITY.HIGHLIGHT) {
      cancelSpeech();
    }

    queue.push({
      eventName,
      text,
      priority: def.priority,
      timestamp: now,
      maxAgeMs: def.maxAgeMs
    });
    // Keep highest priority first, preserving FIFO within same priority.
    queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    if (queue.length > 3) queue.length = 3;

    processQueue();
  }

  function unlock() {
    unlocked = true;
    if (synth) refreshVoices();
  }

  function getSettings() {
    return { ...settings };
  }

  function updateSettings(patch) {
    if (typeof patch.enabled === 'boolean') {
      settings.enabled = patch.enabled;
      if (!settings.enabled) cancelSpeech();
    }
    if (typeof patch.volume === 'number') {
      settings.volume = Math.max(0, Math.min(1, patch.volume));
    }
    if (typeof patch.sfxVolume === 'number') {
      settings.sfxVolume = Math.max(0, Math.min(1, patch.sfxVolume));
    }
    writeSettings(settings);
    return getSettings();
  }

  function getStatus() {
    return {
      supported: Boolean(synth),
      hasFrenchVoice,
      voiceName: selectedVoice ? selectedVoice.name : null
    };
  }

  function dispose() {
    cancelSpeech();
    if (synth && typeof synth.removeEventListener === 'function') {
      synth.removeEventListener('voiceschanged', refreshVoices);
    }
  }

  return {
    trigger,
    unlock,
    cancel: cancelSpeech,
    getSettings,
    updateSettings,
    getStatus,
    dispose
  };
}
