# Rendering techniques for pseudo-3D / extruded text in WebGL1 (alternatives to "stack of N textured quads")

Context for the writer: the engine "Объём" (`src/app/16l-extrude.js`) draws each glyph as 15–65 stacked quads along depth, sampling an atlas with an 8-bit SDF plus precomputed edge normals, `discard` outside the glyph, alpha-blended back-to-front; per-letter offset/scale/rotation/alpha in the vertex shader. Target: iPhone 11 / old Xiaomi in Telegram WebView, no heating.

Research note on retrieval: iquilezles.org returned HTTP 404 / redirect loops to the fetch tool in this session, and the TextMeshPro shader source mirrors were unreachable. Formulas attributed to Inigo Quilez below are therefore marked as inferences (well-known, but not re-verified here); everything under "Cited Findings" was actually read this session.

## 1. Ray marching / sphere tracing an extruded 2D SDF on per-glyph proxy geometry

### Takeaway
Sphere-tracing an extruded (and optionally rounded/chamfered) glyph SDF inside a per-glyph box is the most direct replacement for the stack: one draw per glyph, no blending overdraw, correct at 90° rotation, and — because the atlas already stores edge normals — normals can be analytic with no extra texture fetches. Main risks are dependent-fetch loop cost on old Mali/Adreno, precision of an 8-bit SDF (terracing on bevels, overstepping at corners), and needing `OES_standard_derivatives` for anti-aliasing (effectively universal).

### Cited Findings
- `OES_standard_derivatives` (needed for `fwidth`/`dFdx` in WebGL1) is supported by 99.99% of browsers tested overall; iOS 100%, Android 99.99% — [web3dsurvey: OES_standard_derivatives](https://web3dsurvey.com/webgl/extensions/OES_standard_derivatives)
- The extrusion idea as used in tools: glyph coverage/SDF in XY, closed by two Z planes to form a solid slab — [TouchDesigner MCP "create_sdf_text" tool description](https://glama.ai/mcp/servers/Pantani/tdmcp/tools/create_sdf_text) (low-authority source; only confirms the concept)
- Pitfall when extruding a 2D distance field: a thin/sketch shape with zero interior distance gives a broken 3D SDF; ignoring Z gives an infinite extrusion — the Z term must be combined properly; with a draft (taper) angle the true distance is the in-plane distance scaled by cos(angle) — [incoherency.co.uk notes 2025-03-12](https://incoherency.co.uk/notes/20250312.html), [2025-03-13](https://incoherency.co.uk/notes/20250313.html)
- Union of SDFs is `min()`; core raymarch loop reference — [Cambridge Further Graphics 2018–19 slides](https://www.cl.cam.ac.uk/teaching/1819/FGraphics/Further%20Graphics%202018-2019%20(6-up).pdf) (foundational, pre-2020)
- For perspective rendering of a distance-field texture, msdfgen recommends computing the screen-space pixel range from fragment derivatives (`fwidth` of UV / unitRange), and it must never fall below 1 (below 2, AA likely fails) — [Chlumsky/msdfgen README](https://github.com/Chlumsky/msdfgen)

### Inferences
Formulation (IQ-style, canonical sources: [iquilezles.org/articles/distfunctions](https://iquilezles.org/articles/distfunctions/), [distfunctions2d](https://iquilezles.org/articles/distfunctions2d/), [normalsSDF](https://iquilezles.org/articles/normalsSDF/) — not re-fetched this session):
- Extrusion of 2D SDF `d2(p.xy)` to half-depth `h`:
  `vec2 w = vec2(d2, abs(p.z) - h); float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));` — exact if `d2` is exact.
- Rounded edges (round bevel of radius r): evaluate with `d2 + r` (shrunk glyph) and `h - r`, then `d - r`. This only works if the stored SDF spread covers at least `r` inside the glyph (thin strokes collapse when r > half stroke width).
- Chamfer (45° flat bevel of size c): `d = max(max(w.x, w.y), (w.x + w.y + c) * 0.70710678)` — a bound, not exact, fine for sphere tracing.
- Custom profiles (cove, step, "casino" double bevel) can be done as a 2D profile function of (w.x, w.y) — the "revolve a 2D profile along the outline" view; any 2D profile SDF in the (edge-distance, z) plane works.

Ray setup on proxy geometry (WebGL1/GLSL ES 1.00):
- Proxy: one box per glyph = glyph quad bounds (+ AA/bevel padding) × depth: 8 verts / 12 tris (or 36 non-indexed verts, still trivial). Per-letter transform (offset/scale/rotation) stays in the vertex shader exactly as now.
- Pass object-space position of the box surface as a varying (`vObj`). Camera position in glyph object space either per-glyph uniform/attribute (`camObj = inverse(model) * camWorld`, computed on CPU per letter — cheap, ≤ ~20 letters) or, for orthographic/near-ortho camera, a constant ray direction transformed to object space in the VS. In FS: `ro = vObj; rd = normalize(vObj - camObj)` (linear varying interpolation of the surface point is exact; normalize per fragment).
- Rasterize back faces (`gl.cullFace(gl.FRONT)`) so the camera can be inside/near the box without clipping, and compute `tNear/tFar` analytically by slab test against the box; march only in [max(tNear,0), tFar]. This bounds the march to the glyph's thickness, so step counts stay small.
- Loop must have a constant bound in GLSL ES 1.00: `for (int i = 0; i < STEPS; i++) { ... if (d < eps || t > tFar) break; }`. STEPS as a `#define` per quality preset (e.g. 12 / 20 / 32) → separate compiled programs.
- Early exit: hit when `d < 0.5 * pixelSizeAtT`; miss when `t > tFar`. Use a step factor ~0.8–0.9 because a bilinearly filtered 8-bit SDF is not a true distance near corners (overshoot → holes).
- Outside the stored spread, the atlas SDF saturates (clamped to max). Inside the glyph box that is harmless (the step is just the max spread); outside the atlas cell padding it is wrong, so clamp `p.xy` to the glyph cell and add `max(0, distance-to-cell)`.

Normals:
- Analytic, zero extra fetches: the gradient of the extrusion SDF is `vec3(n2 * max(w.x,0), sign(p.z) * max(w.y,0))` normalized in the outside region, `vec3(n2, 0)` on side walls (w.x > w.y), `vec3(0,0,sign(p.z))` on caps — where `n2` is the 2D edge normal. The engine already stores precomputed edge normals in the atlas, so normal = one fetch (same texel as the distance if packed into the same RGBA texel).
- Finite differences (tetrahedron, 4 evaluations; central, 6) cost 4–6 extra dependent fetches per pixel and amplify 8-bit quantization noise (terracing) — avoid on mobile; prefer analytic.

Anti-aliasing without MSAA:
- Track `dmin` (min distance / t ratio) along the ray; silhouette coverage `alpha = clamp(0.5 - dmin / pixelWorldSize, 0., 1.)` (cone tracing coverage), where `pixelWorldSize ≈ t * pixelAngle` (uniform from projection) or `length(fwidth(vObj))` (needs `OES_standard_derivatives`, ~100% available per web3dsurvey above). Output premultiplied alpha → still needs blending only at the silhouette ring, and since there is one layer per glyph, overdraw ≈ 1–2× instead of N×.
- Interior edges (cap ↔ bevel ↔ side) are shading discontinuities only; they are smooth with rounded/chamfer bevels.

Precision / artifacts with 8-bit SDF:
- 8-bit = 256 levels across the full spread; at spread ±8 px that is 1/16 px per level for the silhouette (fine) but the *bevel surface* is a function of distance, so normals from a quantized+bilinear distance show visible stepping/faceting on wide bevels. Analytic normals from the separate normal channels avoid most of it.
- Single-channel SDF rounds sharp corners (msdfgen, see §4) — rounded corners are fine for rounded-bevel styles, bad for sharp "metal/casino" chamfers.
- `mediump` in fragment shaders is fp16 on Apple and many Mali GPUs; ray position/t must be `highp` (WebGL1 FS highp is optional per spec but present on iPhone 11 and practically all modern Android — unverified this session, see Gaps).
- Depth: if text must intersect other 3D geometry, correct depth needs `gl_FragDepthEXT` (`EXT_frag_depth`). For text drawn in painter's order per glyph (current engine), not needed.

Per-fragment cost estimate (inference, not measured):
- K steps × (1 dependent texture fetch + ~15–20 ALU) + 1 normal fetch + shading. Typical K for a thin slab bounded by tNear/tFar: 6–12 on caps (ray hits the cap almost immediately — the front face of the box *is* the cap plane), 12–24 near silhouettes and at grazing angles.
- Covered pixels ≈ projected box area (face + visible sides) — similar to one stack layer, not N.
- Compare stack: N layers × glyph area × (1 fetch + discard + blend). With N = 40 and nearly frontal view, ~40 fetches/pixel plus 40 blends/pixel; ray march at frontal view: ~2–6 fetches/pixel, no blending inside the glyph. At 90° the stack degenerates (gaps between layers unless N is large); ray march is exact at any angle.
- `discard` + blending defeats hidden-surface removal on tile-based GPUs (Apple, Mali, Adreno all TBDR/binning) — this is the main heat source of the stack approach (inference; no vendor doc fetched).

### Gaps
- Could not fetch IQ's distfunctions/normals articles (404 to tool); formulas above are from domain knowledge, flagged as such.
- No working Shadertoy example of "extruded SDF font" was found via search (Shadertoy pages are JS-rendered and not indexed well). Candidate searches for the writer: Shadertoy "extruded text", "3D font sdf", "glyph extrusion".
- No measured data found on WebGL1 fragment `highp` availability on old Xiaomi (Adreno 5xx/Mali-G52) or dependent-fetch loop cost; must be measured on device (engine has Дебаг → «Замер»).
- `EXT_frag_depth` availability not checked.

## 2. Relief mapping / parallax occlusion mapping / steep parallax vs stacked layers

### Takeaway
POM/relief on a flat quad gives depth *inside* the quad but no true silhouette or side walls, so it cannot show thickness at large rotations (up to 90°). Once you put it on a box proxy, it becomes "ray march a height field", which is strictly worse than sphere tracing an SDF (the SDF gives safe step sizes; a height field needs fixed linear steps + binary refinement). Useful only as a cheap embossed-face trick, not as an extrusion replacement.

### Cited Findings
- Steep parallax / relief mapping / POM are overlapping terms: sample along the view ray to find the first height-field intersection — [GMU CS451 Texturing slides](https://cs.gmu.edu/~jmlien/teaching/cs451/uploads/Main/10-Texturing-4.pdf)
- Binary search refinement uses 5+ levels of dependent texture fetches; linear search alone aliases unless step count is high — [Tatarchuk, Parallax Occlusion Mapping (via OSU)](https://web.engr.oregonstate.edu/~mjb/cs557/Projects/Papers/Parallax_Occlusion_Mapping.pdf) (foundational, ~2006)
- Relaxed cone stepping (GPU Gems 3 ch.18): cone map precomputed offline (O(n²)), stored in one channel; example shader uses 15 cone steps + 6 binary steps, "15 cone steps are typically enough"; removes linear-search aliasing (missed thin features); cone maps should not be mipmapped conventionally (min-mips or nearest sampling) — [GPU Gems 3, Ch.18 Relaxed Cone Stepping](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-18-relaxed-cone-stepping-relief-mapping) (foundational, 2007)
- PlayCanvas POM: default cap 16 taps; fewer taps when the ray covers less texture — [PlayCanvas parallax mapping docs](https://developer.playcanvas.com/user-manual/graphics/physical-rendering/parallax-mapping/)
- On mobile (Gear VR), parallax/POM/relief "cost a lot of pixel shader and texture bandwidth"; profile first — [Meta community forum](https://communityforums.atmeta.com/unity-development-123/how-do-i-make-textures-more-3d-with-the-vr-29068)
- Relative POM vs relief speed reports are anecdotal and contradictory (one user: POM slower and worse; another: POM ~2× faster) — [polycount 807362](https://polycount.com/discussion/comment/807362); [polycount 808381](https://polycount.com/discussion/comment/808381) (2009, weak)

### Inferences
- A glyph SDF *is* a (relaxed) cone map for free: the distance to the edge bounds how far the ray can travel in XY before reaching the glyph, which is exactly what makes sphere tracing (§1) converge in fewer steps than POM's fixed linear search. So "SDF sphere tracing in a box" dominates POM for this use.
- POM is still useful for a *face-only* effect (engraved/embossed inner bevel, "casino" inner outline) on the cap of whatever extrusion technique is used: ~8–16 fetches, only on cap pixels. But TMP-style derivative bevel (§4) gets most of the look with 4 fetches and no march.
- POM on a flat quad has no silhouette: at 60–90° rotation the letter becomes a thin sheet — fails the "large rotation" requirement.

### Gaps
- No modern (2015+) mobile measurements of POM step costs were found.

## 3. Polygonal extrusion (three.js TextGeometry/ExtrudeGeometry, opentype.js, troika)

### Takeaway
Real meshes are the cheapest per pixel (1× overdraw, depth-tested, no texture, exact bevels, perfect at 90°), but cost CPU time and memory at build and need MSAA for edges. For a limited glyph set (digits 0–9, "GRAM", "x", a few words) pre-baking or building once at startup is practical and is likely the coolest-running option for big counters. troika-three-text is flat SDF only — no extrusion.

### Cited Findings
- three.js `TextGeometry` extends `ExtrudeGeometry`; parameters & defaults: `size 100`, `depth 50`, `curveSegments 12`, `steps 1`, `bevelEnabled false`, `bevelThickness 10`, `bevelSize 8`, `bevelOffset 0`, `bevelSegments 3`; bevels not supported with `extrudePath`; fonts in typeface.json (converted via facetype.js), loaded with `FontLoader` — [three.js TextGeometry docs](https://threejs.org/docs/pages/TextGeometry.html)
- The bevel in TextGeometry is geometric (real polygons), not a shader effect — [three.js TextGeometry docs](https://threejs.org/docs/pages/TextGeometry.html)
- troika-three-text: parses .ttf/.otf/.woff (Typr) and generates glyph SDFs on the fly, in a web worker; `gpuAccelerateSDF` default true with JS-worker fallback; `sdfGlyphSize` default 64 (power of two; larger = sharper corners, more memory); each glyph is a flat quad (`glyphGeometryDetail` adds vertices for `curveRadius`); outline/outlineBlur/outlineOffset (drop shadow)/stroke; no extrusion; works with three.js materials (lighting, PBR, shadows, fog); AA via standard derivatives — [troika-three-text docs](https://protectwise.github.io/troika/troika-three-text/)
- three-bmfont-text documents SDF/MSDF shader usage for bitmap fonts in three.js (flat) — [three-bmfont-text](https://github.com/Experience-Monks/three-bmfont-text)

### Inferences
- Vertex count estimate (not measured): a digit outline with curveSegments 12 has ~50–150 contour points; extrusion side walls = points × 2 × (steps + 2·bevelSegments) vertices; with bevelSegments 3 → ~700–2000 verts per glyph + triangulated caps. A 10-glyph counter ≈ 10–20k vertices — trivial for the GPU, but building it in JS (triangulation + bevel offsetting) can take several ms per glyph; do it once per glyph and cache (geometry per glyph, instanced per letter).
- Per-letter animation fits perfectly: one mesh per glyph (or a merged buffer with a per-vertex letter-index attribute indexing a uniform array of transforms — same scheme as the current VS).
- Edge AA needs `antialias: true` on the context (MSAA, costs bandwidth on tile GPUs but resolves on-chip on Apple/Mali) or post FXAA. Without it, silhouettes alias at all angles — worse than SDF.
- Bevel offsetting of font outlines can self-intersect on thin strokes/tight curves (three.js's simple vertex-normal offset); keep bevelSize small relative to stroke width.
- Need font outlines at runtime: either a typeface.json subset (digits + needed letters, a few KB) or opentype.js/Typr to parse the existing font; a pre-generated JSON subset avoids shipping a parser.
- Lighting for "metal/casino" looks: per-vertex/per-pixel normals are exact; a matcap texture (1 fetch) gives a cheap metallic look.

### Gaps
- No published vertex counts / build-time benchmarks for TextGeometry on mobile were found.
- opentype.js bundle size and Cyrillic outline handling not checked this session.

## 4. SDF precision: 8-bit vs 16-bit, MSDF/MTSDF, pxRange; TMP/Pixi outlines, glow, bevel, shadows

### Takeaway
For extrusion the important numbers are (a) spread (how far inside/outside the distance is valid — must cover the bevel radius and the AA ring) and (b) corner sharpness. MSDF keeps sharp corners; MTSDF adds a true SDF in alpha, which is what a ray marcher/bevel needs far from edges. TextMeshPro's "bevel" is not geometry: it is a normal-map-like effect derived from the SDF gradient on a flat quad.

### Cited Findings
- MSDF uses three channels to reproduce sharp corners "almost perfectly"; MTSDF = MSDF in RGB + true SDF in alpha; render with `median(r,g,b)`, `opacity = clamp(screenPxRange() * (sd - 0.5) + 0.5, 0, 1)`; `screenPxRange` can be a uniform for 2D, or computed from derivatives for 3D; must stay ≥ 1 and should be ≥ 2 (else regenerate with wider range); examples use pxrange 2–4; channels are linear (not sRGB); `simulate8bit` exists to preview standard 8-bit output; float bitmaps are the native output — [Chlumsky/msdfgen README](https://github.com/Chlumsky/msdfgen)
- Valve (Green 2007): distance field from a high-res image stored in one channel of a low-res texture; works with plain alpha test; with shaders → soft edges, outlines, drop shadows, glow, and sharp corners (via two channels) — [Valve SIGGRAPH 2007 paper](https://cdn.akamai.steamstatic.com/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf); [course notes](https://www.advances.realtimerendering.com/s2007/Green-Improved_Alpha-Tested_Magnification_for_Vector_Textures_and_Special_Effects(Siggraph07%20Course%20Notes).pdf) (foundational, 2007)
- TMP bevel "works like a normal map, except the shader calculates the bevel using the font's signed distance field"; Outer Bevel = raised lettering with sloped sides (height rises from outline outside to inside); Inner Bevel = raised outline; Surface variant reacts to scene lighting and is "more demanding on the GPU"; bevels are prone to artifacts when pronounced; effects extending past the glyph bleed into neighbouring atlas glyphs → increase padding — [Unity TMP Distance Field (Surface) shader docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@2.2/manual/ShadersDistanceFieldSurface); [TMP Distance Field shader docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@3.2/manual/ShadersDistanceField.html)
- TMP bevel properties: `_Bevel`, `_BevelOffset`, `_BevelWidth`, `_BevelClamp`, `_BevelRoundness` — [TMP_SDF-Surface.shader listing (Megacity mirror, search snippet)](https://plastichub.unity.cn/unity-tech-cn/Megacity/src/branch/main...Assets/Shaders/Fonts/TMP_SDF-Surface.shader)
- A TMP-derived SDFFunctions.hlsl normal function clamps bevel width to a minimum, applies bevel offset, blends sampled heights with `_BevelRoundness`, then builds the normal via cross products (search-snippet level, third-party port) — [SDFFunctions.hlsl on gitfront](https://gitfront.io/r/callumanderson/NfZesVdZpjV3/Hark-the-Moon-Men-Cometh/blob/Assets/TextMesh%20Pro/Shaders/SDFFunctions.hlsl)
- troika `sdfGlyphSize` trade-off: larger = sharper corners, thin lines preserved, more memory/generation time — [troika-three-text docs](https://protectwise.github.io/troika/troika-three-text/)

### Inferences
- TMP-style bevel recipe (reconstructed, verify against TMP source): sample SDF at 4 offsets (±dx, ±dy, `dx` ≈ texel size), map each distance to a height through the bevel profile `h = clamp((d - offset) / width, 0, clamp)` with roundness blending linear→`sin(h·π/2)`-like curve, then `n = normalize(cross(vec3(2dx,0,h_r-h_l), vec3(0,2dy,h_t-h_b)))`. Cost: 4 extra fetches, no loop. The engine already stores precomputed edge normals → it can skip the 4 fetches and use `n = normalize(vec3(n2 * slope(d), 1))` with `slope = dProfile/dd`. This "fake bevel on the cap" can be combined with a cheap extrusion (few layers or mesh sides) to get the TMP look at minimal cost.
- 16-bit SDF in WebGL1 without float textures: pack high/low bytes into two 8-bit channels; but hardware bilinear filtering of packed bytes is wrong (filters bytes independently, carry is lost) → must sample NEAREST and do bilinear manually (4 fetches) — usually not worth it. Better options: (1) keep 8-bit but choose spread tightly (just enough for bevel radius + AA ring), (2) raise atlas resolution for large text, (3) store edge normals separately (already done) so shading does not depend on distance precision, (4) MTSDF: RGB for sharp silhouette, A for smooth distance.
- `OES_texture_half_float` + `OES_texture_half_float_linear` would give filtered 16-bit, but availability on old Android/iOS WebGL1 was not checked (see Gaps); 8-bit RGBA is universally safe.
- For ray marching (§1): MSDF median is only a valid distance near the edge (it is not a true distance far away); march with the MTSDF alpha (true SDF), and use the MSDF median only for the final silhouette/cap-edge test to keep corners sharp.
- pxRange choice for extrusion: spread must be ≥ max(bevel radius in atlas px, AA ring ≈ 1–2 screen px converted to atlas px at minimum scale). Larger spread = coarser 8-bit steps (precision per level = 2·spread/255).
- Glow / soft shadow: one extra fetch with offset UV (shadow) or reading the SDF beyond the edge (glow) — both limited by spread; glows wider than spread need a separate blurred texture or a screen-space pass.

### Gaps
- Exact TMP `GetSurfaceNormal` source could not be fetched (mirrors redirected/404); recipe above is reconstructed, flagged as inference.
- Pixi docs (BitmapText MSDF/SDF support, filters) were not fetched — no cited facts on Pixi.
- troika's nonlinear distance encoding (`sdfExponent`) is not mentioned on the docs page fetched; not confirmed.
- Availability of `OES_texture_float`, `OES_texture_half_float(_linear)` on iOS WebKit / Android not retrieved (web3dsurvey page for derivatives did not include them).

## 5. How engines/demos draw cheap "3D" game text; per-technique cost summary and recommendation

### Takeaway
Shipping engines mostly fake 3D text on flat quads (TMP bevel/emboss, outline + offset shadow, Valve-style SDF effects) or use real meshes when the camera truly rotates text. A true extrusion on WebGL1 mobile is best done either as (A) SDF sphere tracing in a per-glyph box with analytic normals, or (B) pre-built polygonal extrusion for a small glyph set; the stack of N quads is the most expensive per pixel because of N× blended, discarding overdraw.

### Cited Findings
- TMP fakes bevel/emboss on flat SDF quads (normal-map-like from SDF), lit variants are heavier — [Unity TMP docs](https://docs.unity3d.com/Packages/com.unity.textmeshpro@2.2/manual/ShadersDistanceFieldSurface)
- Valve SDF technique: outlines, glow, drop shadows from one distance channel — [Valve 2007](https://cdn.akamai.steamstatic.com/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf)
- troika: drop shadow via `outlineOffsetX/Y` with `outlineWidth: 0`; blurred outline as glow — [troika-three-text docs](https://protectwise.github.io/troika/troika-three-text/)
- three.js real 3D text = ExtrudeGeometry with geometric bevel — [three.js docs](https://threejs.org/docs/pages/TextGeometry.html)

### Inferences
Cost comparison (per glyph; estimates, not measured; "F" = texture fetch):

| Technique | Fetches / px | ALU / px | Overdraw & blending | Memory | Per-letter anim | 90° rotation | WebGL1 needs |
|---|---|---|---|---|---|---|---|
| Stack of N quads (current) | N (15–65) over glyph area, each with discard | low ×N | N× blended, discard kills HSR on TBDR | atlas only | yes (VS) | gaps unless N high | none |
| Stack, optimized (depth test front-to-back, sides only as edge band, cap drawn once) | ~N on edge band, 1 on cap | low | far less; no blending inside | atlas | yes | still gaps | none |
| SDF sphere tracing in box | 2–6 frontal, 12–24 grazing (+1 normal) | ~20/step | ~1× + AA ring blend | atlas (+MTSDF alpha) | yes (VS box) | exact | derivatives (99.99%) for AA; optional `EXT_frag_depth` |
| POM/relief on quad | 8–21 (cone 15 + binary 6) | medium | 1× | + cone/height map | yes | no silhouette/sides | derivatives optional |
| TMP-style bevel on flat quad | 1–5 | low | 1× | atlas | yes | flat card | derivatives for AA |
| Polygonal extrusion (TextGeometry-like) | 0–1 (matcap) | low | 1×, depth test | ~1–2k verts/glyph | yes (per mesh/attr) | exact | MSAA (`antialias:true`) for edges |

Recommendation for "Объём":
1. Short term, lowest risk: keep the stack but cut fill — draw with depth test front-to-back (no blending inside), render the cap once with the full SDF shading, and for the side copies `discard` everything except an edge band (|d| < band) since interior is hidden by the cap; scale N with on-screen size and rotation angle (already partly done: "копий по углу"). Lite mode: TMP-style fake bevel on a flat card + 2–4 offset copies.
2. Medium term: replace side copies with a per-glyph box sphere tracer (`STEPS` presets 12/20/32, analytic normals from stored edge normals, rounded/chamfer via the w-vector formulation, coverage AA from `dmin`). Store SDF in A and edge normals in RG of the same texel so each step is one fetch. Consider MTSDF if sharp "metal" corners are required.
3. For the money counter (`t.count`, digits pre-baked in the atlas): a pre-built polygonal extrusion of 0–9 (+ gem/"GRAM" glyphs) cached once is likely the coolest-running path for long-lived on-screen numbers; requires `antialias:true` and a glyph-outline JSON subset.
4. Whatever is chosen: verify on iPhone 11 and an old Xiaomi with the in-app Дебаг → «Замер», comparing ms/frame and thermal behaviour over 2–3 minutes, since none of the cost numbers above are measured on target hardware.

### Gaps
- No verified open-source WebGL demo of SDF-atlas glyph extrusion via ray marching was found (search returned none; Shadertoy not indexed). The writer should not claim specific Shadertoy IDs.
- Spine / Cocos / Pixi specific "3D text" techniques were not researched (budget); no cited facts.
- No on-device numbers for any technique on iPhone 11 / Adreno / Mali.
