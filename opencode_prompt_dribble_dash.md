# PROJECT: DRIBBLE DASH 1v1 — GAMEPLAY FIXES, RIGGED MIXAMO CHARACTERS, ANIMATIONS, VISUAL UPGRADE

Act as a senior Three.js/WebGL game developer, gameplay programmer, technical artist and software architect.

Improve the existing **Dribble Dash 1v1** game. It is an existing project, NOT a greenfield project: do not rebuild it, do not remove working features, do not rewrite the whole project.

Goals: a noticeably more realistic, polished and responsive football-game experience, with excellent runtime performance.

## 0. HOW TO WORK (IMPORTANT)

### 0.1 READING GATE — MANDATORY FIRST STEP
This file (`opencode_prompt_dribble_dash.md`, at the project root) contains ALL the instructions. Before doing ANYTHING else:
1. Read the file **completely, to the very last line**. It is long: if your read tool truncates or paginates, keep reading the following ranges until you reach the final line `=== END OF INSTRUCTIONS FILE ===`.
2. Do NOT run any command, do NOT edit, create or delete any file, do NOT start the audit until the whole file has been read.
3. Then reply with ONLY this confirmation message, in French:
   - "J'ai lu le fichier jusqu'à la fin" and quote the final marker line exactly;
   - a short summary of your understanding (max 12 lines): the goal, the 3 gameplay bugs, the asset pipeline decision (FBX direct, no Blender), the two Soccer Trip / Kick Soccerball distinctions, the mirroring requirement, the single-run rule and the final report;
   - any point you did not understand or find ambiguous (or "Aucune ambiguïté").
4. Then STOP and wait for my message "GO". Only after "GO" start the work described below.

### 0.2 EXECUTION RULES (after "GO")

- **Do the ENTIRE job in one single run, from start to finish, without stopping to ask me anything and without waiting for my confirmation.** Do not stop after a phase. Do not ask me to test between steps.
- Follow the order of section 13 internally (audit → gameplay → characters/animations → visuals → UI → final checks), but chain all steps yourself.
- Run `git status` first. Never discard, overwrite or revert existing user changes. Do not touch unrelated files.
- Never invent file names, clip names, bone names or APIs. Inspect the real files and the real code first.
- Between steps, only run `npm run build` yourself to keep the app compiling; fix errors on your own.
- Stop only if you are truly blocked (missing file that cannot be replaced by a fallback). In that case, state exactly what is missing, then continue with everything else.
- At the very end, give ONE final report (section 13). Do not claim anything is done or tested unless you really implemented it or ran the command.

## 1. PROJECT CONTEXT

- JavaScript ES modules, **Three.js 0.160.0** (do not upgrade), Vite (see `package.json`).
- Files in `src/`: `main.js`, `config.js`, `world.js`, `player.js`, `characters.js`, `defender.js`, `ball.js`, `goal.js`, `ui.js`, `audio.js`, `postfx.js`; plus `index.html`, `package.json`.
- Current characters are procedural primitives. The stadium and crowd are procedural (crowd already uses InstancedMesh: keep this optimization).
- Verify all of this against the actual local code; the repo may have changed.

Current gameplay (preserve it):
- Three lanes. Controls: Q/D or Left/Right arrows to move; Space, click or Up arrow to jump AND shoot.
- Two defenders per level (usually) advance toward the player. A defender either does a **sliding tackle** or a **standing block/interception** (no tackle). Beating both defenders leads to the shooting phase against the goalkeeper.
- Shooting: a moving circle/reticle (same size as the ball) moves in/out of the goal frame; the shot must catch it inside the frame.
- A match timer runs regardless of success or failure. Goal for the player = point for the player; ball intercepted = point for the opponent. After a failure the next attempt starts.
- HUD: top-left score + level; top-center scoreboard + match clock + small combo (e.g. 1.25); top-right best score + environment/time of day.
- Score depends on dribbles succeeded and goals scored; level increases during the match (faster defenders, less stable defenders that leave their lane).
- Preserve: best-score persistence, sound effects, menu, game-over behavior, scoring and match rules. Do not silently change them. Do not simplify to a game with one defender.

## 2. FIRST: AUDIT (STEP 0, internal — no edits during the audit)

Inspect the complete repository and write a concise audit (keep it in your final report; do not stop after it):
1. Architecture and module responsibilities.
2. Game states and transitions.
3. Controls.
4. Player, ball, defender and goalkeeper implementations.
5. Collision calculations and hitboxes.
6. Procedural character construction and animation.
7. Goal frame, target/reticle and net.
8. Crowd generation and optimizations.
9. Lighting, shadows, post-processing.
10. HUD, score persistence, difficulty progression.
11. Performance bottlenecks and code-quality problems.
12. The exact source of each bug listed in section 3 (identify it before modifying anything).
13. Asset inspection (section 5): bone names, clip names/durations, scale, root-motion tracks.
14. Files to modify, risks, and an implementation plan.

## 3. GAMEPLAY AND COLLISION CORRECTIONS

### 3.1 Goal dimensions and collision accuracy
Bug: the ball sometimes visibly enters the goal frame but is counted as outside.
- Investigate the complete shot calculation, not only the reticle.
- Keep the physical goal size constant at every level. Never secretly shrink the hitbox (the visible frame and the collision must describe exactly the same opening).
- Take ball radius and post/crossbar thickness into account.
- Distinguish: valid goal, post hit, crossbar hit, goalkeeper save, genuine miss.
- One single reusable goal-boundary function (no duplicated slightly different calculations).
- The reticle must show a valid shot area consistent with the real calculation.

### 3.2 Moving reticle
- Keep its size constant. Increase difficulty by raising its movement speed (and optionally its movement pattern).
- Centralize difficulty parameters in `config.js` (no magic numbers). Smooth, predictable progression.

### 3.3 Goalkeeper intelligence
Bug: the goalkeeper sometimes dives left/right when the ball goes to the center.
- Predict the ball's arrival position at the goalkeeper's plane; check whether the keeper can reach it (reaction time + reach).
- Choose: left dive, right dive, central save, catch, ground save.
- Never choose a lateral dive that contradicts the trajectory; no random decision before the ball has travelled.
- Difficulty levels via reaction time and reach, without breaking the physics.
- The ball must react convincingly to a save. Fair, understandable, consistent.

### 3.4 Interactions
Improve player↔ball, player↔defender, ball↔defender, ball↔goalkeeper, ball↔posts/crossbar, ball↔net.
- The ball must visibly follow the player's feet (not float in front of the body).
- On tackle/interception: show the real contact, ball reacts, player loses balance/falls, defender shows contact/recovery. No teleportation.
- No big physics engine. Use a lightweight collision system (reused vectors, boxes, spheres, capsules, swept tests).
- Keep visual animation separate from gameplay collision rules.

## 4. CHARACTERS AND ANIMATIONS (MIXAMO FBX, NO BLENDER)

### 4.1 Asset pipeline decision
**Blender is NOT used.** Do not require it and do not create conversion steps. Load the Mixamo FBX files directly with `FBXLoader` (`three/examples/jsm/loaders/FBXLoader.js`) and control them with `THREE.AnimationMixer`. GLB conversion may be proposed later only if it brings a measurable benefit (then say so and ask me first).

### 4.2 Actual assets already in the project (exact names, spaces included)

Character: `public/assets/characters/ybot-character.fbx`

Animations in `public/assets/animations/`:
- `Goalkeeper Body Block.fbx`
- `Goalkeeper Catch.fbx`
- `Goalkeeper Diving Save.fbx`
- `Goalkeeper Idle.fbx`
- `Goalkeeper Sidestep.fbx`
- `Idle.fbx`
- `Jogging.fbx`
- `Jump.fbx`
- `Kick Soccerball.fbx`
- `Running Slide.fbx`
- `Running.fbx`
- `Side Step.fbx`
- `Soccer Trip.fbx`
- `Sprint.fbx`
- `Standing Up.fbx`
- `Strike Foward Jog.fbx` (the typo "Foward" is in the real filename: keep it)
- `Victory.fbx`

File names contain spaces: build URLs safely (`encodeURI`) and keep them in ONE manifest only.

### 4.3 Verify before integrating (mandatory, include the results in the audit)
Do not assume anything about these files. Write a small dev-only inspection step (script or dev page) that loads each FBX and reports:
- Number of clips, clip name (Mixamo often names it `mixamo.com`), duration, track count.
- Bone names of `ybot-character.fbx` and of each animation's tracks; confirm they match (watch the `mixamorig` prefix / colon sanitization by FBXLoader). Report any mismatch.
- Model scale/orientation (Mixamo FBX is usually in centimeters → needs a scale factor) and feet-on-ground offset.
- Which clips contain root motion (Hips position tracks) and how far the hips travel.
- Whether each animation file also embeds a mesh/skin (only the clip is needed from animation files).

Test the full pipeline first with: the character, `Idle`, `Running` and `Kick Soccerball`. Only if this works, integrate the rest in the same run (if it fails, diagnose and fix it yourself).

### 4.4 Architecture
- A central asset loader with cache: load each FBX once, no duplicate downloads, loading progress, no crash if an asset is missing (fall back to the existing procedural characters and log precisely what is missing).
- Clone characters with `SkeletonUtils.clone()` (`three/examples/jsm/utils/SkeletonUtils.js`), never plain `Object3D.clone()` on skinned meshes.
- One `AnimationMixer` per independently animated character; update only active/visible ones.
- One clip library shared by all characters (same Mixamo skeleton → player, defenders and goalkeeper reuse the same model and clips).
- A clean animation state manager with cross-fading (`crossFadeTo`), never restarting an animation every frame.
- Teams differ by kit colors/materials (share geometries and textures; one material per team/role, not per instance).
- **Single manifest/config** mapping semantic actions → actual file/clip names, scale, loop mode, speed, fade time. No clip names scattered in the code.
- Root motion: strip or neutralize root (Hips) position tracks. The gameplay controller stays the **authoritative** source of position; animation must never move the hitbox. Keep gameplay coordinates and hitboxes consistent with the new model scale.

### 4.5 Semantic mapping (starting proposal: verify each one, adjust in the manifest)

Player:
- Idle → `Idle`; Jog → `Jogging`; Run → `Running`; Sprint → `Sprint`
- Dribble / ball control → no dedicated clip: use Jogging/Running + procedural ball-follow driven by the real foot bone positions
- Jump → `Jump`; Landing → no clip: short procedural blend
- Shoot → `Kick Soccerball` and/or `Strike Foward Jog` (choose after checking which looks right while running)
- Lane change left/right → `Side Step` (see mirroring below)
- Fall after being tackled → `Soccer Trip`; Get up → `Standing Up`; Celebration → `Victory`
- Stumble → no clip: procedural or a short part of an existing clip, documented

Defender:
- Idle/stance → `Idle`; Run → `Running`; Lateral movement/tracking → `Side Step` (mirrored for the other side)
- Sliding tackle → `Running Slide`
- Standing block/interception → no obvious dedicated clip. Candidates: `Goalkeeper Body Block`, `Kick Soccerball`. Mark as **pending visual validation** and keep a procedural fallback.
- Fall/recovery → reuse `Soccer Trip` / `Standing Up` only when the defender actually falls

Goalkeeper:
- Ready/Idle → `Goalkeeper Idle`; Lateral shuffle → `Goalkeeper Sidestep` (mirrored)
- Dive left/right → `Goalkeeper Diving Save` (mirrored for the opposite side)
- Central save / catch → `Goalkeeper Catch`; Ground/body save → `Goalkeeper Body Block`
- Recovery → `Standing Up`

**Two essential distinctions (from my notes):**
1. `Soccer Trip` represents the fall caused by a tackle (the player who gets tackled). It must NEVER be used as the animation of the defender who tackles.
2. `Kick Soccerball` is a shooting animation. It can be studied for a defender who clears/intercepts the ball with the foot, but do NOT present it as a simple standing interception before its movement has been reviewed.

### 4.6 Directional animations exist in one direction only
`Side Step` and `Goalkeeper Sidestep` (and probably `Goalkeeper Diving Save`) exist for only one side. Create the opposite direction for **all** directional animations:
1. Determine each clip's real direction from the data (e.g. the sign of the Hips X displacement), do not guess.
2. Implement a reusable `mirrorClip(clip)` utility (swap Left/Right bone tracks, mirror position X and rotation quaternion components correctly for the Mixamo rig). Validate the result visually in the dev viewer.
3. Fallback only if clip mirroring is wrong: a mirrored wrapper (negative X scale) while handling face winding/culling correctly.
4. Cache the mirrored clips; do not recompute them at runtime each time.

### 4.7 Dev-only animation viewer
Add a development-only viewer (e.g. enabled with a URL parameter, absent from the normal game) to preview each clip on the character, its mirrored version, speed and fade time, so that I can visually validate the mapping. Do not leave it active in the normal build.

### 4.8 Missing clips
Detect missing/incompatible clips and fall back to the procedural animation system. If a specific football animation does not exist, use a compatible one enhanced by procedural rotation/position. Never use an obviously unrelated animation. Do not create fake placeholder assets.

You may suggest additional Mixamo animations I could download (name + purpose + exact destination folder), but **do not download anything from Mixamo yourself** (it requires interactive authentication; do not bypass it) and do not use unverified sources.

## 5. CROWD AND STADIUM
- Keep InstancedMesh. Do NOT use skeletal characters/AnimationMixer for spectators.
- Improve proportions, head/neck, arms, legs, clothing colors, several variants, a few static cheering poses, subtle cheering/waving via instance transforms or shader.
- Few base figures duplicated massively; optional 2–3 LOD levels (detailed near camera, simple far, very cheap far-away).
- Distant spectators must not need per-frame expensive updates. The crowd must never starve the gameplay characters of resources.

## 6. GOAL NET AND BALL IMPACT
- More believable net geometry, sufficiently subdivided, subtle material/texture.
- Deformation centered on the real impact point, driven by ball position and velocity, damped oscillation, no permanent deformation.
- Reusable vertex buffers, update only necessary vertices, no geometry/material rebuild per frame.
- The ball must visibly interact with the net.

## 7. LIGHTING AND ENVIRONMENTS
- Decorative stadium lamps are too bright and hurt visibility: lower emissive intensity, tune bloom/exposure/ambient/directional light. Night must be readable.
- Avoid many shadow-casting lights; use real lights sparingly. Keep shadows efficient.
- Replace the automatic day/sunset/night cycle by a **pre-match selection** (Day / Sunset / Night) that stays fixed for the whole match. It adapts sky, ambient, directional light, lamps, emission, bloom, colors. The match clock is independent of the environment.

## 8. UI / UX
- Keep all existing HUD info; improve layout, hierarchy, typography, contrast, spacing, responsiveness, score/goal/combo/level-up feedback and match start/end transitions.
- Top-left: score + level. Top-center: scoreboard (goals scored/conceded) + clock, combo/multiplier below. Top-right: best score + selected environment.
- It must feel like a football game, not a debug panel. **All user-facing text in French.**

## 9. PERFORMANCE AND THREE.JS ENGINEERING
Performance wins over small memory savings, but never waste resources without a benefit.
- Reuse BufferGeometry/Material/textures; InstancedMesh where appropriate; cache assets; limit draw calls; few real-time shadows; reasonable texture sizes; frustum culling/LOD when useful; dispose unused GPU resources.
- Delta time everywhere. Reuse vectors/matrices/boxes/spheres. **No allocations (new Vector3, geometry, material…) inside the animation loop.** No pointless scene traversal per frame.
- Separate rendering, gameplay, collision, animation, UI, config and asset management. Explicit imports, no circular dependencies, no new dependency without justification, explicit state transitions.
- Optional dev-only diagnostic (FPS, draw calls, triangles) — disabled in the normal game.

## 10. CLEAN CODE
DRY, SRP, KISS, separation of concerns, encapsulation, small focused functions, clear naming, no magic numbers (centralize in config), `const` by default / `let` if needed / never `var`, semicolons, consistent formatting, English identifiers and comments, French UI text. Document non-obvious algorithms (collision assumptions, animation mapping, mirroring). No abstraction without a real problem to solve (no pattern for the sake of a pattern). Follow the existing project conventions.

## 11. FINAL CHECKS (run once, at the end — you do them, not me)
1. `npm run build` passes. 2. Browser console clean. 3. No asset-loading errors; missing assets don't crash the game. 4. Game starts and restarts. 5. Keyboard/mouse/touch controls. 6. Two-defender sequence. 7. Standing blocks and slide tackles look different. 8. Goal / save / post / miss outcomes. 9. Goalkeeper reacts correctly to central and lateral shots. 10. Player/ball contact. 11. Net reaction. 12. Environment fixed during a match. 13. HUD, score, combo, timer, high-score persistence. 14. Responsive resize.

## 12. FORBIDDEN
Do not upgrade Three.js. Do not shrink the goal at higher levels. Do not use random goalkeeper animations that contradict the trajectory. Do not replace a gameplay bug with a visual trick. Do not leave broken imports/references. Do not download from unverified sources. Do not use Blender.

## 13. EXECUTION ORDER (all in one run) AND FINAL REPORT

Execute in this order without stopping:
1. **Audit and asset inspection** (sections 2 and 4.3).
2. **Gameplay and collision** (section 3): goal boundary + ball radius, reticle consistency, goalkeeper prediction/reaction, shot/save logic, ball interactions, defender collision consistency.
3. **Character and animation pipeline** (section 4): FBX loader + cache, SkeletonUtils cloning, mixers, state manager, cross-fades, manifest, mirroring, dev viewer, procedural fallback, reusable config for player/defender/goalkeeper.
4. **Stadium and visuals** (sections 5, 6, 7): crowd, net, lighting, fixed environment selection, materials, post-processing.
5. **UX and final optimization** (sections 8, 9).
6. **Final checks** (section 11): run `npm run build` and every check you can run yourself; fix what fails.

Final report (one single message at the end):
- Implemented features and bugs fixed (with their exact root causes).
- Assets integrated, assets still missing, and exact file locations.
- Animation mapping decisions, especially the ones **pending my visual validation** (standing block, mirrored clips, dribble) and how to preview them in the dev viewer.
- How to add/replace an animation.
- What you really tested and what you could NOT test (e.g. visual checks that need a human).
- Known limitations.

**Start now and complete the whole job in one run.**

=== END OF INSTRUCTIONS FILE ===
