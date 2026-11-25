# MISSION 2 — DRIBBLE DASH 1v1: GO BEYOND (QUALITY, PERFORMANCE, ANIMATION, SOUND COMMENTARY)

You are a senior Three.js/WebGL game developer, technical artist, audio designer and software architect.
The project already received a first big pass (see `PROGRESS_AGENT.md`). Your job now: **make this the best possible version of the game** while keeping it fast and clean. You decide what to improve after a real analysis. I expect a LOT of high-value improvements, not a few cosmetic ones.

Language rules: user-facing text and spoken commentary in **French**; code identifiers, comments and this work log in English (except the handoff summary, which may be in French).

## 0. READING GATE AND RULES

Read completely, to the last line, in this order (read by ranges if truncated):
1. `PROGRESS_AGENT.md`
2. `opencode_prompt_dribble_dash.md` (original rules: still fully valid — FBX direct, NO Blender, exact asset names, single animation manifest, no allocations in the animation loop, clean code, DRY, performance over memory).
3. This file, until `=== END OF MISSION 2 FILE ===`.

Then answer ONLY with a short French confirmation (quote the final marker, max 8 lines of understanding), and **continue immediately** (no "GO" needed).

Non-negotiable rules:
- **Do not trust `PROGRESS_AGENT.md` blindly.** It is a self-report. I do not know whether it was written before or after your own earlier changes. Verify everything against the real code: run `git status`, `git diff --stat`, `npm run build`, then read the actual source. Mark each claimed item as VERIFIED / PARTIAL / BROKEN / MISSING in your audit, and fix what is not truly done.
- **Git:** do not run any Git command that changes anything (no commit, push, reset, checkout, stash, rebase). I handle Git. Only `git status`, `git diff`, `git log` are allowed.
- Do not upgrade Three.js (0.160.0). Do not use Blender. Do not download anything from Mixamo. No new runtime dependency without a clear measurable benefit (explain it first in the log). Never ask for or write keys, tokens or passwords.
- Keep the project compiling at every checkpoint. Finish one unit of work completely before starting the next (never leave a half-edited multi-file change at a quota cut).
- Preserve the existing gameplay rules, scoring, best-score persistence, controls (Q/D, arrows, Space/click/Up) and the three-lane structure.

## 1. QUOTA SURVIVAL PROTOCOL (CRITICAL)

My quota can stop at any moment, and I may continue with a different, weaker model. Therefore:
- Work in priority order (section 6). The most valuable work comes first.
- Be economical: use targeted search/grep and line-range reads instead of re-reading big files; do not paste large diffs or code blocks in chat; run `npm run build` once per tier and after risky changes only; no repeated or redundant explanations.
- After EVERY completed tier (and after any significant sub-step), update `PROGRESS_AGENT.md`. Keep a section named **`## HANDOFF`** at the top, always current, written so that another (weaker) model can continue with zero context:
  - Current tier / sub-step and its status.
  - Checklist of everything done (VERIFIED) and everything remaining, in priority order, with the exact next action.
  - Decisions taken and why (e.g. which shot clip, which speech voice strategy).
  - Files created/modified, key function names, config keys.
  - Known issues and things that need a human visual/audio check.
  - How to resume: "Read this HANDOFF, then run `npm run build`, then do the next unchecked item."
- If you feel the quota is nearly finished, stop starting new work, bring the project to a compiling state, write the HANDOFF, and say so clearly.

## 2. TWO MANDATORY REQUESTS FROM ME

### 2.1 Use `Strike Foward Jog.fbx` for the player's shot
The filename keeps the typo "Foward". The clip is in the manifest but is **not used in gameplay**. Verify this in the code (it is stated to be a comparison candidate, not a used clip). Make it the animation the player plays **when shooting while running**:
- Trigger it from the real shot input (Space / click / Up arrow in the shooting phase), through the existing animation state manager and cross-fades (no animation restart each frame, no new `AnimationMixer` per shot).
- Synchronize the ball release with the actual foot-contact moment of the clip: **measure it from the data** (e.g. peak foot-bone speed or foot-ball distance along the clip), never guess. Store the measured contact time in the manifest/config. The shot must feel instant: if the wind-up makes the response feel late, start the clip partway, speed it up slightly or release earlier — input latency must stay low and gameplay timing (reticle, goal validity, keeper reaction) must stay fair and consistent.
- The gameplay controller stays authoritative; animation never moves the hitbox. Root motion stays neutralized.
- Decide what happens with `Kick Soccerball`: keep it only where it really fits (for example a standing or alternative strike, or defender clearance after review) and document the decision. Do not leave dead, unused clips without a stated reason.
- Handle the shot-type edge cases: shot during a jump, shot right after a dribble, shot when the keeper is already moving, fall back cleanly if the clip is missing.

### 2.2 Sound commentary during the whole match
Add a **spoken football commentator in French** that reacts to gameplay events throughout the match, plus coherent crowd reactions.
- **Primary technology: the browser Web Speech API (`speechSynthesis`)** — no assets, no cost, no quota. Select the best available `fr-FR` (or `fr-*`) voice at runtime (prefer voices that are higher quality, e.g. names containing "Natural", "Online", "Google" when present), with a clean fallback if no French voice exists (show a non-intrusive message in the settings, and never crash). Voices load asynchronously (`voiceschanged`): handle it. Speech may only start after a user gesture (the menu start click): respect browser autoplay rules.
- **Architecture:** one `CommentaryManager` module with: an event bus fed by gameplay (kick-off, good dribble, successful pass of a defender, combo milestones, defender tackle/block, player falls, near-miss, shot, goal, save, post, crossbar, miss, concession, level up, big streak, close score, last minute, final whistle, record broken, new match, selected environment such as night/sunset). A **priority queue** with per-event **cooldowns**, a maximum of one voice line at a time, interruption rules (a goal can interrupt filler, never the other way around), and no flooding (never comment on everything; silence is part of good commentary).
- **Variety:** several phrase variants per event, no immediate repetition (remember recent phrases), phrases adapted to context (score difference, combo, level, time left). Vary `rate`/`pitch` slightly with excitement. Keep sentences short (the game is fast); stale lines must be dropped if the moment has passed.
- **Content:** original French lines in a football-broadcast style. No real player/team/league names, no copyrighted catchphrases.
- **Audio mix:** integrate with the existing `audio.js`: duck crowd/ambience volume while the commentator speaks, keep sound effects audible, and coordinate crowd reactions (roar on goal, groan on save, murmur on near-miss). Add a **settings panel** (or menu section) with: commentary on/off, commentary volume, effects/crowd volume, saved in `localStorage` (wrapped in try/catch). Add a quick mute key.
- **Pause/blur/game-over:** cancel pending speech on pause, tab hidden, restart and game over; always clean up listeners.
- **Optional future-proofing:** support an optional manifest of pre-recorded audio clips in `public/assets/audio/commentary/` that takes precedence over speech when present. Do not require such files and do not fabricate assets.
- Put all phrases and tuning values in one data/config module (no scattered strings), keep the code DRY.

## 3. ANALYSIS AXES (YOU DECIDE THE DETAILS)

Analyze the whole project against these axes and fix/improve everything that has real value. Write a ranked backlog in `PROGRESS_AGENT.md` before implementing.

**Performance (top priority):** FPS budget and adaptive quality (dynamic pixel ratio, optional automatic quality tiers driven by a frame-time monitor), draw calls and triangles, shadow cost (map sizes, casters count, frustum fitting), post-processing cost, material/geometry/texture reuse and disposal, no per-frame allocations, instancing and LOD for the crowd, update throttling for far/off-screen objects, avoiding scene traversals per frame, asset loading (parallel, cached, progress), bundle size (the >500 KB chunk warning: lazy-load dev-only code such as the animation viewer, sensible `manualChunks` for Three.js), startup time, memory leaks on restart/rematch, mobile and low-end behavior, tab-hidden behavior (pause timers/audio).

**Graphics:** pitch (stripes, line markings, subtle texture or shader variation, non-flat look), ball (material, markings, rotation matching its velocity, shadow/contact shadow), character materials and team kits (shared materials per team), stadium (stands, roof/lights silhouettes, advertising boards, goal structure), lighting coherence per environment (Day/Sunset/Night stay fixed during a match; night must remain readable; lamps decorative but realistic), tasteful post-processing (no blur that hurts gameplay readability), lightweight particles (dust/grass on slides and kicks, ball trail on strong shots, goal celebration effects), restrained camera work (smooth follow, slight FOV/shake on sprint, shot and goal; short hit-stop on tackles; optional brief slow-motion on goals) — all configurable and cheap.

**Animation:** blend quality (cross-fade durations per transition, no popping), foot–ball contact while dribbling (the ball follows real foot positions), run/sprint speed matching animation speed (`timeScale` tied to the gameplay speed, no foot sliding), lane-change animation (`Side Step` and its mirrored version), tackle and fall readability (slide tackle vs standing block must look clearly different; `Soccer Trip` is ONLY the fall of the tackled player, never the tackler), get-up and recovery flow, keeper dives/catches matched to the planned save with correct mirrored side, celebration/victory moments, idle variations, defender anticipation poses. Anything lacking a clip uses a compatible clip plus procedural adjustment; never an unrelated clip.

**Gameplay feel and fairness:** input responsiveness (input buffering for jump/shoot, sensible coyote-style tolerance), difficulty progression curve, defender behavior variety without unfairness, keeper realism, readable feedback for success/failure, no hidden randomness that contradicts what the player sees. Collision correctness must be preserved (visible goal frame = collision frame).

**UX/UI (French):** clearer HUD hierarchy and contrast, combo/level-up feedback, pause menu and settings, match-length and environment selection, end-of-match summary, loading screen with progress, graceful errors for missing assets, responsive layout, touch controls if the game is playable on mobile, keyboard accessibility for menus.

**Robustness/code quality:** no console errors or warnings, no circular imports, no dead code or unused assets without reason, clear module boundaries, config-driven values, short documented non-obvious algorithms (collision, mirroring, shot sync, commentary queue), idempotent restart/rematch, defensive handling of missing FBX. Consider a few focused unit tests only if cheap and dependency-free; otherwise skip.

## 4. VERIFICATION YOU MUST DO YOURSELF

- `npm run build` must pass, with no new warnings you can avoid.
- If you have a browser tool, load the game (dev server) and check the console for runtime errors, measure FPS if possible, and run the animation viewer (`?dev=viewer`) to check clips. If you have no browser tool, state clearly in the log what you could NOT test; never claim visual or audio results you did not observe.
- Test the logic you can test in code: goal classification, keeper prediction, shot timing, commentary queue/cooldown behavior, restart cleanliness.

## 5. WHAT I WILL VALIDATE BY EYE/EAR (list them in the final handoff)

Shot animation contact timing; defender block pose; mirrored animations (side step, keeper side step, dive); dribble foot contact; commentary voice quality, volume and frequency (not annoying); night visibility; overall feel.

## 6. PRIORITY ORDER OF EXECUTION

- **Tier 0:** reading gate; verification of `PROGRESS_AGENT.md` claims (git status/diff, build, code reading); write the audit and the ranked backlog in the HANDOFF section; fix anything broken or missing from the previous pass.
- **Tier 1:** my two mandatory requests (2.1 shot animation, 2.2 sound commentary).
- **Tier 2:** performance and robustness (adaptive quality, bundle splitting, leaks, allocations, shadows, throttling).
- **Tier 3:** animation quality and gameplay feel.
- **Tier 4:** graphics polish (pitch, ball, stadium, particles, camera feel).
- **Tier 5:** UX/settings/pause/mobile polish, audio mix refinements, extras you judge valuable.

After each tier: build check, update `PROGRESS_AGENT.md` (HANDOFF first), continue with the next tier.

## 7. FINAL REPORT (when everything is done, or when stopping for quota)

One message in French: what was verified, fixed and added per tier; measured improvements (only real measurements); the decisions taken (shot clip, commentary strategy); what remains and the exact next action; the list of things I must validate by eye/ear; known limitations.

=== END OF MISSION 2 FILE ===
