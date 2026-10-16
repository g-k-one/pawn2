-- Взрыв (цикл 2.4 с). Фазы по гайду LoL: удар — самый яркий кадр (звезда-вспышка + свечение),
-- огненный шар из клубов (цвет по жизни: раскалённый → серый дым), языки пламени, ударное кольцо, искры по баллистике;
-- затухание — дым поднимается и тает, оно дольше и тусклее удара.
local vfx = require('vfx')
type S = { cycle: number, fired: boolean, at: vfx.Atlas?, flash: vfx.Layer?, smoke: vfx.Layer?, fire: vfx.Layer?, ring: vfx.Layer?, sparks: vfx.Layer? }
local CX, CY, PERIOD = 180, 200, 2.4
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'boom')
	self.at = at
	self.flash, self.smoke, self.fire, self.ring, self.sparks = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function boom(self: S)
	local at = self.at :: vfx.Atlas
	for i = 1, 16 do
		local a = i / 16 * 6.28 + R(0, 0.3)
		local sp = R(150, 350)
		local m = if i % 2 == 0 then 'smoke1' else 'smoke2'
		vfx.spawn(self.smoke :: vfx.Layer, { x = CX, y = CY, vx = math.cos(a) * sp, vy = math.sin(a) * sp * 0.8 - 40, rot = R(0, 6.28), vr = R(-0.75, 0.75),
			size = R(70, 110), grow = 1.4, life = R(1.0, 1.4), cells = vfx.seq(at, m, 'S0', 'S0', 'S1', 'S2', 'S3'), add = 0.35, alpha = 0.95, drag = 3.2, grav = -60, fadeIn = 0.04, fadeOut = 0.45 })
	end
	for _ = 1, 10 do
		vfx.spawn(self.smoke :: vfx.Layer, { x = CX + R(-30, 30), y = CY - 20, vx = R(-20, 20), vy = R(-80, -40), rot = R(0, 6.28), vr = R(-0.25, 0.25),
			size = 90, grow = 1.6, life = 2.0, cells = vfx.seq(at, 'smoke1', 'S1', 'S2', 'S3'), add = 0, alpha = 0.55, sway = 12, fadeIn = 0.25, fadeOut = 0.5 })
	end
	for i = 1, 10 do
		local a = i / 10 * 6.28
		vfx.spawn(self.fire :: vfx.Layer, { x = CX, y = CY, vx = math.cos(a) * 120, vy = math.sin(a) * 120 - 60, rot = a + math.pi / 2, size = 110, grow = -0.4, life = 0.45,
			cells = vfx.seq(at, 'flame1', 'F0', 'F1', 'F2', 'F3'), add = 1, alpha = 1, drag = 2, fadeIn = 0.05, fadeOut = 0.5 })
	end
	for _ = 1, 34 do
		local a = R(0, 6.28)
		local sp = R(300, 750)
		vfx.spawn(self.sparks :: vfx.Layer, { x = CX, y = CY, vx = math.cos(a) * sp, vy = math.sin(a) * sp, size = R(22, 38), life = R(0.5, 0.9),
			cells = vfx.seq(at, 'streak', 'F0', 'F1', 'F2', 'F3'), add = 1, drag = 1.5, grav = 700, orient = true, speedStretch = 0.0015, fadeIn = 0.02, fadeOut = 0.5 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false end
	if not self.fired and self.cycle > 0.05 then self.fired = true; boom(self) end
	for _, l in { self.smoke, self.fire, self.sparks } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local flash, ring = self.flash :: vfx.Layer, self.ring :: vfx.Layer
	local t = self.cycle - 0.05
	flash.parts = {}; ring.parts = {}
	if t >= 0 and t < 0.35 then
		local k = t / 0.35
		vfx.sprite(flash, CX, CY, 260 + 200 * k, k * 0.5, 1 - k, 1, at.map['glow:F0'])
		if t < 0.16 then vfx.sprite(flash, CX, CY, 140 + 360 * (t / 0.16), 0.2, 1 - t / 0.16, 1, at.map['star:F0']) end
	end
	if t >= 0 and t < 0.5 then
		local k = t / 0.5
		vfx.sprite(ring, CX, CY, 60 + 460 * (1 - (1 - k) ^ 3), 0, (1 - k) * 0.9, 1, at.map['ring:F1'])
	end
	vfx.draw(r, self.smoke :: vfx.Layer)
	vfx.draw(r, ring)
	vfx.draw(r, self.fire :: vfx.Layer)
	vfx.draw(r, self.sparks :: vfx.Layer)
	vfx.draw(r, flash)
end

return function(): Node<S>
	return { cycle = 0, fired = false, at = nil, flash = nil, smoke = nil, fire = nil, ring = nil, sparks = nil, init = init, advance = advance, draw = draw }
end
