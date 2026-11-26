// commentaryData.js - centralized French commentary lines, priorities and cooldowns.
// All user-facing spoken text lives here (no scattered strings in gameplay code).

export const COMMENTARY_STORAGE_KEY = 'dribbleDashAudioSettings';
export const COMMENTARY_AUDIO_MANIFEST = 'assets/audio/commentary/manifest.json';

// Priority levels: higher number can interrupt lower priority if interruptible.
export const PRIORITY = {
  FILLER: 1,
  ACTION: 2,
  HIGHLIGHT: 3,
  CRITICAL: 4
};

// Event configuration: priority, per-event cooldown (ms), stale expiry (ms),
// speech rate/pitch, and French phrase templates ({scoreDiff}, {combo}, {level}, {env}).
export const COMMENTARY_EVENTS = {
  kickoff: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 8000,
    maxAgeMs: 4000,
    rate: 1.06,
    pitch: 1.04,
    lines: [
      "C'est parti ! Coup d'envoi de cette rencontre sous {env} !",
      "L'arbitre siffle, le match commence ! À vous de faire la différence.",
      "Coup d'envoi ! Quatre défenseurs à effacer avant de tenter sa chance."
    ]
  },
  dribble: {
    priority: PRIORITY.FILLER,
    cooldownMs: 9000,
    maxAgeMs: 1800,
    rate: 1.08,
    pitch: 1.04,
    lines: [
      'Bien joué, il passe !',
      'Le crochet passe proprement.',
      'Il efface son vis-à-vis avec maîtrise.',
      'Côté libre, il accélère !'
    ]
  },
  perfectDribble: {
    priority: PRIORITY.ACTION,
    cooldownMs: 6500,
    maxAgeMs: 2200,
    rate: 1.12,
    pitch: 1.1,
    lines: [
      'Oh le dribble au millimètre !',
      'Magnifique feinte, le défenseur est dans le vent !',
      'Quel geste technique, il frôle le tacle !',
      'Superbe prise de risque, ça passe !'
    ]
  },
  jumpDodge: {
    priority: PRIORITY.ACTION,
    cooldownMs: 6500,
    maxAgeMs: 2200,
    rate: 1.12,
    pitch: 1.1,
    lines: [
      'Il saute par-dessus le tacle !',
      'Quel réflexe pour éviter la faute !',
      'Saut parfait au-dessus du défenseur !'
    ]
  },
  combo: {
    priority: PRIORITY.ACTION,
    cooldownMs: 11000,
    maxAgeMs: 2500,
    rate: 1.12,
    pitch: 1.12,
    lines: [
      'Série en cours ! Multiplicateur à {combo} !',
      'Il est en confiance, déjà {combo} de multiplicateur !',
      'Quelle dynamique, le public pousse !'
    ]
  },
  tackle: {
    priority: PRIORITY.FILLER,
    cooldownMs: 12000,
    maxAgeMs: 1400,
    rate: 1.1,
    pitch: 1.02,
    lines: [
      'Attention au tacle glissé !',
      'Le défenseur se jette !',
      'Gros tacle devant la surface !'
    ]
  },
  block: {
    priority: PRIORITY.FILLER,
    cooldownMs: 12000,
    maxAgeMs: 1400,
    rate: 1.08,
    pitch: 1.0,
    lines: [
      'Le défenseur ferme le couloir !',
      'Blocage solide devant lui !',
      'Il tente de lui barrer la route !'
    ]
  },
  fall: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 5000,
    maxAgeMs: 3000,
    rate: 1.05,
    pitch: 0.94,
    lines: [
      'Aïe, il se fait prendre le ballon !',
      'Intervention décisive du défenseur, contre-attaque adverse !',
      'Tacle réussi, balle perdue dans la zone dangereuse !'
    ]
  },
  shot: {
    priority: PRIORITY.ACTION,
    cooldownMs: 3500,
    maxAgeMs: 1500,
    rate: 1.18,
    pitch: 1.12,
    lines: [
      'La frappe !',
      'Il arme et il tire !',
      'Coup de canon vers le but !',
      'Tentative directe !'
    ]
  },
  goal: {
    priority: PRIORITY.CRITICAL,
    cooldownMs: 2000,
    maxAgeMs: 5000,
    rate: 1.16,
    pitch: 1.18,
    lines: [
      'Buuuut ! Quel finish au fond des filets !',
      'Oui, c\'est au fond ! Le gardien ne peut rien faire !',
      'But magnifique ! Le stade explose !',
      'Quelle frappe imparable, ça fait mouche !'
    ]
  },
  save: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 3500,
    maxAgeMs: 3500,
    rate: 1.08,
    pitch: 1.02,
    lines: [
      'Quel arrêt du gardien !',
      'La parade décisive sur sa ligne !',
      'Le portier s\'interpose avec autorité !',
      'Non, le gardien repousse cette tentative !'
    ]
  },
  post: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 3500,
    maxAgeMs: 3500,
    rate: 1.12,
    pitch: 1.08,
    lines: [
      'Oh le poteau ! À quelques centimètres près !',
      'Le montant sauve le gardien !',
      'Ça rebondit sur le poteau, quel frisson !'
    ]
  },
  crossbar: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 3500,
    maxAgeMs: 3500,
    rate: 1.12,
    pitch: 1.08,
    lines: [
      'La barre transversale ! Incroyable !',
      'Ça heurte la transversale, le stade retient son souffle !',
      'Trop haut d\'un rien, sur la barre !'
    ]
  },
  miss: {
    priority: PRIORITY.ACTION,
    cooldownMs: 4500,
    maxAgeMs: 3000,
    rate: 1.04,
    pitch: 0.96,
    lines: [
      'C\'est hors cadre, quelle occasion manquée !',
      'Le ballon passe à côté du but.',
      'Il manque le cadre sur cette frappe.'
    ]
  },
  levelUp: {
    priority: PRIORITY.FILLER,
    cooldownMs: 14000,
    maxAgeMs: 3000,
    rate: 1.06,
    pitch: 1.05,
    lines: [
      'Niveau {level} ! La défense monte en intensité.',
      'Attention, niveau {level}, les défenseurs accélèrent.'
    ]
  },
  closeScore: {
    priority: PRIORITY.ACTION,
    cooldownMs: 20000,
    maxAgeMs: 4000,
    rate: 1.06,
    pitch: 1.04,
    lines: [
      'Match très serré, tout reste ouvert !',
      'Égalité parfaite, chaque duel compte maintenant.'
    ]
  },
  lastMinute: {
    priority: PRIORITY.HIGHLIGHT,
    cooldownMs: 30000,
    maxAgeMs: 5000,
    rate: 1.12,
    pitch: 1.08,
    lines: [
      'Dernières minutes du match ! Il faut tout donner !',
      'On entre dans le money time, plus que quelques instants !'
    ]
  },
  finalWhistle: {
    priority: PRIORITY.CRITICAL,
    cooldownMs: 4000,
    maxAgeMs: 6000,
    rate: 1.02,
    pitch: 1.0,
    lines: [
      'Coup de sifflet final ! {scoreText}',
      'C\'est terminé ! {scoreText}'
    ]
  },
  recordBroken: {
    priority: PRIORITY.CRITICAL,
    cooldownMs: 10000,
    maxAgeMs: 6000,
    rate: 1.08,
    pitch: 1.12,
    lines: [
      'Nouveau record personnel battu ! Quelle performance !',
      'Historique ! Vous établissez un nouveau record !'
    ]
  }
};
