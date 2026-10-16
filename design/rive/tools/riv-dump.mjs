// Разбор готового .riv (из Rive Marketplace) без редактора: node riv-dump.mjs file.riv [--tree] [--json out.json]
// Формат: 'RIVE', версия, id файла, таблица свойств (ключ → тип значения), затем поток объектов:
// typeKey, пары (ключ свойства, значение) до ключа 0. Имена типов и свойств — из rive-schema.json (rive schema --json).
import { readFileSync, writeFileSync } from 'node:fs';
const S = JSON.parse(readFileSync(new URL('./rive-schema.json', import.meta.url)));
const [, , file, ...flags] = process.argv;
const b = readFileSync(file); let o = 0;
const vu = () => { let r = 0, s = 0, x; do { x = b[o++]; r += (x & 127) * 2 ** s; s += 7; } while (x & 128); return r; };
const str = () => { const n = vu(), v = b.slice(o, o + n); o += n; return v; };
if (b.slice(0, 4).toString() !== 'RIVE') throw new Error('не .riv');
o = 4; const major = vu(), minor = vu(), fileId = vu();
const toc = []; for (let k = vu(); k; k = vu()) toc.push(k);
const tocType = {}; let bits = 0;
toc.forEach((k, i) => { if (i % 4 === 0){ bits = b.readUInt32LE(o); o += 4; } tocType[k] = (bits >> (2 * (i % 4))) & 3; });
const kind = key => { const p = S.props[key]; if (p){ const t = p.type;
    if (t === 'double') return 'f32'; if (t === 'String') return 'str'; if (t === 'Bytes' || t === 'List<Id>') return 'bytes'; if (t === 'Color') return 'u32';
    if (t === 'bool') return 'bool'; return 'vu'; }
  return ['vu', 'str', 'f32', 'u32'][tocType[key] ?? 0]; };
const objs = [];
while (o < b.length){
  const typeKey = vu(), obj = { type: S.types[typeKey] || ('#' + typeKey), p: {} };
  for (let key = vu(); key; key = vu()){
    const k = kind(key), name = S.props[key]?.name || ('#' + key);
    let v; if (k === 'f32'){ v = +b.readFloatLE(o).toFixed(4); o += 4; } else if (k === 'u32'){ v = b.readUInt32LE(o).toString(16).padStart(8, '0'); o += 4; }
    else if (k === 'str'){ v = str().toString(); } else if (k === 'bytes'){ v = '<' + str().length + ' bytes>'; } else if (k === 'bool'){ v = !!b[o++]; } else v = vu();
    obj.p[name] = v; }
  objs.push(obj);
}
// сводка
const hist = {}; for (const x of objs) hist[x.type] = (hist[x.type] || 0) + 1;
const boards = []; let cur = null;
for (const x of objs){ if (x.type === 'Artboard'){ cur = { name: x.p.name, w: x.p.width, h: x.p.height, objs: [] }; boards.push(cur); } if (cur) cur.objs.push(x); }
console.log(`${file.split(/[\\/]/).pop()}  v${major}.${minor}  объектов ${objs.length}`);
const pick = ['Bone', 'RootBone', 'Skin', 'Tendon', 'Mesh', 'MeshVertex', 'ContourMeshVertex', 'Weight', 'CubicWeight', 'IKConstraint', 'TransformConstraint', 'TranslationConstraint', 'RotationConstraint', 'ScaleConstraint', 'DistanceConstraint', 'FollowPathConstraint',
  'ClippingShape', 'Joystick', 'BlendState1D', 'BlendStateDirect', 'BlendState1DViewModel', 'NestedArtboard', 'ScriptAsset', 'ScriptedDrawable', 'ScriptedLayout', 'Image', 'ImageAsset', 'PointsPath', 'CubicMirroredVertex', 'CubicDetachedVertex', 'CubicAsymmetricVertex',
  'StraightVertex', 'LinearGradient', 'RadialGradient', 'Feather', 'DrawRules', 'Solo', 'LinearAnimation', 'StateMachine', 'StateMachineListener', 'ViewModel', 'TrimPath', 'DashPath'];
console.log('  ' + pick.filter(t => hist[t]).map(t => `${t}:${hist[t]}`).join('  '));
for (const a of boards){
  const h = {}; for (const x of a.objs) h[x.type] = (h[x.type] || 0) + 1;
  const anims = a.objs.filter(x => x.type === 'LinearAnimation').map(x => `${x.p.name}(${x.p.duration ?? '?'}f@${x.p.fps ?? 60})`);
  console.log(`  ▸ ${a.name} ${a.w}×${a.h}: ${a.objs.length} об.; кости ${(h.Bone || 0) + (h.RootBone || 0)}, сетки ${h.Mesh || 0}, скины ${h.Skin || 0}, IK ${h.IKConstraint || 0}, картинки ${h.Image || 0}, контуры ${h.PointsPath || 0}, градиенты ${(h.LinearGradient || 0) + (h.RadialGradient || 0)}, клипы ${h.ClippingShape || 0}, вложенные ${h.NestedArtboard || 0}`);
  if (anims.length) console.log(`     анимации: ${anims.slice(0, 12).join(', ')}${anims.length > 12 ? ' …' : ''}`);
}
if (flags.includes('--tree')) for (const a of boards){
  // дерево по parentId (индекс внутри артборда); анимации — без родителя
  // компоненты артборда идут до первой анимации/машины состояний; parentId — номер в этом списке
  const end = a.objs.findIndex(x => /^(LinearAnimation|StateMachine)$/.test(x.type)), comps = (end < 0 ? a.objs : a.objs.slice(0, end)).filter(x => x.type[0] !== '#');   // служебные объекты неизвестных типов в список не входят
  const kids = {}; comps.forEach((x, i) => { if (x.p.parentId !== undefined && i){ (kids[x.p.parentId] ||= []).push(i); } });
  const skip = new Set(['KeyedObject', 'KeyedProperty', 'KeyFrameDouble', 'KeyFrameColor', 'KeyFrameId', 'KeyFrameBool', 'CubicEaseInterpolator', 'Weight', 'CubicWeight', 'MeshVertex', 'ContourMeshVertex', 'StraightVertex', 'CubicMirroredVertex', 'CubicDetachedVertex', 'CubicAsymmetricVertex', 'GradientStop']);
  const line = (i, d) => { const x = comps[i]; if (skip.has(x.type) || d > 14) return;
    const ks = (kids[i] || []).map(j => comps[j].type), vc = ks.filter(t => /Vertex/.test(t)).length;
    const extra = Object.entries(x.p).filter(([k]) => ['x', 'y', 'rotation', 'length', 'scaleX', 'scaleY', 'parentBoneCount', 'targetId', 'boneId', 'blendModeValue', 'opacity'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`${'  '.repeat(d)}${x.type}${x.p.name ? ' «' + x.p.name + '»' : ''}${vc ? ` [${vc} вершин]` : ''} ${extra}`);
    for (const j of kids[i] || []) line(j, d + 1); };
  console.log(`\n=== ${a.name}`); line(0, 0);
}
const ji = flags.indexOf('--json'); if (ji >= 0) writeFileSync(flags[ji + 1], JSON.stringify(boards.map(a => ({ name: a.name, objs: a.objs })), null, 1));
