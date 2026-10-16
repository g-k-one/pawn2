-- Удар о землю (цикл 2 с): вспышка-лучи в точке удара, по земле расходится плоское кольцо (эллипс — перспектива),
-- за ним катятся клубы пыли, вверх летят золотые искры, пыль оседает и тает.
local vfx = require('vfx')
type S = { cycle: number, fired: boolean, at: vfx.Atlas?, back: vfx.Layer?, dust: vfx.Layer?, sparks: vfx.Layer?, top: vfx.Layer? }
local GX, GY, PERIOD = 180, 280, 2.0
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'shock')
	self.at = at
	self.back, self.dust, self.sparks, self.top = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function slam(self: S)
	local at = self.at :: vfx.Atlas
	for i = 1, 18 do
		local a = i / 18 * 6.28 + R(-0.1, 0.1)
		local sp = R(240, 340)
		local small = i % 2 == 0
		vfx.spawn(self.dust :: vfx.Layer, { x = GX + math.cos(a) * 20, y = GY + math.sin(a) * 7, vx = math.cos(a) * sp, vy = math.sin(a) * sp * 0.32 - 20, rot = R(0, 6.28), vr = R(-1, 1),
			size = if small then R(50, 64) else R(66, 90), grow = 0.9, life = R(0.9, 1.3), cells = vfx.seq(at, if small then 'puffS' else 'dust', 'D0', 'D1'),
			add = 0, alpha = 0.85, drag = 2.8, grav = -12, fadeIn = 0.04, fadeOut = 0.55 })
	end
	for _ = 1, 20 do
		local a = -math.pi / 2 + R(-0.9, 0.9)
		local sp = R(280, 560)
		vfx.spawn(self.sparks :: vfx.Layer, { x = GX, y = GY - 6, vx = math.cos(a) * sp, vy = math.sin(a) * sp, size = R(18, 28), life = R(0.5, 0.8),
			cells = vfx.seq(at, 'spark', 'G0', 'G1'), add = 1, drag = 1, grav = 1000, orient = true, speedStretch = 0.002, fadeIn = 0.02, fadeOut = 0.4 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false end
	if not self.fired and self.cycle > 0.1 then self.fired = true; slam(self) end
	vfx.step(self.dust :: vfx.Layer, dt); vfx.step(self.sparks :: vfx.Layer, dt)
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back, top = self.back :: vfx.Layer, self.top :: vfx.Layer
	back.parts = {}; top.parts = {}
	local t = self.cycle - 0.1
	if t >= 0 and t < 0.7 then
		local k = t / 0.7
		local e = vfx.easeOut(k)
		vfx.sprite(back, GX, GY, 120 + 420 * e, 0, (1 - k) * 0.9, 1, at.map['ground:D0'], 0.55)
		vfx.sprite(back, GX, GY, 60 + 260 * e, 0, (1 - k) ^ 2, 1, at.map['ground:G0'], 0.5)
		vfx.sprite(back, GX, GY, 260, 0, (1 - k) * 0.6, 1, at.map['sglow:G0'], 0.5)
	end
	if t >= 0 and t < 0.3 then
		local k = t / 0.3
		vfx.sprite(top, GX, GY - 20, 150 + 160 * k, k * 0.3, 1 - k, 1, at.map['burst:G0'])
	end
	vfx.draw(r, back)
	vfx.draw(r, self.dust :: vfx.Layer)
	vfx.draw(r, self.sparks :: vfx.Layer)
	vfx.draw(r, top)
end

return function(): Node<S>
	return { cycle = 0, fired = false, at = nil, back = nil, dust = nil, sparks = nil, top = nil, init = init, advance = advance, draw = draw }
end
