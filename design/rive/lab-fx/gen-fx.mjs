// Сцена эффектов-скриптов: 10 артбордов 360×360, у каждого свой Luau-скрипт (ScriptedDrawable) и фон.
// node gen-fx.mjs → rive . --publish (скрипты подписываются; без подписи веб-рантайм их не выполняет)
import { writeFileSync } from 'node:fs';
const FX = [ // [артборд, скрипт, фон, подложка (земля/полено) или null, атлас]
  ['Fire', 'tfire', 'FF140C10', '<Shape x="180" y="316" name="Logs"><Rectangle width="150" height="20" cornerRadiusTL="10" cornerRadiusTR="10" cornerRadiusBL="10" cornerRadiusBR="10" name="P"/><Fill name="F"><SolidColor colorValue="FF3A2420" name="C"/></Fill></Shape>', 'fire'],
  ['Boom', 'tboom', 'FF15112A', null, 'boom'],
  ['Portal', 'tportal', 'FF0E0B22', null, 'portal'],
  ['Bolt', 'tbolt', 'FF110F2A', '<Shape x="180" y="340" name="Ground"><Rectangle width="360" height="44" name="P"/><Fill name="F"><SolidColor colorValue="FF262040" name="C"/></Fill></Shape>', 'bolt'],
  ['Coins', 'tcoins', 'FF161230', '<Shape x="180" y="340" name="Floor"><Rectangle width="360" height="56" name="P"/><Fill name="F"><SolidColor colorValue="FF221C42" name="C"/></Fill></Shape>', 'coins'],
  ['Confetti', 'tconfetti', 'FF181336', null, 'confetti'],
  ['Charge', 'tcharge', 'FF140E26', null, 'charge'],
  ['Sparkle', 'tsparkle', 'FF120E28', null, 'sparkle'],
  ['Smoke', 'tsmoke', 'FF2A2440', null, 'smoke'],
  ['Shock', 'tshock', 'FF2E2436', '<Shape x="180" y="330" name="Ground"><Rectangle width="360" height="140" name="P"/><Fill name="F"><SolidColor colorValue="FF54402E" name="C"/></Fill></Shape>', 'shock'],
  ['Comets', 'tcomets', 'FF0E0C24', '<Shape x="180" y="350" name="Ground"><Rectangle width="360" height="40" name="P"/><Fill name="F"><SolidColor colorValue="FF1A1634" name="C"/></Fill></Shape>', 'comets'],
];
let id = 10; const nid = () => `0:${id++}`;
const scripts = FX.map(([, s]) => [s, nid()]), sid = Object.fromEntries(scripts), libId = nid();
const boards = FX.map(([name, script, bg, under], i) => { const a = nid(), st = nid(), sm = nid();
  return `<Artboard x="${(i % 5) * 400}" y="${Math.floor(i / 5) * 400}" width="360" height="360" clip="true" name="${name}" styleId="${st}" defaultStateMachineId="${sm}" id="${a}">
<LayoutComponentStyle name="Style" id="${st}"/>
<Fill name="Bg"><SolidColor colorValue="${bg}" name="C"/></Fill>
<ScriptedDrawable x="0" y="0" scriptAssetId="${sid[script]}" name="${script}" id="${nid()}"/>
${under ? under.replace('name="', `id="${nid()}" name="`) : ''}
<StateMachine name="SM" id="${sm}"><StateMachineLayer name="L" id="${nid()}"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/><EntryState/></StateMachineLayer></StateMachine>
</Artboard>`; });
// модуль объявляется раньше скриптов, которые его подключают
const assets = [...FX.map(f => `<ImageAsset file="fx-${f[4]}.webp" name="fx-${f[4]}" id="${nid()}"/>`), `<ScriptAsset file="fxlib.luau" isModule="true" name="fxlib" id="${libId}"/>`, `<ScriptAsset file="atlases.luau" isModule="true" name="atlases" id="${nid()}"/>`, `<ScriptAsset file="vfx.luau" isModule="true" name="vfx" id="${nid()}"/>`, ...scripts.map(([s, i]) => `<ScriptAsset file="${s}.luau" name="${s}" id="${i}"/>`)];
// FIRST=Имя — этот артборд первым (rive --screenshot снимает первый)
const first = FX.findIndex(f => f[0] === process.env.FIRST); if (first > 0) boards.unshift(...boards.splice(first, 1));
writeFileSync(new URL('./scene.rml', import.meta.url), `<Rive version="1" kind="fragment">\n${boards.join('\n')}\n${assets.join('\n')}\n</Rive>\n`);
console.log(FX.length, 'артбордов');
