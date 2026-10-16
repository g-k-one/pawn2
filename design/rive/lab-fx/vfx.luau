-- Частицы на текстурах (как в AAA, но мягче — мобильный стиль). У каждого эффекта свой атлас fx-<имя>.webp:
-- рисованные маски из Magnific × цветовые ступени (atlas.mjs), карта ячеек — модуль atlases.
-- Частица: ячейки по жизни (цвет по возрасту), поворот, масштаб с растяжением, прозрачность «появление → жизнь → угасание»,
-- доля сложения света. Слой = ОДИН вызов drawImageMeshInstanced.
local ATLASES = require('atlases')
local M = {}

export type Atlas = { cols: number, rows: number, cell: number, map: { [string]: number }, image: Image?, qv: VertexBuffer, qu: VertexBuffer, qt: TriangleBuffer }
export type P = {
	x: number, y: number, vx: number, vy: number, rot: number, vr: number,
	size: number, grow: number, stretch: number, age: number, life: number,
	cells: { number }, add: number, alpha: number,
	drag: number, grav: number, sway: number, ph: number, fadeIn: number, fadeOut: number, orient: boolean, speedStretch: number,
}
export type Layer = { at: Atlas, inst: MeshInstances, parts: { P } }
local sampler = ImageSampler('clamp', 'clamp', 'bilinear')

function M.atlas(context: Context, name: string): Atlas
	local a = (ATLASES :: any)[name]
	local qv, qu, qt = VertexBuffer(), VertexBuffer(), TriangleBuffer()
	local h = a.cell / 2
	qv:add(Vector.xy(-h, -h), Vector.xy(h, -h), Vector.xy(h, h), Vector.xy(-h, h))
	qu:add(Vector.xy(0, 0), Vector.xy(1 / a.cols, 0), Vector.xy(1 / a.cols, 1 / a.rows), Vector.xy(0, 1 / a.rows))
	qt:add(0, 1, 2); qt:add(0, 2, 3)
	return { cols = a.cols, rows = a.rows, cell = a.cell, map = a.map, image = context:image('fx-' .. name), qv = qv, qu = qu, qt = qt }
end

-- ячейки «маска × ступени» по порядку жизни
function M.seq(at: Atlas, mask: string, ...: string): { number }
	local out: { number } = {}
	for i, s in { ... } do out[i] = at.map[mask .. ':' .. s] end
	if #out == 0 then out[1] = at.map[mask] end
	return out
end

function M.layer(at: Atlas): Layer
	return { at = at, inst = MeshInstances(0), parts = {} }
end

function M.spawn(layer: Layer, o: { [string]: any })
	local p: P = { x = 0, y = 0, vx = 0, vy = 0, rot = 0, vr = 0, size = 64, grow = 0, stretch = 1, age = 0, life = 1,
		cells = { 0 }, add = 1, alpha = 1, drag = 0, grav = 0, sway = 0, ph = math.random() * 6.28, fadeIn = 0.12, fadeOut = 0.4, orient = false, speedStretch = 0 }
	for k, v in o do (p :: any)[k] = v end
	table.insert(layer.parts, p)
end

function M.step(layer: Layer, dt: number)
	local ps = layer.parts
	local i = 1
	while i <= #ps do
		local p = ps[i]
		p.age += dt
		if p.age >= p.life then
			ps[i] = ps[#ps]; table.remove(ps)
		else
			local d = math.max(0, 1 - p.drag * dt)
			p.vx *= d; p.vy = p.vy * d + p.grav * dt
			p.x += (p.vx + math.sin(p.age * 5 + p.ph) * p.sway) * dt
			p.y += p.vy * dt
			p.rot += p.vr * dt
			i += 1
		end
	end
end

-- мягкая кривая прозрачности: плавное появление (smoothstep), плавное угасание
local function fade(p: P, k: number): number
	local a = math.clamp(k / p.fadeIn, 0, 1)
	local b = math.clamp((1 - k) / p.fadeOut, 0, 1)
	return p.alpha * a * a * (3 - 2 * a) * b * b * (3 - 2 * b)
end

function M.draw(r: Renderer, layer: Layer)
	local at = layer.at
	if not at.image then return end
	local ps, inst = layer.parts, layer.inst
	inst:resize(#ps)
	for i, p in ps do
		local k = p.age / p.life
		local cell = p.cells[math.min(#p.cells, math.floor(k * #p.cells) + 1)]
		local s = p.size * (1 + p.grow * k) / at.cell
		local m: Mat2D
		if p.orient then
			-- маска искры нарисована по диагонали: голова внизу-слева, хвост вверх-вправо. Поворот головы по скорости
			-- и растяжение вдоль этой оси: M = R(a − 3π/4) · (I + (st − 1)·u·uᵀ), u = (−1, 1)/√2
			local st = p.stretch * (1 + math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.speedStretch)
			local b = math.atan2(p.vy, p.vx) - 2.35619449
			local cb, sb, h = math.cos(b), math.sin(b), (st - 1) / 2
			m = Mat2D.values((cb * (1 + h) + sb * h) * s, (sb * (1 + h) - cb * h) * s, (-cb * h - sb * (1 + h)) * s, (cb * (1 + h) - sb * h) * s, p.x, p.y)
		else
			local c, sn = math.cos(p.rot), math.sin(p.rot)
			m = Mat2D.values(c * s, sn * s, -sn * s * p.stretch, c * s * p.stretch, p.x, p.y)
		end
		inst:set(i - 1, m, fade(p, k), p.add, Vector.xy((cell % at.cols) / at.cols, math.floor(cell / at.cols) / at.rows))
	end
	if #ps > 0 then r:drawImageMeshInstanced(at.image :: Image, sampler, at.qv, at.qu, at.qt, inst) end
end

-- одна копия на кадр (свечение, руна, кольцо): слой с такими копиями очищается в начале draw
function M.sprite(layer: Layer, x: number, y: number, size: number, rot: number, alpha: number, add: number, cell: number, sy: number?)
	table.insert(layer.parts, { x = x, y = y, vx = 0, vy = 0, rot = rot, vr = 0, size = size, grow = 0, stretch = sy or 1, age = 0.5, life = 1, cells = { cell },
		add = add, alpha = alpha, drag = 0, grav = 0, sway = 0, ph = 0, fadeIn = 0.0001, fadeOut = 0.0001, orient = false, speedStretch = 0 })
end

-- накопитель частоты: rate штук в секунду, дробные остатки копятся в acc[k]
function M.emit(acc: { number }, k: number, rate: number, dt: number, f: () -> ())
	acc[k] = (acc[k] or 0) + rate * dt
	while acc[k] >= 1 do acc[k] -= 1; f() end
end

function M.rand(a: number, b: number): number
	return a + math.random() * (b - a)
end

function M.easeOut(t: number): number
	local u = 1 - math.clamp(t, 0, 1)
	return 1 - u * u * u
end

return M
