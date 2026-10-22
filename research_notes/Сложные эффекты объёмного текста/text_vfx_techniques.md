# Shader techniques for game-quality effects on SDF-based 3D text (WebGL1, mobile)

Context assumed: glyphs are a 2D SDF per glyph, `d2(p.xy)`, extruded to 3D (`d3 = max(d2, abs(p.z) - h)` or rounded variant), sphere-traced in a single pass with per-letter transforms. We already have face/side shading, glow and baked noise (see recent commit "запечённый шум"). Everything under "Inferences" is engineering derivation, not sourced fact. Costs are rough estimates (inference) in "units" ≈ one texture fetch or about 10 ALU ops, per shaded pixel, on top of the base trace.

Research limits: iquilezles.org returned 404 for every fetch attempt and the Codrops Gommage article returned 403. Facts from those sources come from search snippets only. Most formulas below are standard shader practice, written from knowledge and marked as inference.

---

## 1. Dissolve / burn-away / materialize, pixel/voxel dissolve, sand/disintegrate

### Takeaway
All dissolves share one recipe: compare noise to an animated threshold, use smoothstep for anti-aliasing, and paint an emissive band just above the cut. On extruded SDF text the main choice is where to cut. A shading-only discard is cheap, but the hole shows nothing behind it. Cutting inside the SDF makes real 3D holes with walls, but it needs a Lipschitz-safe step. Sand and dust need particles spawned at the dissolve front, not a pure shader.

### Cited Findings
- The basic setup of "virtually every dissolve shader" is Noise → Step → Alpha — [Mirza Beig, Unity Dissolve Part 1](https://mirzabeig.substack.com/p/unity-tutorial-dissolve-shader-part-1)
- The glowing edge comes from a second, slightly offset threshold, and the gap between the two thresholds is the band. The glow then follows the dissolve front rather than the sprite outline. Smoothstep instead of step keeps the edge smooth at any zoom — [GameDev.net shaderlab: sprite dissolve](https://gamedev.net/shaderlab/14-sprite-dissolve-effect/)
- Reference code (Godot, CC0): `threshold = smoothstep(n - bs, n, dissolve); border = smoothstep(n, n + bs, dissolve); alpha *= threshold; rgb = mix(burn_color, base, border);` Here `bs = burn_size * step(0.001, dissolve) * step(dissolve, 0.999)`, which stops a leftover burn dot at 0 or 1. The author's recommended burn size is 0.04, with Simplex Smooth noise. A noise texture smaller than the target gives a blurry result — [godotshaders: 2D dissolve with burn edge](https://godotshaders.com/shader/2d-dissolve-with-burn-edge/)
- In Unity, the glow typically comes from an HDR edge colour plus bloom — [Mirza Beig, Part 1](https://mirzabeig.substack.com/p/unity-tutorial-dissolve-shader-part-1); [Game Developer: Shader Graph dissolve](https://gamedeveloper.com/design/unity-shader-graph-quick-tutorial---dissolve-shader)
- Particles emitted from the edge of the dissolving mesh are a standard companion to emissive dissolve — [Codrops: Implementing a Dissolve Effect with Shaders and Particles in Three.js (Jatin Chopra)](https://tympanus.net/codrops/?p=86603)
- Codrops, Jan 2026: MSDF text dissolved by a noise-driven shader, with synchronised dust and petal particles and selective bloom via MRT (WebGPU/TSL), inspired by the "Gommage" in Clair Obscur: Expedition 33. Article not fetched (403); description is from the search snippet — [Codrops: WebGPU Gommage Effect](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/)

### Inferences
**A. Shading-only burn on face and sides (cheapest; per-letter param `prog`).**
```glsl
// q = hit point in letter-local space (after inverse per-letter transform)
float n  = texture2D(uNoise, q.xy*uNS + seed).r;          // baked simplex/value noise, 1 fetch
n = mix(n, q.y*0.5+0.5, uDirBias);                         // optional: burn bottom→top / left→right
float e  = n - prog;                                       // <0 = burnt
if (e < 0.0) { /* treat as miss: continue march or discard */ }
float glow = 1.0 - smoothstep(0.0, uEdgeW, e);             // uEdgeW ≈ 0.03–0.06
float char = 1.0 - smoothstep(uEdgeW, uEdgeW*3.0, e);      // dark char band behind glow
col = mix(col, col*0.25, char);                            // char
col += uBurnCol * glow * uBurnI;                           // emissive (orange→yellow ramp on glow^2)
```
- Cost: about 1–2 units. To show the letter's far side through a hole you have to keep marching after a rejected hit, which can double the steps on those pixels. A simpler fallback is to discard and show the background, which looks like "paper burning".
- Use 3D noise, or 2D noise on (q.xy + q.z·k), so the side walls burn coherently with the face. A single 2D fetch on q.xy makes the sides burn in vertical streaks. That is acceptable, because extrusion sides are thin.
- Materialize is the same shader with `prog` running from 1 to 0. Swap the burn colour for a cyan/white "build" colour and add a scanline: `glow += step(fract(q.y*40.0 - t*4.0), 0.1)*glow`.

**B. True holes in the SDF (prettier, about 2× cost on affected pixels).** Use `d = max(d3, (prog - n(q)) * s)`. Sphere tracing then sees real cavities with lit inner walls. Noise has a gradient, so the field is no longer 1-Lipschitz: scale the step by about `1/(1 + s·|∇n|)`, or clamp `s` small. Otherwise the tracer overshoots and leaves speckle holes. Noise must be smooth (value or simplex from a filtered texture), never a hash.

**C. Pixel / voxel dissolve (per-letter params `prog`, `dir`, `seed`).**
```glsl
vec2 cell = floor(q.xy / uCell);                     // uCell ≈ glyph_height/12..24
float h = hash12(cell + seed);                       // per-cell random order
float order = mix(h, dot(cell*uCell, dir)*0.5+0.5, uSweep);
if (order < prog) reject;                            // the whole cell vanishes at once
float edge = 1.0 - smoothstep(0.0, 0.05, order - prog);  // cells about to go flash
```
- Cost: about 0.5 unit. For real voxels (cubes popping out), hand the vanished cell centres to the particle engine (Горн) as quads or cubes. The CPU knows each cell's order deterministically, so it can spawn a particle at the moment `order` crosses `prog`.

**D. Sand / disintegrate.** Run the pure dissolve (A or C) with a fine noise scale plus a directional bias (wind). Then emit particles from the front: sample N points per frame where |n − prog| < edge on the CPU, which is cheap for a known glyph outline, and give them velocity = wind + curl-ish jitter. The shader alone cannot move matter. Particle colour should match the face colour at the spawn point.

- Per-letter data for all of these: `prog` (0..1), `seed`, optional `dir` (vec2). This fits in one vec4 per letter.

### Gaps
- No primary source for Lipschitz-correct noise-displaced SDF tracing on mobile. iq's distance-function articles could not be fetched.
- The exact Gommage implementation (noise type, band width) is unread because the article returned 403.

---

## 2. Material / look effects: glitch, holographic, neon, fire/lava, ice, gold/chrome, glass, rim/fresnel

### Takeaway
Each look is a cheap function of data the tracer already has: normal N, view V, letter-local q, 2D distance d2 and face/side id. Noise comes from the baked texture. Only glass refraction of a real background, and screen-space RGB split, need an extra render target. Matcap or procedural environment is the cheapest route to chrome and gold.

### Cited Findings
- **Matcap / spherical env mapping:** `r = reflect(e, n); m = 2.0*sqrt(r.x*r.x + r.y*r.y + (r.z+1.0)*(r.z+1.0)); uv = r.xy/m + 0.5; base = texture2D(tMatCap, uv).rgb;` Here e is the view-space eye vector and n the view-space normal. Per-pixel evaluation matters most along object edges — [clicktorelease: Creating a Spherical Reflection/Environment Mapping shader](https://clicktorelease.com/blog/creating-spherical-environment-mapping-shader)
- A matcap fakes the specular term and computes no actual light. A photo of a golden sphere lit from the left makes the object look like gold lit from the left. Lighting is fixed to the camera angle and does not react to scene lights — [clicktorelease](https://clicktorelease.com/blog/creating-spherical-environment-mapping-shader); [Godot forum: fake reflection](https://forum.godotengine.org/t/how-to-create-a-fake-screen-reflection/143501); [godotshaders: view matcap](https://godotshaders.com/shader/view-matcap/)
- **Iridescence, cheap version:** offset R, G and B sine waves over film thickness to mimic the soap-film spectrum. Parameters: thickness range and falloff, tuned by eye — [BlendSwap: Realistic thin film iridescence](https://www.blendswap.com/blend/21348)
- **Iridescence, real-time code:** Unity SRP evaluates thin-film reflectance with a closed-form, Gaussian-weighted cosine fit. Its comments say Schlick Fresnel "is a very poor approximation" for iridescence, so it uses an iridescence mask instead — [Unity SRP commit](https://plastichub.unity.cn/unity-tech-cn/ScriptableRenderPipeline/commit/45283ab4-a68c-4689-8093-a5a29d8af3d0)
- A real-time multi-layer thin-film method trades physical accuracy for speed and handles thickness that varies across the surface — [Utrecht thesis: Rendering Iridescent Objects in Real-time](https://studenttheses.uu.nl/handle/20.500.12932/15359)
- **Glitch:** cut the image into horizontal bands and jerk them by a hash-based random amount (`fract(sin(...))` rand), instead of a continuous sine displacement — [ProAndroidDev: VHS Glitch Shader for Compose](https://proandroiddev.com/vhs-glitch-shader-for-compose-from-zero-to-production-3139d74c48e8)
- **Chromatic aberration:** sample red at uv + offset and blue at uv − offset with green fixed. The radial variant grows the offset toward the edges — [skill collection: shader-effects](https://skillselion.com/skills/bbeierle12/skill-mcp-claude/shader-effects); [Derivative: GLSL chromatic aberration](https://derivative.ca/community-post/tutorial/easy-glsl-chromatic-aberration-touchdesigner/66870)
- **Neon:** layered glow is a sharp bright core plus a blurred halo added back. For real-time blur, use a separable Gaussian — [Codemia: neon glow algorithm](https://codemia.io/knowledge-hub/path/algorithm_for_neon_glow_graphics_programming)
- **Neon startup flicker pattern** (CSS component): 4–6 rapid on/off blinks at random intervals, plus an occasional dim on a single character — [shadcn.io neon text](https://www.shadcn.io/text/neon-text)
- After Effects neon advice: turn individual elements off and on briefly ("wink"), and control the core-to-edge gradient with a range setting — [Adobe: neon glow effect](https://helpx.adobe.com/lt/after-effects/how-to/neon-glow-effect.html)
- **SDF bevel/lighting:** take the gradient of the distance field to get edge angles and light with it — [Red Blob Games: distance field effects (2024)](https://www.redblobgames.com/blog/2024-03-27-distance-field-effects/)

### Inferences (formulas)
Common inputs: `N, V`, `NdV = clamp(dot(N,V),0,1)`, `q` (letter-local), `d2` (2D distance at hit, ≤0 inside), `isSide`, per-letter `seed`, `t`.

- **Rim / fresnel (≈0.2 unit).** Schlick `F = F0 + (1-F0)*pow(1-NdV,5)`. Stylised rim: `rim = pow(1-NdV, p)` with p≈2–4, times rimCol. On extruded text, also add a face-edge rim from the 2D field, `edge = 1-smoothstep(0, w, -d2)`, which outlines the cap even when N faces the camera. That is cheaper and more readable than a fresnel rim on front-facing text.

- **Holographic / iridescent (≈0.5 unit).** Use a cosine palette (iq): `pal(x) = a + b*cos(6.28318*(c*x + d))`. Typical rainbow values: a=b=vec3(0.5), c=vec3(1), d=vec3(0,0.33,0.67). Drive it with something view-dependent: `x = NdV*k1 + q.y*k2 + noise*k3 + t*k4`. Thin-film flavour: `phase = 2*n_film*thick*sqrt(1 - sin²θ/n²)`, then `rgb = 0.5+0.5*cos(6.28318*phase*vec3(1/0.65,1/0.53,1/0.45))` (wavelengths in µm, thick ≈0.3–1 µm, mod by noise). Blend with `mix(base, irid, pow(1-NdV,1.5))`, then add a sparkle term: `step(0.995, hash(floor(q.xy*200)+floor(t*8)))*NdV`.

- **Neon tube from the SDF band (≈0.5–1 unit).** The tube runs along the outline, inset by r0: `dt = abs(d2 + r0) - w`, where w is half the tube width. Core: `core = 1 - smoothstep(-aa, aa, dt)`. Hot centre: `hot = exp(-pow(abs(d2+r0)/w,2)*3)`, which whitens the core. Halo, analytic with no blur or RTT: `halo = exp(-max(dt,0)*k)` with k≈8–20/glyph-height, or `1/(1+pow(dt/r,2))`. Colour: `col = tubeCol*core + white*hot*0.6 + tubeCol*halo*I`. For a 3D tube, give the extruded letter a round cross-section, `d3 = length(vec2(abs(d2+r0)-0? , p.z)) - w`, i.e. a torus-like sweep of the outline. This gives true 3D neon with specular, at the same trace cost. Flicker is per-letter: `f = flick(i) = (hash(i + floor(t*rate)) > thr) ? dim : 1.0`, with rate ≤ 3 Hz for big luminance changes (see section 9). Use "buzz" for constant life: `1 - 0.03*sin(t*120 + i)`, which is sub-threshold.

- **Fire / lava (≈2–4 units).** Scroll fBm upward in letter space: `u = q.xy*s + vec2(0, -t*speed)`, `n = 0.5*N(u) + 0.25*N(2u+o1) + 0.125*N(4u+o2)`, 3 baked fetches. Height mask: `m = n - (q.y - y0)*falloff`. Ramp `col = ramp(m)` through a 1D texture or a 3-stop mix: black → red → orange → yellow → white. Lava: ridged noise `r = 1 - abs(2n - 1)`, with cracks `= pow(r, 8)` emissive orange over a dark crust (`base*0.15`); crust darker on the face, glow stronger in grooves (`-d2` small). Flames above the letter: use the 2D SDF outside the glyph, `flame = smoothstep(0, -0.2, d2 - n*amp*max(0, q.y-y0))` (domain-warped outside region). These pixels are misses, so they cost a fetch only near the letter's bounding quad.

- **Ice / frost (≈1–2 units).** Base pale cyan, plus strong fresnel (`F0≈0.02`, exponent 3), plus normal perturbation `N = normalize(N + (noiseGrad)*0.15)` (2 fetches for the gradient, or use a baked normal-noise texture). Frost crystals: baked Voronoi/cell texture (procedural Voronoi needs about 9 cells, roughly 3–5 units, so bake it). Frost spreads from the edges: `frost = smoothstep(fr, fr - 0.05, -d2 + n*0.1)`. Inner "depth" tint by interior distance: `col = mix(deep, surf, exp(d2*k))`, where -d2 deeper inside gives a darker blue. Glints: hash sparkle as in holo.

- **Gold / chrome (≈0.5–1 unit).** Option 1 is a matcap texture (gold or chrome PNG; 1 fetch, formula above). Option 2 is a procedural env from the reflection vector `r = reflect(-V,N)`: `sky = mix(horizonCol, skyCol, smoothstep(0, 0.6, r.y)); ground = mix(horizonCol*0.3, groundCol, smoothstep(0, -0.4, r.y)); env = r.y>0 ? sky : ground; env += hLine*exp(-abs(r.y)*40)` (the bright horizon line is the classic "chrome" read). For gold, multiply by a gold tint (≈ vec3(1.0, 0.78, 0.34)) and use fresnel toward white at grazing angles. Animated sheen: rotate env around Y with `t`, or add a moving band `exp(-pow((q.x - sweep)/w, 2))` along the face. Per-letter phase offset gives a sequential shine.

- **Glass / crystal fake refraction (≈1–4 units).** With a background texture (needs the scene behind rendered to a texture, or a known gradient): `uvR = screenUV + N.xy*eta*thick`, with thickness from the 2D field `thick = clamp(-d2*k, 0, 1)`. That is a free "thicker in the middle" proxy, unique to SDF text. Dispersion: 3 fetches with eta·(1±0.03) for R and B. Add fresnel reflection of the procedural env, plus an inner bright edge `exp(-(-d2)*k2)` that fakes total internal reflection. Without a background texture, refract into the procedural env (reflect → refract with `refract(-V, N, 1/1.5)`) and tint. Crystal facets: quantise N to 6–8 directions (`N = normalize(floor(N*3+0.5))`) for a cut-gem look.

- **Glitch on traced text.** The cheapest variant offsets the ray before tracing, which covers slice shift and jitter: `row = floor(screenUV.y*uRows); h = hash(row + floor(t*uRate)); off = h > uThr ? (h-0.5)*uAmp : 0.0; ro.x += off` (or shift screenUV). Cost is about 0. RGB split options: (a) shade once, then shift only the colour of edge pixels by sampling `d2` at ±offset in letter space (2 extra 2D fetches) and put the coverage into the R and B channels. Fake but cheap, about 2 units. (b) A true 3-channel split needs three traces (3×) or a post-pass on a render target. Scanlines: `col *= 0.85 + 0.15*sin(screenUV.y*H*3.14)`. Block noise: `step(thr, hash(floor(screenUV*vec2(8,24)) + floor(t*12)))` to invert or tint blocks. Glitch should be bursty (100–300 ms bursts, gaps of 0.5–2 s), not constant. That matters for readability and for flash limits.

### Gaps
- No Shadertoy pages were fetched (no search returned direct shader code). The Shadertoy glow ldKyW1 is referenced only by name in the [Khronos thread](https://community.khronos.org/t/port-a-shadertoy-glow-shader/105941).
- No measured mobile costs per effect were found. All unit costs are estimates.

---

## 3. Outline draw-on, handwriting reveal, light chase (marquee bulbs)

### Takeaway
An SDF does not encode where along the contour a point lies, so draw-on and bulb chase need extra baked data. The best option is a per-glyph "contour parameter" channel, the arc length s of the nearest contour point, computed when the atlas is built. An angle-around-centre fallback costs nothing but only works for round glyphs. True handwriting needs stroke centrelines, which outline fonts do not have.

### Cited Findings
- Arc-length normalisation: compute the contour's total length on the CPU, pass it to the shader, and divide each fragment's contour position by it to get 0..1 progress — [OPENRNDR forum: colorizing strokes along length](https://openrndr.discourse.group/t/colorizing-strokes-along-its-length-and-width/764)
- Varying alpha by accumulated arc length is a simple way to make dashes and partial strokes — [Inkscape-devel mailing list](https://lists.inkscape.org/hyperkitty/list/inkscape-devel@lists.inkscape.org/message/56MG6T7VGBH4HQX74UNEBKONVELS2YOS/)
- An SDF outline is a second distance threshold band (fill if d<0, edge if d<0.1). The distance field alone gives no position along the contour — [Red Blob Games](https://www.redblobgames.com/blog/2024-03-27-distance-field-effects/)
- Arc-length texturing of stroked paths is a standard capability in GPU path stroking — [NVIDIA Polar Stroking paper](https://arxiv.org/pdf/2007.00308)

### Inferences
- **Bake step (CPU or worker, at atlas build).** When the SDF is built from the glyph's polyline or bezier outline, the nearest-segment search already finds the closest segment j and the parameter u on it. Store `s = (cumLen[j] + u*segLen[j]) / totalLen` in a second channel (G of the RGBA8 atlas). With multiple contours ('O', 'B', 'А'), either concatenate them (s runs over all contours in order, drawn sequentially) or store a per-contour normalised s plus a contour index in B (all contours drawn in parallel). Extra cost is zero runtime and about 1× atlas bake time. 8-bit s gives 256 steps, enough for a reveal; use 16-bit (G+B) for bulb spacing.
- **Seam:** s jumps from 1 to 0 at the contour start. Bilinear filtering across the seam produces a streak, so either sample s with an explicit nearest or texelFetch emulation, or store `(cos 2πs, sin 2πs)` in two channels and recover s with `atan`. Only near-contour texels matter (|d2| < band), so s can be left undefined elsewhere.
- **Draw-on shader (per-letter param `prog`, plus a global or letter offset for sequencing):**
```glsl
float s = texture2D(uAtlas, uv).g;                   // contour param at this texel
float band = 1.0 - smoothstep(w - aa, w + aa, abs(d2));   // outline band
float on  = 1.0 - smoothstep(prog - soft, prog, s);       // revealed part
float head = exp(-pow((s - prog)/0.01, 2.0));             // hot pen tip
col = strokeCol*band*on + tipCol*band*head*2.0;
// then fill fades in after: fill = smoothstep(0.8, 1.0, prog) * (d2 < 0 ? 1 : 0)
```
  Cost is about 0.5 unit, since the atlas fetch already happens. For 3D, apply the band on the cap face only, or extrude the stroke itself (`d3 = max(abs(d2)-w, abs(z)-h)` masked by `on`). Masking via SDF makes a real 3D "tube being drawn", but `on` is discontinuous, so use it as a reject test, not inside the distance.
- **Zero-data fallback:** `s = atan(q.y - cy, q.x - cx)/6.283 + 0.5` around the glyph centre. Fine for O, 0, C and S-ish shapes; wrong for T, H and 1, where the reveal jumps between strokes. Good enough for digits shown at speed.
- **Marquee bulbs / light chase (per-letter `phase`).** Use an absolute arc length `S = s*totalLen` (pass totalLen per letter, or store unnormalised s scaled by a constant). Bulb index `k = floor(S/spacing)`, local `x = (fract(S/spacing)-0.5)*spacing`, bulb distance `db = length(vec2(x, d2 + inset)) - r`. Lit state: `lit = step(0.5, fract((k + floor(t*chaseRate))/3.0))`, which lights every third bulb in a moving pattern. Bulb colour is `mix(offCol, onCol, lit)` with core plus exp halo as in neon. Spacing should divide totalLen, or bulbs bunch at the seam: `spacing = totalLen/round(totalLen/spacing0)`. Chase rate: the pattern moves, but each bulb toggles at rate/3. Keep per-bulb toggles at ≤3 Hz, or use a smooth sine fade instead of on/off.
- **Handwriting reveal:** with outline fonts, a true pen path needs authored or computed centrelines (medial axis or skeletonisation of the glyph bitmap at bake time, then ordering the strokes by hand per glyph). Cheap fakes: (1) a draw-on of the outline followed by a fill wipe; (2) a directional wipe along the writing direction with a noisy edge, `on = step(q.x + n*0.05, prog)`, staggered per letter with a slight upward slant; (3) for digits only, hand-authored stroke polylines for 0–9 (10 glyphs, small data), baked as an s-channel the same way.

### Gaps
- I found no published SDF-font engine (TMP, msdfgen, Slug) that ships a contour-parameter channel. The design above is an inference.
- No source was found on automatic stroke ordering for handwriting from outline fonts.

---

## 4. Per-letter colour effects: rainbow sweep, sequential light-up, heat by velocity, flash on impact

### Takeaway
All of these are a per-letter scalar fed into a palette or ramp. The real work is getting per-letter data to the fragment at the hit. A small RGBA8 data texture indexed by letter id is the portable WebGL1 route, because fragment uniform arrays are small and dynamic indexing of them in fragment shaders is not guaranteed.

### Cited Findings
- No specific source was found for per-letter colour animation in shaders. The cosine palette (iq) is widely used but [iquilezles.org](https://iquilezles.org/articles/rmshadows) could not be fetched (404). See Gaps.
- TextMeshPro exposes per-character vertex offsets for scripted crawl or scroll effects, and multiplies Face Color with vertex colours. Per-letter colour animation in TMP is done by scripts writing vertex colours — [Unity TMP Distance Field shader docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)

### Inferences
- **Per-letter data layout (proposal):** a texture `uLetters` of N×2 RGBA8. Row 0: `prog`, `seed`, `flashT`, `speed`. Row 1: `hue`, `phase`, `fxMask`, spare. Read it at the hit using the letter id the tracer already knows from its per-letter transform loop: `texture2D(uLetters, vec2((id+0.5)/N, 0.25))`, which is 1–2 fetches per hit pixel. Alternatively pass a vec4 uniform per letter and select with an unrolled if-chain or loop over letters (constant loop bounds are required in GLSL ES 1.00), which is fine for ≤8–16 letters. Inference based on the GLSL ES 1.00 spec (Appendix A) and the GLES2 minimum of 16 fragment uniform vectors. Both are from knowledge, not fetched.
- **Rainbow sweep:** `x = i/n*cycles - t*speed + q.x*k` (k>0 makes the hue also vary within a letter, so the sweep reads continuous across letters). Then `col = pal(x)`. Cost about 0.2 unit.
- **Sequential light-up:** `on_i = smoothstep(i*dt, i*dt + rise, t - t0)` per letter, with an overshoot pulse `pulse = on_i * exp(-(t - t0 - i*dt)*decay)`. Then `col = mix(dimCol, litCol, on_i) + white*pulse*0.6`. Pair it with a scale pop on the same timeline. The CPU computes it, so it costs nothing in the shader except the colour mix.
- **Heat-map by velocity:** the CPU knows each letter's velocity from its own animation (finite difference of position per frame). Pass `heat = clamp(|v|/vmax, 0, 1)`, smoothed with an exponential moving average (τ≈80 ms) so it does not flicker, and map it through a ramp (blue→white→orange→red) or blend in emissive `heatCol*heat`. Optional directional streak: brighten the trailing edge `max(0, dot(N.xy, -v̂))*heat`.
- **Flash on impact:** `flash = exp(-(t - tImpact)*k)` with k≈10–20 (about 50–100 ms visible). `col = mix(col, white, flash*0.8)`, emissive rather than replacing the lit colour so the shape stays readable. Add an expanding ring from the impact point using the 2D field: `ring = exp(-pow((-d2) - (t-tImpact)*speed, 2)/w)*flash`, an inner glow running inward. Count each impact as one flash for the ≤3 flashes/s rule. A cascade of letters landing 50 ms apart can exceed 3 per second if each is a full-white flash on a large area. Cap the intensity (<10% luminance change for later ones), or merge them into one global flash.

### Gaps
- No sourced numbers on readable rates for sequential light-up. Tuning is by eye.

---

## 5. Motion trails, ghost copies, smear frames, speed lines

### Takeaway
Without render-target feedback, trails must be analytic. Cheap options: 2D-only translucent ghosts (sample the glyph SDF at past transforms, no extrusion), and smear by "elongating" the SDF along the velocity vector, which keeps the field Lipschitz and traces at normal cost. Frame-feedback trails need ping-pong framebuffers (memory, plus breakage when the canvas resizes).

### Cited Findings
- No direct sources were retrieved for smear frames or SDF elongation (iq's distance-functions article was not reachable). See Gaps.

### Inferences
- **Smear frame (per-letter `v`, a vec2 or vec3 in local space, set by the CPU only while fast).** Apply the elongation operator along v̂ before evaluating the glyph: `float a = dot(q, vhat); q -= vhat*clamp(a, -L, 0.0);`, where L = |v|·Δt_smear, so the letter stretches backwards only. The field stays exact-ish (1-Lipschitz), so the march cost is unchanged. Visually this is the cartoon smear for 1–3 frames at the fastest point of a move. Optional taper: multiply the cap by `smoothstep` of a along the smear and fade alpha toward the tail. Cost about 0.
- **Ghost copies (k = 2–4).** For pixels missed by the main trace, inside the letter's swept bounding box, evaluate the 2D SDF at the past transforms `T_i(t - j·Δ)`: `g = Σ_j (1 - smoothstep(-aa, aa, d2(T_j⁻¹ p))) * α0*pow(decay, j)`, tinted with a colour shift per copy (e.g. hue −0.1·j, giving "Spider-Verse" offset copies). Cost is k fetches on background pixels near the letter, and no extra trace. Ghosts are flat (no side faces), which reads fine at 30–60% opacity.
- **Frame-feedback trail (most authentic, most memory).** Render to texture A, composite `B = max(A_new, B_prev*decay)` or a mix, and show B. That takes 2 extra canvas-sized RGBA8 FBOs (about 2×W×H×4 bytes; at 1170×2532 that is about 24 MB). Avoid it on the phone budget; prefer the analytic forms. Inference using the project's memory rule.
- **Speed lines (screen-space, anime).** In polar coordinates around a focus point c: `ang = atan(p.y-c.y, p.x-c.x); r = length(p-c); line = step(thr, hash(floor(ang*N)) ) * smoothstep(r0, r0+fade, r) * (1 - smoothstep(r1, 1.2, r));` Re-randomise every 2–3 frames with `+ floor(t*20)`, which is about 7 Hz of change per line but low-contrast, thin and white. Keep line alpha low so it is not a full-field flash. Horizontal streaks for lateral moves: `hash(floor(p.y*rows))` gates a thin line whose x-extent is `p.x < x_letter - len*hash2`. Cost about 0.3 unit on the background. Alternatively they could be particles in Горн.

### Gaps
- No primary source for elongation-as-smear on text, or for smear frames in real-time text engines. Inference.

---

## 6. Text along a path/arc/circle, wave baselines, 3D camera moves for title reveals

### Takeaway
Rigid per-letter placement along a path (position from arc length, rotation from the tangent) costs nothing and keeps the SDF exact. Bending glyphs themselves (domain warp) breaks the Lipschitz bound and needs smaller march steps. Camera dolly and orbit are uniform changes, but grazing angles raise step counts.

### Cited Findings
- Placing TextBlock characters along a path is a common engine feature request — [Noesis forum](https://www.noesisengine.com/forums/viewtopic.php?p=13116)
- TMP's per-character vertex offset is the hook for scripted per-letter motion — [Unity TMP docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)

### Inferences
- **Rigid on a path:** for letter i with advance-centre x_i along the baseline, find the path point P(s=x_i) and tangent T. Letter transform = translate(P) · rotate(atan(T.y, T.x)) (+ roll for 3D paths). CPU-side, using an arc-length lookup table for the bezier (sample 64–128 points, cumulative lengths). The circle is closed form: `θ_i = θ0 + x_i/R`, `P = c + R(cos θ, sin θ)`, rot = θ − π/2 for outward text. Shader cost: zero. Animating θ0 or s0 gives a scrolling ring (good for "spin" labels, a winner ring around the prize).
- **Wave baseline (rigid):** `y_i = A sin(k x_i − ωt + φ)`, rot_i = `atan(A k cos(...))`. Classic, cheap, readable.
- **Bending inside glyphs (true arc text):** for circle text with letters bent, map local p to polar `(R·atan(p.x, p.y+R), length(p+(0,R)) − R)` before d2. Distortion scales distances by r/R, so clamp the step to `d·min(1, r/R)`. For a wave warp `p.y -= A sin(k p.x + ωt)`, the Lipschitz factor is `sqrt(1 + (A k)²)`, so multiply the step by `1/sqrt(1+(Ak)²)`. With Ak=1 that is about 30% more steps. Use it only for big hero text.
- **Camera moves (title reveals):** expose `ro`, `target` and `fov` as animated uniforms. Recipes: (1) dolly-in with slight orbit: `ro = target + R(t)·(sin φ(t), 0.15, cos φ(t))`, with φ easing from 25° to 0° over 0.8 s and R easing in, so the side faces reveal the extrusion and then settle front-on for readability; (2) dolly-zoom (vertigo): `dist = W/(2 tan(fov/2))` kept constant in framing while fov animates 20°→60°; (3) a crane-down from above (pitch 40°→0°), which shows the top faces (good with gold). Pitfall: grazing rays along long side faces need more steps (the step budget is hit at silhouettes). Keep the max angle at 30–40° or raise the step cap only during the move, and use a lower resolution scale during the move.

### Gaps
- No sources found on how Spline or Rive implement path text or camera reveals (not researched within the tool budget).

---

## 7. Shadows (soft drop and contact) and floor reflection

### Takeaway
For extruded 2D-SDF text, the cheapest convincing shadow is analytic: sample the glyph's 2D SDF at the shadow-receiver point projected along the light, with softness growing with distance (TMP's "Underlay" is the 2D version). Full raymarched soft shadows (iq's k·h/t penumbra) cost an extra 16–32 steps per pixel. Floor reflection can be a cheap mirrored 2D lookup, or a reduced-step second trace.

### Cited Findings
- iq's raymarched soft shadow: as the shadow ray marches toward the light, each step computes a penumbra factor and keeps the darkest one (`res = min(res, k*h/t)`, where h is the distance at step and t the distance travelled; k = sharpness). Sebastian Aaltonen presented an improvement at GDC that reduces banding. Limitation: marching can miss the point of darkest penumbra — [Inigo Quilez: rmshadows](https://iquilezles.org/articles/rmshadows) (snippet only, page 404 on fetch); [GameDev.net shaderlab: soft shadows & AO](https://gamedev.net/shaderlab/32-soft-shadows-and-ambient-occlusion/)
- A practical value: penumbra sharpness constant k = 32 in an "IQ recipe" demo — [daslang SDF tutorial](https://daslang.io/doc/tutorials/opengl/03_sdf.html)
- Rays parallel to the light take near-constant steps and make patterned shadows. Fix: jitter the ray origin toward the light, plus TAA — [RTSDF paper, arXiv 2210.04449](https://arxiv.org/pdf/2210.04449)
- TMP Underlay is a second rendering of the glyph beneath it (drop shadow), with Offset X/Y, Dilate and Softness. The "Inner" type gives an inner shadow. A thick outline can cover the underlay — [Unity TMP docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html); [Unity discussions](https://discussions.unity.com/t/textmesh-pro-thick-outer-outline-eats-into-font-face-and-covers-underlay-drop-shadow-how-to-fix/1721451)
- Shadows benefit from SDF rounded corners (vs MSDF) — [Red Blob Games](https://www.redblobgames.com/blog/2024-03-27-distance-field-effects/)

### Inferences
- **Analytic drop or contact shadow (1–2 fetches per receiver pixel).** Receiver = the floor plane y=y_f, or a back plane. For a floor point P, intersect the ray P + L·s with the letter's mid-plane z=0 (in letter space) to get Q. Let h = distance from P to Q. `sh = smoothstep(-soft0 - h*kSoft, soft0 + h*kSoft, d2(Q.xy))`, then `shadow = 1 - (1-sh)*opacity*exp(-h*kFade)`. This gives contact hardening for free: sharp where letters touch the floor, softer further away. For several letters, loop over the ≤N letters whose shadow bounding box covers P (CPU-provided list, or just all of them for short words; each iteration is one fetch). Plus contact AO: a dark ellipse blob `exp(-pow(dist_to_letter_base/r, 2))` under each letter, which sells "sitting on the floor" even more cheaply. The extrusion depth makes this approximate: treat the letter as a slab of thickness 2h_ext by also sampling at z=±h_ext and taking the min (2–3 fetches).
- **Full SDF soft shadow** (iq): 12–24 steps on mobile with `k≈8–16` (softer means fewer artefacts). Cap at a max distance, and only for receivers (floor), not for self-shadowing of the letter faces, where the side/face shading already covers it. Cost about 12–24 units on floor pixels. Use only for a hero shot.
- **Floor reflection:** (1) cheap: mirror the screen-space 2D look, i.e. for floor pixels sample the letter's face colour via d2 at the mirrored point, fade with `exp(-dist*k)` and a fresnel term `0.04 + 0.96*pow(1-cosθ,5)`, and blur by sampling d2 with a dilate proportional to distance (rough floor). No side faces, about 1–2 units. (2) Better: launch the reflected ray and trace with half the step budget and a larger epsilon, then shade with simplified lighting (no glow, no noise). About 0.5× base cost on floor pixels. (3) Add ripple or roughness by perturbing the reflection uv with baked noise (1 fetch).

### Gaps
- Aaltonen's improved formula itself could not be retrieved (iq page 404).

---

## 8. How existing tools do it (TextMeshPro, Unity, Saber, Element 3D, Spline, Rive, AE)

### Takeaway
TextMeshPro is the best-documented reference. Its SDF shader is a fixed set of layers: face, outline, underlay, bevel, lighting, environment, glow. All of it is driven by distance thresholds plus a few per-material parameters, and per-letter animation is done by scripts writing vertex data. Saber is a "core + glow + distortion along a path or text outline" model, the same as our neon or bulb approach. For Spline, Rive and Element 3D I found no technical sources within budget.

### Cited Findings
- TMP Face: Color (× vertex colour), Texture with Tiling/Offset/Speed (scrolling), Softness, and Dilate (moves the contour: negative thins, positive thickens) — [Unity TMP 4.0 Distance Field docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)
- TMP Outline: Color, Texture, Speed, and Thickness, centred on the contour (half inside, half outside; shift it with Dilate) — [same](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)
- TMP Bevel: Outer (raised letters, sloped sides) or Inner (raised outline). Amount, Offset, Width, Roundness, and Clamp (flat top). Local lighting has Light Angle (default ≈π, light above), Specular Color/Power, Reflectivity, Diffuse/Ambient Shadow, bump map, and a cubemap Environment Map with animatable Rotation — [same](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)
- TMP Glow is additive (more visible on dark backgrounds). Offset (0 = centred on contour), Inner and Outer extents, and Power for falloff (1 = bright, sharp linear falloff; lower = quick drop then gradual tail) — [same](https://docs.unity3d.com/Packages/com.unity.textmeshpro@4.0/manual/ShadersDistanceField.html)
- TMP caveat: effects grow the visual size of glyphs, and extreme values cause artefacts at the edges of character sprites (padding limits) — [Unity TMP docs (search summary)](https://docs.unity3d.com/Packages/com.unity.textmeshpro@3.2/manual/ShadersDistanceField.html)
- TMP has separate mobile SDF shaders with a reduced feature set (no lighting or glow sections in the mobile docs) — [TMP Mobile SDF docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@3.2/manual/ShadersDistanceFieldMobile.html)
- Saber (Video Copilot, free AE plugin): a light-beam "core" with start/end and offset, core size and softness, "realistic glow falloff" with intensity, spread and bias, built-in distortion, application to text and mask outlines, stackable effects, and 25 presets (one listing says 50) — [ProVideo Coalition](https://www.provideocoalition.com/saber-new-free-effects-plug-video-copilot/); [MotionArray review](https://blog.motionarray.com/learn/post-production/video-copilots-free-saber-plug-in-review/); [No Film School](https://nofilmschool.com/2016/03/force-strong-video-copilots-new-energy-plug)
- Codrops 2026: MSDF text, noise dissolve, synced particles, selective bloom via MRT (WebGPU) — [Codrops](https://tympanus.net/codrops/2026/01/28/webgpu-gommage-effect-dissolving-msdf-text-into-dust-and-petals-with-three-js-tsl/)

### Inferences
- Saber's "core start/end + offset along a text outline" is exactly the arc-length draw-on of section 3. Its glow "bias" corresponds to the exponent or power of an exp falloff, like TMP Glow Power. Our analytic neon (core + hot + halo) reproduces the Saber look without blur passes.
- TMP's Dilate, Outline, Underlay and Glow map one-to-one to `d2` offsets in our shader. Exposing the same parameter names would give designers a familiar mental model.
- Element 3D (extruded text with env-mapped materials) corresponds to our extrusion + matcap/procedural env + bevel. A matcap preset library would be the quick win.

### Gaps
- No technical documentation fetched for Spline (text effects or shader layers), Rive (text modifiers and runs), Element 3D, or AE text animators. Not covered due to the tool budget.
- Saber's flicker control is not confirmed by any source found.

---

## 9. Cost, per-letter parameters, mobile pitfalls, flash/flicker limits

### Takeaway
Keep every effect to a few baked-noise fetches and closed-form math evaluated only at the hit (or near-miss) pixel. Pack per-letter data into a tiny texture or a few vec4s. Avoid render-target post effects (bloom, true RGB split, feedback trails) on phones. Any effect that flashes large or bright areas must stay at ≤3 flashes per second or under the WCAG luminance and area thresholds.

### Cited Findings
- WCAG 2.3.1 (Level A): nothing may flash more than 3 times in any 1-second period, unless the flash is below the general flash and red flash thresholds — [W3C Understanding 2.3.1 (WCAG 2.2)](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- General flash: a pair of opposing changes in relative luminance of ≥10% of maximum, where the darker image is below 0.80 relative luminance. Red flash: any pair of opposing transitions involving saturated red (people are more sensitive to red) — [W3C Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html); [NYU 2.3.1 definition](https://digitalaccessibility.nyu.edu/testing/sc231.html)
- Area exemption: passes if the combined flash area stays within 0.006 sr in any 10° visual field (about 25% of any 10° field) at typical viewing distance — [W3C Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- A matcap is cheap: "you won't get better framerates using this method, but you probably won't get much worse" — [Godot forum](https://forum.godotengine.org/t/how-to-create-a-fake-screen-reflection/143501)
- Real-time glow halos usually use a separable Gaussian blur because a naive 2D blur is expensive — [Codemia](https://codemia.io/knowledge-hub/path/algorithm_for_neon_glow_graphics_programming)

### Inferences
**Per-letter parameter set** (covers all of the above; 2× vec4 per letter):

| slot | meaning | used by |
|---|---|---|
| prog | 0..1 effect progress | dissolve, draw-on, voxel, materialise |
| seed | random per letter | noise offset, flicker, glitch |
| flashT | time since impact (s) | flash, ring |
| heat | smoothed speed 0..1 | heat-map, smear length |
| vel.xy | local velocity (smear dir) | smear, ghosts |
| phase / hue | colour offset | rainbow, sequential, bulbs |
| fxMask | bit flags (which layers on) | branching |

Plus per-glyph static data in the atlas: G = contour param s (draw-on and bulbs), and optionally B = contour id or total length.

**Cost table (estimate, extra per shaded hit pixel; base trace not included):**

| effect | fetches | ALU | extra data | notes |
|---|---|---|---|---|
| rim/fresnel | 0 | low | – | always on |
| holo / cosine palette | 0–1 | low | – | sparkle hash cheap |
| neon tube + analytic halo | 0 | low | – | halo on miss pixels near letter |
| gold/chrome matcap | 1 | low | matcap tex | or procedural env, 0 fetch |
| burn dissolve (shading) | 1 | low | prog, seed | +march-through for holes |
| burn dissolve (SDF holes) | 1/step | med | prog | Lipschitz step scale |
| voxel dissolve | 0 | low | prog, dir | + Горн particles |
| fire/lava fBm | 3 | med | – | bake ramp |
| ice | 2–3 | med | baked voronoi | |
| glass refraction | 1–3 | med | background RTT | without RTT: env refraction |
| glitch slices/jitter | 0 | low | seed | bursty |
| RGB split (fake) | 2 | low | – | true split = 3× trace |
| draw-on / bulbs | 0 (atlas already fetched) | low | s-channel bake | seam handling |
| smear (elongate) | 0 | low | vel | march cost unchanged |
| ghosts k=3 | 3 on bg | low | past transforms | flat |
| analytic contact shadow | 1–3 per letter on floor | low | light dir | |
| iq soft shadow | 12–24 steps | high | – | hero only |
| floor reflection (cheap) | 1–2 | low | – | 2D mirror |
| floor reflection (traced) | ~0.5× trace | high | – | |

**Mobile pitfalls (GLSL ES 1.00 / WebGL1):**
- `precision mediump` is fp16 on many mobile GPUs. The classic `fract(sin(dot(p, k))*43758.5)` hash breaks with large inputs and large `t`. Wrap time (`mod(t, 100.0)`), use `highp` for hashes when available, or better, the baked noise texture (already in the engine).
- `fwidth`/`dFdx` need the `OES_standard_derivatives` extension in WebGL1. Prefer an AA width computed from the known pixel size (`aa = pixelWorldSize`) passed as a uniform.
- Loops need constant bounds in GLSL ES 1.00. Write the march step cap, ghost count and letter loops as constants with an early `break`.
- Float textures need `OES_texture_float`. Keep per-letter data in RGBA8, normalised (time as 0..1 over a known window, velocity offset by 0.5).
- Fragment uniform vectors: the GLES2 minimum is 16, and dynamic indexing of uniform arrays in fragment shaders is not guaranteed. Use the data texture, or unrolled per-letter branches (both from spec knowledge, not fetched).
- Branching on fxMask is fine if it is uniform across large regions (per letter). Avoid divergent per-pixel branches inside the march loop.
- Analytic glow or halo on miss pixels can cover large screen areas. Bound it with the per-letter screen quad or bounding box, and skip it in lite mode.
- Bloom, frame feedback and true chromatic split all need extra canvas-sized FBOs. Against the project rules (heat on iPhone, WebGL memory budget), prefer analytic substitutes and fire them only briefly.
- Effects that animate constantly (neon buzz, holo sheen, fire) keep the GPU busy every frame. Per the project rules ("iPhone heats from constant work"), run them only during the reveal moment, then freeze to a static frame or drop to 12 fps idle like the frame glow.

**Flicker and flash rules for our effects (inference applying WCAG):**
- Neon flicker, glitch bursts, bulb chase and impact flashes: at most 3 full-contrast on/off transitions per second for any region larger than about 25% of a 10° field. On a phone at about 30 cm, a 10° field is about 5 cm wide, so a big hero word easily exceeds the area exemption.
- Keep "buzz" and subtle flicker under a 10% relative-luminance change, which is not counted as a flash.
- Avoid saturated red flashing entirely (red-flash rule). Fire and lava should pulse slowly (<2 Hz) and smoothly, not strobe.
- Provide a reduced-motion or lite path that turns flicker into steady glow (it fits the existing lite mode).

### Gaps
- No measured per-effect frame times on an iPhone 11 or old Xiaomi. The cost table is estimated and needs on-device profiling (Debug → "Замер").
- GLES2 uniform limits and indexing rules are stated from spec knowledge and were not fetched in this session.
