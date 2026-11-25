# PROGRESS_AGENT.md — Dribble Dash 1v1

Mis à jour automatiquement après chaque section terminée.  
Toujours lire ce fichier EN PREMIER lors d'une reprise.

## HANDOFF

- **État actuel :** Tier 1 (1a + 1b) terminé ; démarrage du Tier 2 (performance et robustesse).
- **Vérifié par Tier 0 :**
  - `goalMath.js`, `mirrorClip`, `SkeletonUtils`, `AnimationMixer` : vérifiés dans le code.
- **Décisions Tier 1a :**
  - `Strike Foward Jog.fbx` mappé sur `strikeJog` (`src/assets.js`), utilisé pour les tirs en course (`aimTime <= 1.0s`).
  - Mesure `FBXLoader` (`mixamorigRightFoot`) : pic à `t = 0.42s` (`vz = 1038.9 cm/s`), `startTime: 0.14s`, `speed: 1.30` → `0.215s` via `getClipContactDelay()`.
  - `Kick Soccerball.fbx` (`kick`, `contactTime: 0.28s`) utilisé pour les frappes à l'arrêt (`aimTime > 1.0s`). `EXTRA_CLIP_FILES` vide.
- **Décisions Tier 1b :**
  - `src/commentaryData.js` : phrases françaises, priorités, cooldowns, expiration, manifeste optionnel `assets/audio/commentary/manifest.json`.
  - `src/commentary.js` : `createCommentaryManager()`, Web Speech API (`fr-FR` préféré), file de priorité, interruption par événements critiques (but), ducking foule (`setCrowdDuck` dans `src/audio.js`), réglages persistés (`dribbleDashAudioSettings`).
  - `src/ui.js` : panneau `AUDIO & COMMENTAIRES` dans menu principal et pause. Test unitaire Node passé.
- **Checklist des Tiers :**
  - [x] **Tier 0** : Audit et vérification réelle.
  - [x] **Tier 1a** : Tir avec `Strike Foward Jog.fbx` + mesure contact (`0.42s`) + synchro balle + décision `Kick Soccerball`.
  - [x] **Tier 1b** : Commentateur vocal français (`CommentaryManager` + Web Speech API + mix audio `audio.js` + réglages).
  - [ ] **Tier 2** : Performance et robustesse (bundle splitting >500KB, qualité adaptative, allocations, fuites mémoire).
  - [ ] **Tier 3** : Qualité d'animation et gameplay feel (vitesse de course synchronisée, buffering d'entrée, transitions).
  - [ ] **Tier 4** : Polish graphique (pelouse, ballon, stade, particules, caméra).
  - [ ] **Tier 5** : UX/UI, réglages/pause, mobile, finitions audio.
- **Prochaine action exacte :** Configurer `vite.config.js` pour supprimer l'avertissement >500KB (`manualChunks` pour `three`), ajouter le moniteur de qualité adaptative dans `main.js`/`world.js`, et vérifier les allocations/fuites.
- **Comment reprendre :** Lire ce `HANDOFF`, lancer `npm run build`, puis exécuter le prochain élément non coché.

---

## ✅ TERMINÉ — Session précédente (agent inconnu)

### Section 3 — Gameplay et collisions
- **3.1 Goal dimensions** : `goalMath.js` créé. Fonction unique `classifyGoalPoint(x, y, radius)`.
  Distingue GOAL, POST, BAR, MISS, SAVE. Ball radius pris en compte. Frame visible = frame de collision.
  Paramètres `POST_RADIUS`, `CROSSBAR_RADIUS`, `BALL_RADIUS`, `GOAL_WIDTH`, `GOAL_HEIGHT` dans `config.js`.
- **3.2 Réticule** : Taille constante (`RETICLE_SIZE`). Vitesse croissante par niveau (`RETICLE_SPEED_PER_LEVEL`).
  Deux patterns de mouvement alternés. Couleur dérivée de `classifyGoalPoint()` (cyan = valide, rouge = hors cadre).
- **3.3 Gardien** : `planKeeperSave()` dans `goalMath.js`. `predictBallAtZ()` pour prédire la trajectoire.
  Zone centrale (`KEEPER_CENTRAL_RADIUS`) → pas de plongeon latéral (prise/blocage).
  Shot latéral → plongeon du bon côté. Erreur de lecture bornée (`KEEPER_READ_ERROR_MAX`).
- **3.4 Interactions** : Swept-box collision défenseur (évite les tunnelling à haute vitesse).
  Balle suit les pieds réels via `getActorFeet()`. Contact visuel défenseur (`markDefenderContact()`).
  Balle réagit selon outcome (goal = rebond filet, save = dégagement, poteau = rebond latéral, barre = rebond bas).

### Section 4 — Personnages et animations Mixamo FBX
- **4.1 Pipeline** : FBXLoader direct, pas de Blender, pas de GLB. `assets.js`.
- **4.2 Manifeste** : `CLIP_DEFINITIONS` dans `assets.js`. UN SEUL manifeste pour tout le projet.
  Toutes les 17 animations référencées. Aucun nom de clip en dur ailleurs.
- **4.3 Vérification** : Validation os via `collectBones()` / `validateClip()`. Scale calculé depuis hauteur en cm.
  Root motion neutralisé sur X/Z (`neutraliseRootMotion()`). `trimEnd` pour clips one-shot.
- **4.4 Architecture** : Cache FBX (`fileCache` Map). `SkeletonUtils.clone()` pour les instances.
  Un `AnimationMixer` par personnage. Bibliothèque de clips partagée.
  Fallback procédural si FBX absent.
- **4.5 Mapping sémantique** :
  - Soccer Trip = chute du joueur taclé (JAMAIS l'animateur du défenseur qui tactle).
  - Kick Soccerball = tir (pas interception simple).
  - Defender block = `Goalkeeper Body Block.fbx` trimé à 0.55s (⚠️ PENDING VISUAL VALIDATION).
- **4.6 Mirroring** : `mirrorClip()` dans `assets.js`. Cache WeakMap. Left↔Right + position X inversé + quaternion.
- **4.7 Dev viewer** : `devViewer.js`. Activé par `?dev=viewer`. Lecture/pause/miroir/vitesse/scrub.
- **4.8 Fallback** : Personnages procéduraux (`characters.js`) si FBX absent. Log précis des assets manquants.

### Section 5 — Foule et stade
- InstancedMesh conservé (bodies, heads, arms, **scarves** ajoutés par cette session).
- 3 poses : assis-sway (25%), debout-bob (35%), bras-toujours-levés (25%), restant aléatoire.
- Animation par slices (1/3 par frame). Bras levés quand excitement > 0.35 ou pose fixe.
- Écharpes colorées (4ème InstancedMesh). Maillot 8 couleurs, peaux 4 teintes.
- Proportions : corps 0.52×0.76, tête rayon 0.19 (plus réaliste).

### Section 6 — Filet du but
- Géométrie subdivisée (40×16 segments). Déformation centrée sur le vrai point d'impact.
- Oscillation amortie (`NET_DAMPING`, `NET_FREQUENCY`). Pas de déformation permanente.
- Buffers réutilisés. Mise à jour uniquement des vertices dans le rayon d'impact.

### Section 7 — Éclairage et environnements
- Sélection pré-match Jour/Coucher/Nuit fixe pendant 90 minutes.
- Sky GLSL shader (gradient, nuages, étoiles, soleil/lune).
- Lamps calibrées par thème (`lamp` dans THEMES). Bloom, exposure, vignette adaptés.
- `setTheme(index, immediate)` pour snap instantané au kick-off.

### Section 8 — UI/UX
- Tout en français. HUD : score/niveau (haut-gauche), scoreboard/horloge/combo (haut-centre), record/environnement (haut-droit).
- Popups, banners animés, flash écran, hint de visée avec barre de temps, barre de chargement assets.
- Sélecteur d'environnement dans le menu. Écran game-over avec stats complètes.

### Section 9 — Performance
- Aucune allocation (new Vector3, etc.) dans la boucle d'animation.
- Vecteurs temporaires réutilisés (footLeft, footRight, kickOrigin, dribbleTarget, dummy, etc.).
- Options cross-fade statiques (TRIP_OPTIONS, KICK_OPTIONS, etc.).
- Crowd mis à jour en 1/3 par frame. Stats dev désactivées en prod (`?stats=1`).

---

## ⚠️ VALIDATIONS VISUELLES REQUISES (humain)

Ces éléments sont implémentés mais nécessitent une inspection à l'œil dans le jeu ou le viewer :

1. **Defender block** : `Goalkeeper Body Block.fbx` trimé à 0.55s.
   → Ouvrir `?dev=viewer`, sélectionner `block`, vérifier la posture de blocage.
2. **Mirroring Side Step / Goalkeeper Sidestep / Goalkeeper Diving Save**
   → Dans le viewer, activer le bouton MIROIR pour chaque clip directionnel.
3. **Kick Soccerball vs Strike Foward Jog**
   → Comparer dans le viewer pour choisir l'animation de tir la plus fluide en run.
4. **Soccer Trip** : vérifier que c'est bien la chute du joueur et non le tackle.
5. **Dribble ball-follow** : la balle doit sembler coller au pied avant sans flotter.

---

## 🔧 CE QUI RESTE À FAIRE (si quota disponible)

- [x] ~~Section 3~~ — terminé
- [x] ~~Section 4~~ — terminé
- [x] ~~Section 5 (foule)~~ — amélioré (session courante)
- [x] ~~Section 6~~ — terminé
- [x] ~~Section 7~~ — terminé
- [x] ~~Section 8~~ — terminé
- [x] ~~Section 9~~ — terminé
- [x] ~~PROGRESS_AGENT.md~~ — créé (session courante)

**Aucune section critique ne reste bloquée.**

---

## 🐛 PROBLÈMES CONNUS

- Chunk JS > 500 KB (avertissement Vite non-bloquant, lié à Three.js lui-même).
- Les assets FBX ne peuvent pas être testés à la compilation ; ils nécessitent un vrai navigateur.
- L'animation `block` pour le défenseur est en attente de validation visuelle.

---

## 📂 FICHIERS MODIFIÉS / CRÉÉS PAR LES AGENTS

| Fichier | Rôle | Modifié par |
|---|---|---|
| `src/config.js` | Toutes les constantes | Session précédente |
| `src/goalMath.js` | Géométrie but + gardien | Session précédente |
| `src/assets.js` | Pipeline FBX + cache | Session précédente |
| `src/actor.js` | Interface character (rig + procédural) | Session précédente |
| `src/devViewer.js` | Viewer d'animation dev | Session précédente |
| `src/main.js` | Boucle principale + asset loading | Session précédente |
| `src/goal.js` | But + filet + réticule + gardien | Session précédente |
| `src/player.js` | Joueur + inputs | Session précédente |
| `src/defender.js` | Défenseur + IA | Session précédente |
| `src/ball.js` | Balle + dribble + tir | Session précédente |
| `src/world.js` | Stade + foule + environnements | Session précédente + **session courante** |
| `src/ui.js` | HUD + menus | Session précédente |
| `src/audio.js` | Sons procéduraux | Session précédente |
| `src/postfx.js` | Post-processing | Session précédente |
| `src/characters.js` | Personnages procéduraux | Session précédente |
| `PROGRESS_AGENT.md` | Ce fichier | **Session courante** |

---

## 🗓️ DERNIÈRE MISE À JOUR

Session courante (Claude Sonnet 4.6 Thinking) — 2026-11-25
- Foule améliorée : proportions, 3 poses, écharpes, bras levés selon excitement.
- PROGRESS_AGENT.md créé.
- Build : ✅ `npm run build` — 0 erreur, 37 modules.
