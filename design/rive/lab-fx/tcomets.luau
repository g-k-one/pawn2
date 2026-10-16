-- Кометы: три снаряда летят по дуге; голова — вытянутая по скорости искра + свечение, хвост — «штампы»:
-- каждый кадр в точке головы рождается мягкое пятно, которое тает и сжимается (плавный хвост без полигонов),
-- за хвостом — пыль и искорки. На земле — вспышка при падении.
local vfx = require('vfx')
type K = { x: number, y: number, vx: number, vy: number, hue: number, alive: boolean }
type S = { t: number, kom: { K }, acc: { number }, at: vfx.Atlas?, trail: vfx.Layer?, heads: vfx.Layer?, bits: vfx.Layer?, hits: vfx.Layer? }
local GROUND = 330
local R = vfx.rand

local function launch(): K
	return { x = R(-60, 120), y = R(-60, 20), vx = R(170, 260), vy = R(120, 200), hue = if math.random() < 0.6 then 0 else 1, alive = true }
end

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'comets')
	self.at = at
	self.trail, self.heads, self.bits, self.hits = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	for i = 1, 3 do local k = launch(); k.x += i * 70; k.y += i * 40; self.kom[i] = k end
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.t += dt
	for i, k in self.kom do
		k.vy += 160 * dt
		local px, py = k.x, k.y
		k.x += k.vx * dt; k.y += k.vy * dt
		-- штампы хвоста: по 3 на кадр, вдоль пройденного отрезка — хвост не рвётся на любой скорости
		for s = 1, 3 do
			local f = s / 3
			vfx.spawn(self.trail :: vfx.Layer, { x = px + (k.x - px) * f, y = py + (k.y - py) * f, size = 34, grow = -0.8, life = 0.5,
				cells = { at.map[if k.hue == 0 then 'sglow:E1' else 'sglow:M2'] }, add = 1, alpha = 0.45, fadeIn = 0.01, fadeOut = 0.9 })
		end
		if math.random() < dt * 22 then
			vfx.spawn(self.bits :: vfx.Layer, { x = k.x + R(-6, 6), y = k.y + R(-6, 6), vx = -k.vx * 0.15 + R(-30, 30), vy = -k.vy * 0.15 + R(-30, 30), size = R(10, 18), life = R(0.5, 0.8), vr = 3,
				cells = { at.map[if math.random() < 0.5 then 'twinkle:W0' else 'dust:E2'] }, add = 1, alpha = 0.8, fadeIn = 0.1, fadeOut = 0.6 })
		end
		if k.y > GROUND - 6 then
			vfx.spawn(self.hits :: vfx.Layer, { x = k.x, y = GROUND - 6, size = 70, grow = 1.6, life = 0.4, cells = { at.map[if k.hue == 0 then 'sglow:E1' else 'sglow:M2'] }, add = 1, stretch = 0.45, fadeIn = 0.02, fadeOut = 0.8 })
			self.kom[i] = launch()
		end
	end
	for _, l in { self.trail, self.bits, self.hits } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local heads = self.heads :: vfx.Layer
	heads.parts = {}
	vfx.draw(r, self.trail :: vfx.Layer)
	vfx.draw(r, self.bits :: vfx.Layer)
	vfx.draw(r, self.hits :: vfx.Layer)
	for _, k in self.kom do
		vfx.sprite(heads, k.x, k.y, 70, 0, 0.7, 1, at.map[if k.hue == 0 then 'sglow:E1' else 'sglow:M2'])
		vfx.sprite(heads, k.x, k.y, 26, 0, 1, 1, at.map['sglow:E1'])
		-- голова-искра по скорости: временная частица с orient
		table.insert(heads.parts, { x = k.x, y = k.y, vx = k.vx, vy = k.vy, rot = 0, vr = 0, size = 46, grow = 0, stretch = 1.3, age = 0.5, life = 1,
			cells = { at.map[if k.hue == 0 then 'spark:E0' else 'spark:M2'] }, add = 1, alpha = 1, drag = 0, grav = 0, sway = 0, ph = 0, fadeIn = 0.0001, fadeOut = 0.0001, orient = true, speedStretch = 0 })
	end
	vfx.draw(r, heads)
end

return function(): Node<S>
	return { t = 0, kom = {}, acc = {}, at = nil, trail = nil, heads = nil, bits = nil, hits = nil, init = init, advance = advance, draw = draw }
end
