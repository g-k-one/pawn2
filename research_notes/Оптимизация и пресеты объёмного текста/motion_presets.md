# Motion presets for kinetic typography / per-letter text animation

Scope: proven per-letter presets with exact numbers (durations, easings, springs, stagger, transform ranges) and the principles that make text motion look premium, for a custom engine with per-letter offset x/y/z, scale, rotation (incl. 3D flips), alpha, whole-label 3D rotation, glow/flash and shine sweep.

Legend: "Cited Findings" = verified in a fetched source. "Inferences" = my synthesis / engineering recommendations built on the cited numbers (not quoted from a source). Where a value comes from general practice and I could not verify it in this session, it is in Gaps or explicitly marked "unverified".

---

## 1. The 12 principles applied to text (anticipation, squash & stretch, overshoot, follow-through, arcs, slow in/out, secondary action, timing)

### Takeaway
No source gives a "12 principles for text" spec with numbers; the practical translation is: ease-out entrances with a small overshoot (back/spring), per-letter stagger as overlapping action, a small reverse move before a big move (anticipation), and a short settle wobble (follow-through). Concrete numbers have to come from the easing/spring systems in section 3.

### Cited Findings
- Real-world motion has natural lag and overshoot; overshoot-and-rebound makes movement livelier; a common pattern is a small move in the opposite direction first (anticipation), then overshoot into place — [Miracamp, motion graphics techniques](https://www.miracamp.com/learn/motion-graphics/best-techniques-mg)
- Stagger lines by roughly 3–5 frames so entrances cascade instead of landing together (example: five lines offset by 4 frames each) — [Miracamp](https://www.miracamp.com/learn/motion-graphics/best-techniques-mg)
- A sharp ease-in followed by a slow ease-out gives a snappier, higher-energy feel; subtle motion usually reads better than excessive animation — [Miracamp](https://www.miracamp.com/learn/motion-graphics/best-techniques-mg)
- Motion blur = subtle smear on fast-moving objects that makes animation feel cinematic; use sparingly — [Miracamp](https://www.miracamp.com/learn/motion-graphics/best-techniques-mg); AE workflow: enable composition motion blur and the per-layer switch on text layers — [Adobe, create fluid text animations](https://www.adobe.com/ca/learn/after-effects/web/create-fluid-text-animations)
- "Objects in real life don't just start and stop instantly, and almost never move at a constant speed" (slow in / slow out rationale) — [easings.net](https://easings.net/)
- Linear motion looks unnatural; ease-out is the most common choice (fast start, slow settle, lets the eye land); ease-in for leaving the screen; ease-in-out can feel unresponsive because of the slow start — [NN/g, Animation duration](https://www.nngroup.com/articles/animation-duration/)
- CustomWiggle (GSAP) has types easeOut, easeInOut, anticipate, uniform, random — a ready-made "anticipate" and decaying-wiggle family; CustomBounce has `squash` (1–4 in examples) and `strength` (0.1–1 in examples), i.e. squash & stretch built into a bounce ease — [GSAP Eases](https://gsap.com/docs/v3/Eases/)

### Inferences
Mapping of each principle to a per-letter parameter in our engine (recommended starting values, derived from sections 3–4):
- **Anticipation**: before a drop/slam, move letter 6–12% of glyph height in the opposite direction (or scale to 0.92) over 80–120 ms with ease-in, then release. For a whole label: scaleY 0.94 / scaleX 1.04 "crouch" for ~100 ms.
- **Squash & stretch**: on landing, scaleY 0.85 / scaleX 1.12 (keep area ~constant: sx ≈ 1/sy), recover via spring ζ≈0.5–0.6 within ~250 ms; in flight stretch along the motion axis 1.08–1.15 proportional to velocity. Pivot (origin) at the baseline, not at the glyph center.
- **Overshoot**: back.out with overshoot ~1.7 (classic Penner constant 1.70158, unverified in this session — see Gaps) or a spring with damping ratio 0.6–0.8; scale peaks 1.08–1.15 for pop-ins.
- **Follow-through / overlapping action**: per-letter stagger 25–50 ms so letters are mid-flight while others start; plus a secondary property (rotation or scale) that settles 60–120 ms later than position.
- **Arcs**: drop-ins with small x drift + rotation (e.g. rotate from ±8–15° to 0) so the path curves; center-spiral = rotation coupled to radius.
- **Slow in/out**: entrances ease-out (expo.out / power3-4.out / emphasized decelerate `cubic-bezier(0.05,0.7,0.1,1)`), exits ease-in (`cubic-bezier(0.3,0,0.8,0.15)`), loops sine.inOut.
- **Secondary action**: glow flash on impact, shine sweep after the last letter lands, tiny label-level shake/rotation — always triggered by the primary event (landing), not running independently.
- **Timing**: one consistent duration scale (section 3, Material tokens) — the same type of motion always uses the same token.

### Gaps
- No primary source (Disney/Thomas & Johnston, School of Motion) fetched with text-specific numeric guidance; the numbers in the Inferences are synthesis, not quoted.

---

## 2. After Effects text animator presets and Range/Wiggly selectors

### Takeaway
AE presets are built from Text Animators + Range Selector; the quality levers are Shape (Ramp Up vs Square), Ease High/Low, Randomize Order, Offset animation and Units = Index. Adobe does not publish numeric breakdowns of individual presets (Pop Buzz, Center Spiral etc.) in sources I could reach.

### Cited Findings
- Randomize Order (Range Selector → Advanced) animates characters in shuffled order over the same total time; Random Seed picks a different shuffle — [ProVideo Coalition, Creating Motion Graphics with AE excerpt](https://www.provideocoalition.com/cmg_hidden_gems_chapter_21_textacy/)
- Ease High / Ease Low control the transition between fully selected (high) and unselected (low) characters; Ease Low 100% makes characters "fall gently into position" (soft landing) — [ProVideo Coalition](https://www.provideocoalition.com/cmg_hidden_gems_chapter_21_textacy/)
- Bounce-style per-letter recipe: Units = Index, Shape = Ramp Up, Ease Low = 100%, keyframe Offset across the characters — [Adobe Community thread](https://community.adobe.com/t5/after-effects/how-to-create-bounce-effect-with-text-animator/m-p/10687113); default Square shape gives a choppy, blocky look — [PremiumBeat](https://www.premiumbeat.com/blog/animate-individual-letters-in-after-effects/)
- Rive's equivalent: Modifier Group = Range + Properties (Position, Rotation, Scale, Origin, Opacity, Follow Path, variable-font axes); Range by percentage or index, increment by characters / words / lines, per whole text or per run; options Mode (Add etc. — two overlapping 200% scales in Add = 400%), Strength 0–100%, Falloff (e.g. 25%–75% falloff on a 0–100% range ramps over first/last quarter) with custom cubic falloff interpolation (default linear), and Offset (animate it for wipe effects) — [Rive text modifiers docs](https://rive.app/docs/editor/text/text-modifiers)

### Inferences
- The AE/Rive model maps directly onto an engine: per-letter "selector amount" s_i(t) ∈ [0,1] computed from (index − offset(t)) through a shaped ramp (falloff width = how many letters are in transition at once), then property = lerp(from, to, ease(s_i)). Animating one `offset` scalar gives every stagger order; Randomize Order = permute index before the ramp; Ease High/Low = easing applied to the ramp's ends.
- Falloff width ≈ "how many letters move simultaneously": narrow (1–2 letters) = typewriter/wipe; wide (40–60% of text) = soft wave. This is the same concept as GSAP stagger `each` vs `amount`.
- Wiggly Selector equivalent: per-letter coherent noise (sum of 2 sines with per-letter phase or simplex) at 1–3 Hz, amplitude a few px / 2–5°, "Correlation" = how much neighbours share phase.
- Preset recreations (my parameterisation, not Adobe's numbers): Typewriter = opacity step per letter, each 30–60 ms, no easing; Fade Up Characters = y +40–60% glyph height → 0, opacity 0→1, 400–600 ms each, stagger 30–40 ms, power3.out; Bounce In = y from −1 glyph height, spring ζ≈0.5; Pop Buzz = scale 0→1.2→1 with a short random rotation/position jitter that decays; Center Spiral = per-letter rotation 180–360° + radial offset collapsing to 0 from center order; Raining Characters = y from −(2–4) line heights, random order, ease-in fall + small squash on land; 3D Flip = rotationX −90..−100° → 0 with origin behind the glyph.

### Gaps
- Official Adobe numeric settings of individual presets (Pop Buzz, Center Spiral, Raining Characters, 3D flip family) were not found; the Adobe help pages for the preset library were not reached in this session.

---

## 3. GSAP / Motion / Apple / Material / Rive — concrete parameter systems

### Takeaway
Use one shared vocabulary: (a) tween eases (power/expo/back/elastic or Material cubic-beziers) with a Material-style duration scale 50–1000 ms; (b) springs expressed as (response/duration, damping ratio = 1 − bounce) and converted to stiffness/damping via k = (2π/response)², c = 4π·ζ·m/response — verified against Apple's own conversion examples.

### Cited Findings
**GSAP SplitText (official demo numbers)** — [GSAP SplitText docs](https://gsap.com/docs/v3/Plugins/SplitText/)
| Demo | stagger (s) | duration (s) | ease | properties |
|---|---|---|---|---|
| Minimal | 0.05 | 1 | default | y: 100, autoAlpha: 0 |
| Chars | 0.04 | 0.7 | power4 | x: 150, opacity: 0 |
| Words | 0.15 | 0.7 | back | y: −100, opacity: 0, rotation: random(−80, 80) |
| Lines 3D | 0.25 | 0.8 | power3 | rotationX: −100, transformOrigin: "50% 50% −160px", opacity: 0; CSS perspective: 500px |
| Mask reveal | 0.1 | 0.6 | expo.out | yPercent: 100, opacity: 0 (mask: lines/words/chars, `visibility: clip`) |
| Responsive lines | 0.05 | 3 | — | yPercent: 20, opacity: 0 |
| Aria/nested | 0.1 | 2 | sine.out | opacity: 0 |
- SplitText notes: splitting only chars can cause odd line breaks (use words/lines or `smartWrap`); `aria: "auto"` puts aria-label on parent and aria-hidden on children; "Splitting thousands of elements can be expensive" — revert after animating; kerning shifts fixed with `font-kerning: none; text-rendering: optimizeSpeed` — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- GSAP default ease is "power1.out"; core eases: none, power1–4, back, bounce, circ, elastic, expo, sine, steps; EasePack: rough, slow, expoScale; extras: CustomEase, CustomBounce (strength, squash), CustomWiggle (wiggles, type: easeOut/easeInOut/anticipate/uniform/random) — [GSAP Eases](https://gsap.com/docs/v3/Eases/)
- GSAP stagger: `each` (gap in s between starts) vs `amount` (total spread; amount 1 over 100 items = 0.01 each); `from`: "start" | "center" | "edges" | "random" | "end" | index | [x,y] fractions with grid; `grid` ([rows, cols] or "auto"), `axis` "x"/"y"; stagger `ease` distributes start times (default "none"; e.g. "power2" = big gaps first then clustered); negative number reverses order; function form returns absolute delay — [GSAP Staggers](https://gsap.com/docs/v3/Staggers/)
- GSAP ScrambleText: `chars` default "upperCase" (also "lowerCase", "upperAndLowerCase", custom e.g. "XO", "0123456789"), `speed` default 1 (refresh rate; demo uses 0.3–0.4 for slower flicker), `revealDelay` default 0 s, `tweenLength` default true, `delimiter` "" (char by char; " " = word by word), `rightToLeft` false; demo durations 1–2 s — [GSAP ScrambleText](https://gsap.com/docs/v3/Plugins/ScrambleTextPlugin/)

**Motion (Framer Motion)**
- Spring options listed with defaults: stiffness "1" (as rendered on the docs page), damping 10, mass 1, bounce 0.25, duration 800 ms when using `spring()` directly (Motion otherwise uses seconds), restDelta 0.01, restSpeed 0.1; `visualDuration` (s) overrides duration — [motion.dev/docs/spring](https://motion.dev/docs/spring); transition `duration` default 0.3 s (0.8 s with multiple keyframes); inertia defaults power 0.8, timeConstant 700, bounceStiffness 500, bounceDamping 10; stagger via `delayChildren: stagger(0.1)`, `stagger(0.1, { from: "last" })`, `stagger(0.05, { grid: [8,6], from: "center" })` — [Motion transitions](https://motion.dev/docs/react-transitions)
- Note conflict: the docs page renders stiffness default as "1"; the long-standing framer-motion default is stiffness 100 / damping 10 / mass 1 (could not fetch source file — 404). Apple's doc conveniently converts exactly that spring: Spring(mass 1, stiffness 100, damping 10) → duration 0.63 s, bounce 0.5 — [Apple Spring](https://developer.apple.com/documentation/swiftui/spring.md). So "Motion default spring" ≈ a fairly bouncy ζ = 0.5 spring.

**Apple (SwiftUI Spring, iOS 17+)** — [Apple Spring docs](https://developer.apple.com/documentation/swiftui/spring.md)
- Conversions given by Apple: Spring(duration 0.5, bounce 0.3) → mass 1.0, stiffness 157.9, damping 17.6; Spring(mass 1, stiffness 100, damping 10) → duration 0.63, bounce 0.5.
- Built-ins: `.smooth` (no bounce), `.snappy` (small bounce), `.bouncy` (higher bounce), each tunable with `(duration:, extraBounce:)`; other inits: (response, dampingRatio), (settlingDuration, dampingRatio, epsilon).
- `interpolatingSpring` defaults: duration 0.5, bounce 0.0; bounce 0 = critically damped, 1.0 = undamped; bounce range −1…1 — [Apple interpolatingSpring](https://developer.apple.com/documentation/swiftui/animation/interpolatingspring(duration:bounce:initialvelocity:).md), [WWDC23 notes "Animate with springs"](https://wwdcnotes.com/notes/wwdc23/10158)
- Preset numbers (third-party, unverified vs Apple): smooth = 0.5 s / extraBounce 0; snappy = 0.4 s / 0.1 (some say 0.15); bouncy = 0.5 s / 0.2 — [Tessl SwiftUI skill reference](https://tessl.io/registry/dpearson2699/swift-ios-skills/3.6.0/files/skills/swiftui-animation/references/animation-advanced.md). Legacy `.spring()` response 0.55, dampingFraction 0.75 (third-party; Apple's older docs said 0.825 — conflict) — [CreateWithSwift](https://www.createwithswift.com/understanding-spring-animations-in-swiftui/)
- Third-party summary of WWDC18 "Designing Fluid Interfaces": damping ratio 1.0 by default, ~0.8 only when the gesture carried momentum; examples move 1.0/0.4, rotation 0.8/0.4, drawer 0.8/0.3 (unverified attribution) — [Emil Kowalski apple-design skill (mirror)](https://mcpservers.org/ru/agent-skills/emilkowalski/apple-design)

**Material (M3) motion tokens** — [Material Components Android, Motion.md](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md)
- Easing: standard `cubic-bezier(0.2, 0, 0, 1)`; standard decelerate `(0, 0, 0, 1)`; standard accelerate `(0.3, 0, 1, 1)`; emphasized decelerate `(0.05, 0.7, 0.1, 1)`; emphasized accelerate `(0.3, 0, 0.8, 0.15)`; emphasized = path `M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1`; legacy `(0.4, 0, 0.2, 1)`; linear.
- Durations: short1–4 = 50/100/150/200 ms; medium1–4 = 250/300/350/400; long1–4 = 450/500/550/600; extra-long1–4 = 700/800/900/1000.
- Springs (damping ratio, stiffness): fast spatial 0.9 / 1400; default spatial 0.9 / 700; slow spatial 0.9 / 300; fast effects 1 / 3800; default effects 1 / 1600; slow effects 1 / 800. ("Spatial" = position/scale/rotation; "effects" = opacity/color — no bounce.)
- M3 Expressive scheme (third-party ports, conflicting): expressive fast spatial ζ 0.6 / k 800; expressive default spatial k 380 with ζ 0.8 ([motor](https://pub.dev/packages/motor)) or 0.73 ([material_expressive](https://pub.dev/documentation/material_expressive/0.8.0/)); expressive fast effects 1 / 3800 ([M3EMotion](https://pub.dev/documentation/m3e_slider/0.0.2/common_m3e_common/M3EMotion-class.html)).
- Emphasized decelerate is for elements entering the screen — [Material Components Android](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md); Flutter defines the same `Cubic(0.05, 0.7, 0.1, 1.0)` — [Flutter Easing](https://api.flutter.dev/flutter/material/Easing/emphasizedDecelerate-constant.html)

### Inferences
- **Spring conversion (verified against both Apple examples):** with mass m = 1, response T (s), damping ratio ζ = 1 − bounce: stiffness k = (2π/T)², damping c = 4π·ζ/T. Check: T 0.5, ζ 0.7 → k 157.9, c 17.6 ✓; k 100, c 10 → T = 2π/10 = 0.63, ζ = c/(2√k) = 0.5 ✓.
- Material springs in "response" terms (T = 2π/√k): fast spatial 0.17 s, default spatial 0.24 s, slow spatial 0.36 s; effects 0.10 / 0.16 / 0.22 s. Expressive fast spatial (k 800, ζ 0.6) ≈ 0.22 s with ~10% overshoot. These are good per-letter springs: letters are small, so 0.17–0.36 s reads as snappy.
- Overshoot of an underdamped spring ≈ exp(−πζ/√(1−ζ²)): ζ 0.9 → 0.15%; 0.8 → 1.5%; 0.7 → 4.6%; 0.6 → 9.5%; 0.5 → 16%; 0.4 → 25%; 0.3 → 37%. Use this to pick ζ from a desired overshoot (e.g. "pop" with ~10% scale overshoot → ζ ≈ 0.6).
- Recommended engine token set (combining Material durations with GSAP/Motion practice):
  - `instant` 100 ms (feedback), `fast` 200 ms, `base` 300 ms, `slow` 450 ms, `hero` 600–800 ms (big win reveal only).
  - Eases: `out` = emphasized decelerate (0.05,0.7,0.1,1) ≈ expo.out; `in` = (0.3,0,0.8,0.15); `inOut` = standard (0.2,0,0,1); `loop` = sine.inOut; `pop` = back.out(1.7) or spring T 0.3 / ζ 0.6; `land` = spring T 0.25 / ζ 0.5; `settle` = spring T 0.35 / ζ 0.8.
  - Per-letter stagger `each`: 20 ms (dense/fast), 30–40 ms (standard; GSAP chars demo uses 40 ms), 50–60 ms (dramatic); cap total spread with `amount` (e.g. ≤ 400 ms) for long strings.
- **3D flip recipe from GSAP lines demo, adapted to letters:** rotationX −90…−100° → 0, origin pushed behind the glyph ("50% 50% −Z" with Z ≈ 0.6–1.0 × glyph height; GSAP used −160 px for whole lines), perspective ≈ 3–5 × label height (GSAP used 500 px), opacity 0→1 over first 40% of the flip, ease power3.out or spring ζ 0.7, 700–800 ms, stagger 40–60 ms.

### Gaps
- Exact back/elastic defaults not verified on gsap.com in this session (back page 404). Widely documented values: back overshoot 1.70158 (Penner; GSAP `back.out(1.7)`), elastic amplitude 1 / period 0.3 (`elastic.out(1, 0.3)`) — treat as standard but unverified here.
- Official Apple values for `.snappy/.bouncy/.smooth` not stated on the fetched page.
- Official M3 Expressive spring values (Compose `MotionScheme.expressive()`) not fetched from Google; only third-party ports, which conflict (ζ 0.73 vs 0.8).

---

## 4. Preset catalogue: entrances, idle loops, emphasis, text-change transitions, exits

### Takeaway
A compact library of ~20 presets covers everything: each is (property ranges) × (per-letter ease/spring) × (stagger each + order) × (secondary effect). Idle loops must be low-amplitude, slow (≈0.3–1 Hz) and preferably pausable after 5 s; emphasis should be short (≤ 400 ms) and decay; number changes should roll/flip only the changed digits.

### Cited Findings
- Mask reveal (letters slide up from behind a clip): yPercent 100 → 0, 0.6 s, expo.out, stagger 0.1 — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- Character slide: x 150 → 0, opacity 0 → 1, 0.7 s, power4, stagger 0.04 — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- Word toss: y −100 → 0, rotation random(−80, 80) → 0, 0.7 s, back, stagger 0.15 — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- Scatter/explode (revert demo): x, y random(−100, 100) per char, stagger 0.1 — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- Scramble/decode: random glyphs refreshed at `speed` (default 1, slower 0.3–0.4), revealed char by char (or word by word), optional `revealDelay`, `rightToLeft`; implementations use requestAnimationFrame and cycle random characters before settling — [GSAP ScrambleText](https://gsap.com/docs/v3/Plugins/ScrambleTextPlugin/), [soulwire TextScramble CodePen](https://codepen.io/soulwire/embed/preview/mErPAK)
- Stagger orders available: start, end, center, edges, random, index, grid point; stagger ease redistributes start times (power2 = slow start then cluster) — [GSAP Staggers](https://gsap.com/docs/v3/Staggers/)
- Decaying wiggle (shake) and anticipation curves exist as CustomWiggle types (easeOut = decaying, anticipate) — [GSAP Eases](https://gsap.com/docs/v3/Eases/)
- Flashing limit: no more than three general flashes / three red flashes in any 1-second period — [W3C Understanding 2.2.2 / 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Auto-starting moving/blinking content lasting more than 5 s needs a pause/stop/hide mechanism (unless essential); 5 s chosen as "long enough to get a user's attention" — [W3C Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)

### Inferences — the catalogue (engine-ready starting values)
Notation: dur = per-letter duration; each = stagger between letter starts; h = glyph height; ζ = damping ratio; T = spring response.

**Entrances**
| Preset | Per-letter from → to | Timing | Order | Secondary |
|---|---|---|---|---|
| Rise (Fade Up) | y +0.5h, α 0 → y 0, α 1 | dur 450 ms, emphasized decelerate; α over first 60% | start, each 30 ms | none — the "calm default" |
| Mask Reveal | y +1.0h (clipped by baseline mask) → 0 | 600 ms expo.out | start, each 40–60 ms (GSAP: 100 ms per line) | shine sweep starts when last letter is 70% in |
| Pop | scale 0.3, α 0 → 1 (peak ≈1.12) | spring T 0.3, ζ 0.6 (≈10% overshoot) or back.out(1.7) 400 ms | center → edges, each 25 ms | glow flash 0→1→0 over 250 ms per letter at peak |
| Drop / Slam | y −1.5h, scaleY 1.15 (stretch) → 0; landing squash sy 0.85 / sx 1.12 → 1 | fall 220–280 ms ease-in (accelerating), squash recover spring T 0.25, ζ 0.5 | start, each 45 ms (random for "raining") | per-landing micro shake of whole label 2–3 px, decaying over 120 ms; tick sound |
| 3D Flip-in | rotX −95° → 0, origin z −0.8h, α 0→1 in first 40% | 700 ms power3.out or spring T 0.4, ζ 0.7 | start, each 50 ms | specular highlight rises as face turns toward camera |
| Spiral in | rotZ ±270°, radius 2–3h toward center, scale 0.2 → 1 | 800 ms expo.out | center, each 30 ms | — |
| Typewriter | α step 0→1 | step, each 40–60 ms | start | caret blink 530 ms on/off (unverified convention) |
| Blur-in (smear) | scaleX 1.3 along motion + α 0, x +0.4h → 1, 0 | 350 ms expo.out | start, each 20 ms | fake motion blur = stretch + 2–3 trailing ghost copies at α 0.3/0.15 |

**Idle loops (alive but calm)**
| Preset | Formula | Values |
|---|---|---|
| Wave | y_i = A·sin(2π f t − i·φ) | A 2–4% h, f 0.5–0.8 Hz, φ 0.35–0.5 rad/letter; sine, no easing needed |
| Breathing | label scale = 1 + A·sin(2π f t) | A 1–2%, f 0.25–0.33 Hz (3–4 s period) |
| Shimmer / shine sweep | highlight band position moves across label | sweep 600–900 ms, ease inOut, then pause 2.5–5 s; band width 15–25% label width, angle 20–30° |
| Float (whole-label 3D) | rotY = A·sin(2πft), rotX = B·sin(2πf't) | A 4–6°, B 2–3°, f 0.15–0.25 Hz, f' ≠ f (non-repeating look) |
| Glow pulse | glow intensity 0.6 ↔ 1.0 | 2–3 s period, sine |
- Calm rules: amplitude small, frequency < 1 Hz, no sharp easing in loops; after ~5 s either stop, lower amplitude, or switch to sparse shine every few seconds (WCAG 2.2.2 logic + battery). Our project already demands that idle not wake the page every frame (CLAUDE.md "Производительность") — a shine every 3–5 s fits that better than a continuous wave.

**Emphasis / punch**
| Preset | Values |
|---|---|
| Scale punch | label scale 1 → 1.15 in 80 ms (ease-out) → 1 via spring T 0.3, ζ 0.45; letters follow with 15–20 ms stagger from center |
| Shake with decay | x offset = A·e^(−t/τ)·sin(2π f t); A 6–10 px (or 4–6% label width), f 12–18 Hz, τ 80–120 ms, total ≤ 300–400 ms; add rotZ ±2–3° same envelope |
| Chromatic / flash | additive white/gold flash 0 → 1 in 40–60 ms, decay 200–300 ms ease-out; optional RGB split 2–4 px decaying with flash; at most one flash per event (≤ 3 per second, WCAG) |
| Jiggle (per-letter) | each letter rotZ ±6–10° random sign, spring back ζ 0.4, stagger 20 ms random order |
| Squash hit | label sy 0.88 / sx 1.08 in 60 ms → spring T 0.25, ζ 0.5 |

**Text-change transitions**
| Preset | Values |
|---|---|
| Odometer / rolling digits | only changed digits move; each digit column scrolls through intermediate numbers on y; 400–700 ms ease-out (or spring T 0.4, ζ 0.8 — tiny settle); stagger right→left 30–60 ms so lower digits lead (or left→right when increasing large values); if increasing, roll upward; overshoot ≤ 5% of digit height |
| Slot-reel roll | per letter y-scroll through 6–15 random glyphs with motion-stretch scaleY 1.1–1.3 while fast; decelerate on each letter with ease-out 300–500 ms; stop order left→right with 80–150 ms between stops; landing = small bounce ζ 0.5 + tick sound |
| Scramble / decode | refresh random glyphs every 2–4 frames (≈30–60 ms; GSAP speed 0.3–1 range), lock letters left→right with each 30–50 ms; charset matched to target (digits for numbers) |
| Split-flap | per letter: top half rotX 0 → −90° (ease-in, 60–90 ms), bottom half of next glyph rotX 90 → 0 (ease-out bounce, 60–90 ms); cycles through intermediate chars in alphabet order; stagger 20–40 ms; click sound per flap |
| Morph / crossfade | old letter y 0 → −0.4h, α 1 → 0 (180 ms in-ease); new letter y +0.4h → 0, α 0 → 1 (250 ms out-ease), overlapping by ~100 ms |

**Exits**
| Preset | Values |
|---|---|
| Fade-down | y 0 → +0.3h, α 1 → 0, 200–250 ms emphasized accelerate (0.3,0,0.8,0.15); each 15–20 ms (exits faster/tighter than entrances) |
| Letter drop | y → +2–3h with gravity (ease-in quad/cubic), rotZ random ±20–40°, α fades in last 30%; 350–500 ms; random order each 20–30 ms |
| Scatter | x,y random within ±1–2 label heights, rotZ ±90°, scale 0.6, α 0; 400 ms expo.out (burst fast then slow) |
| Implode | toward center, scale 0, α 0; 250–300 ms ease-in; edges → center order |
| Slide-out with smear | x → +1.5h with scaleX stretch 1.3 and trailing ghosts, 200 ms ease-in |

### Gaps
- No authoritative published numbers for odometer, split-flap, or slot-reel timings were found in this session; the values above are engineering recommendations.
- Caret blink 530 ms is a common OS convention I could not verify here.

---

## 5. Readability and comfort

### Takeaway
Keep most UI text animation 100–400 ms (≤ 500 ms), entrances slightly longer than exits, total stagger spread short enough that the word becomes readable within ~0.5–0.8 s, provide a reduced-motion path (fade/instant swap), and avoid large-scale, parallax-like, spinning or flashing motion.

### Cited Findings
- Most UI animations should be 100–500 ms; simple feedback ~100 ms; substantial changes 200–300 ms; reserve ~400 ms for big movements; at ~500 ms animations "start to feel like a real drag"; frequent animations should be shorter and subtler; 250 vs 300 ms is noticeably different — [NN/g](https://www.nngroup.com/articles/animation-duration/)
- Entrances slightly longer than exits (e.g. 300 ms appear, 200–250 ms disappear) — [NN/g](https://www.nngroup.com/articles/animation-duration/)
- UI animations should usually be under 300 ms; a 500 ms entrance on a frequently used element feels frustrating; never animate keyboard-initiated (highly repeated) actions; animate only where motion adds information — [Emil Kowalski, Great animations](https://emilkowal.ski/ui/great-animations)
- Respect `prefers-reduced-motion: reduce` (or `useReducedMotion`) and swap movement for a simpler effect such as fading — [Emil Kowalski](https://emilkowal.ski/ui/great-animations); WCAG 2.3.3 (AAA) sufficient techniques C39/SCR40 use the prefers-reduced-motion query; parallax is the canonical vestibular trigger — [W3C Understanding 2.3.3](https://w3c.github.io/wcag/understanding/animation-from-interactions)
- Large page transitions, parallax, full-viewport motion and camera pans are listed as vestibular triggers (secondary source) — [TestParty guide](https://testparty.ai/blog/wcag-animation-interactions-guide)
- Blinking content distracts people with attention deficit disorders and can make the rest of a page hard or impossible to use for people with reading disabilities; 5-second limit for auto-moving content; ≤ 3 flashes per second — [W3C Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Splitting text into chars breaks screen-reader reading unless the parent gets an aria-label (SplitText `aria: "auto"`) — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- Splitting chars only can cause odd line breaks — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)

### Inferences
- Stagger budget: total reveal time = dur + (n − 1)·each. Keep it ≤ ~800 ms for UI labels (e.g. 10 letters × 40 ms + 400 ms = 760 ms); for long strings switch from `each` to `amount` (cap spread at 300–400 ms) or stagger by word.
- Letters should become legible early: opacity should reach ~1 within the first 40–60% of each letter's motion, and large rotations (3D flips > 60°) should resolve before the overshoot phase.
- Reduced-motion fallback for our engine: no position/rotation/scale travel, no shake, no 3D label rotation; keep opacity crossfade 150–200 ms and a static glow; number changes swap instantly (or fade). Also tie into the project's existing lite mode.
- Comfort: avoid continuous whole-label rotation, large-amplitude idle loops, and full-screen text zooms; flashes ≤ 1 per event and never > 3/s; shake amplitude small and ≤ 400 ms.

### Gaps
- No quantitative research found on maximum per-letter stagger before words stop being readable; the ≤ 800 ms budget is an inference from NN/g durations.

---

## 6. What separates expensive-looking motion from cheap

### Takeaway
Premium = good easing (strong ease-out / tuned springs, never linear), overlapping stagger with a secondary property settling later, restraint (short, subtle, purposeful), interruptibility, 60 fps transform/opacity-only motion, and one consistent timing/easing token system. Cheap = linear or default ease, everything starting/ending together, long durations, gratuitous bounces on everything, square (blocky) selector shapes, and effects that run continuously.

### Cited Findings
- Linear motion looks unnatural; ease-out is the default for responsiveness — [NN/g](https://www.nngroup.com/articles/animation-duration/)
- Default Square range shape looks choppy/blocky; Ramp Up + Ease Low 100% gives soft landings — [PremiumBeat](https://www.premiumbeat.com/blog/animate-individual-letters-in-after-effects/), [ProVideo Coalition](https://www.provideocoalition.com/cmg_hidden_gems_chapter_21_textacy/)
- Cascading stagger (3–5 frames) "reads as polished and deliberate"; motion blur makes fast moves cinematic but use sparingly; subtle beats excessive — [Miracamp](https://www.miracamp.com/learn/motion-graphics/best-techniques-mg)
- Great animations: under 300 ms, ease-out, 60 fps, transform/opacity only, interruptible (retarget from the current value), purposeful, reduced-motion aware; deliberate slower "elegant" exceptions exist (Sonner toast uses `ease`) — [Emil Kowalski](https://emilkowal.ski/ui/great-animations)
- Apple-style guidance (secondary): critically damped (ζ 1.0) by default; bounce (~0.8) only when the gesture carried momentum — overshoot on something that just faded in feels wrong — [Emil Kowalski apple-design skill mirror](https://mcpservers.org/ru/agent-skills/emilkowalski/apple-design)
- Material separates "spatial" springs (ζ 0.9, slight overshoot allowed) from "effects" springs (ζ 1.0, no overshoot for opacity/color) — [Material Components Android Motion.md](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md)
- Splitting many elements is expensive; revert/clean up after animating — [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)

### Inferences
Premium checklist for our engine:
1. **Easing quality**: entrances on a strong decelerate (0.05,0.7,0.1,1)/expo.out; springs with ζ chosen by intent (0.9–1.0 for UI settle, 0.5–0.7 only for celebratory moments). Never linear except for loops' phase and scroll of reels at constant speed.
2. **Bounce is a budget**: reserve overshoot for "win/celebration" labels; neutral labels use ζ ≥ 0.85. Opacity/glow never overshoot (effects ζ = 1).
3. **Overlap**: per-letter stagger + secondary channel lag (rotation/scale settle 60–120 ms after position) + label-level secondary (micro shake/shine) triggered by the last landing.
4. **Smear instead of real motion blur**: stretch along velocity (scale 1 + k·|v|, clamp 1.3) and 1–3 ghost copies for 1–2 frames on very fast moves; cheap on GPU and reads as blur.
5. **Consistent timing system**: one token table (100/200/300/450/600–800 ms; 20/30–40/50–60 ms stagger), same preset for the same semantic event everywhere (matches project rule "Консистентно").
6. **Interruptibility**: every per-letter channel is a spring/tween that can retarget from current value + velocity (critical for counters that change mid-animation).
7. **Restraint & cost**: idle = sparse (shine every few seconds) rather than continuous; no near-miss-style fake reveals (project honesty rule); lite / reduced-motion paths.
8. **Sound/haptic sync**: landing events (drop, slot stop, flap) coincide with tick/haptic at the frame of max squash — the impact frame, not the start.

### Gaps
- Val Head, Rachel Nabors and School of Motion texts were not fetched in this session; no quotes from them included.
- No measured user study found comparing "premium vs cheap" perception for specific easing values.
