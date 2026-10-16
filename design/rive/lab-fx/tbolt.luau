-- Удар молнии (цикл 1.8 с): предвестник — сгущается свечение в небе; удар — рисованная молния от неба до земли
-- мерцает и перескакивает 3 кадра, вспышка, дуги вокруг; у земли — круговая волна, треск, искры и клубы пыли.
local vfx = require('vfx')
type S = { cycle: number, fired: boolean, at: vfx.Atlas?, back: vfx.Layer?, dust: vfx.Layer?, sparks: vfx.Layer?, top: vfx.Layer? }
local GX, GY, PERIOD = 180, 318, 1.8
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'bolt')
	self.at = at
	self.back, self.dust, self.sparks, self.top = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function strike(self: S)
	local at = self.at :: vfx.Atlas
	for i = 1, 12 do
		local side = if i % 2 == 0 then 1 else -1
		vfx.spawn(self.dust :: vfx.Layer, { x = GX + side * R(10, 30), y = GY - R(0, 12), vx = side * R(80, 220), vy = R(-60, -20), rot = R(0, 6.28), vr = R(-1, 1), size = R(50, 80), grow = 0.9,
			life = R(0.8, 1.2), cells = vfx.seq(at, 'dust', 'D0', 'D1'), add = 0, alpha = 0.75, drag = 2.6, grav = -20, fadeIn = 0.05, fadeOut = 0.6 })
	end
	for _ = 1, 22 do
		local a = -math.pi / 2 + R(-1.2, 1.2)
		local sp = R(250, 520)
		vfx.spawn(self.sparks :: vfx.Layer, { x = GX, y = GY - 6, vx = math.cos(a) * sp, vy = math.sin(a) * sp, size = R(16, 26), life = R(0.4, 0.7),
			cells = vfx.seq(at, 'spark', 'E0', 'E1'), add = 1, drag = 1.2, grav = 900, orient = true, speedStretch = 0.002, fadeIn = 0.02, fadeOut = 0.5 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false end
	if not self.fired and self.cycle > 0.4 then self.fired = true; strike(self) end
	vfx.step(self.dust :: vfx.Layer, dt); vfx.step(self.sparks :: vfx.Layer, dt)
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back, top = self.back :: vfx.Layer, self.top :: vfx.Layer
	back.parts = {}; top.parts = {}
	local c = self.cycle
	-- предвестник: облако в небе наливается светом
	local pre = math.clamp(c / 0.4, 0, 1)
	local after = math.clamp(1 - (c - 0.4) / 1.0, 0, 1)
	vfx.sprite(back, GX, 20, 300, 0, 0.25 + 0.45 * pre * pre * (if c > 0.4 then after else 1), 1, at.map['sglow:E2'], 0.6)
	local t = c - 0.4
	if t >= 0 then
		-- удар: 3 кадра «перескока» молнии, потом остаточное мерцание
		local frame = math.floor(t / 0.05)
		local live = t < 0.32 and (frame < 4 or frame % 2 == 0)
		if live then
			local sx = if frame % 3 == 0 then 1 elseif frame % 3 == 1 then -1 else 1
			local dx = (frame % 3 - 1) * 10
			vfx.sprite(back, GX, GY / 2, 600, 0, 0.55, 1, at.map['sglow:E1'], 1.2)
			vfx.sprite(top, GX + dx, GY / 2 + 10, 300 * sx, 0.1 * sx, 0.85, 1, at.map['bolt:E1'], 2.0 / sx)
			vfx.sprite(top, GX + dx, GY / 2 + 10, 230 * sx, 0.1 * sx, 1, 1, at.map['bolt:E0'], 2.6 / sx)
			for k = 0, 2 do
				vfx.sprite(top, GX + R(-40, 40), R(80, 280), R(70, 110), R(0, 6.28), 0.8, 1, at.map[if k % 2 == 0 then 'arc:E0' else 'arc:E1'])
			end
		end
		if t < 0.6 then
			local k = t / 0.6
			vfx.sprite(back, GX, GY, 80 + 340 * vfx.easeOut(k), 0, (1 - k) * 0.9, 1, at.map['sring:E1'], 0.32)
			vfx.sprite(back, GX, GY - 4, 220, 0, (1 - k) * 0.8, 1, at.map['ground:E1'], 0.6)
			vfx.sprite(top, GX, GY - 20, 140 + 120 * k, 0, (1 - k) ^ 2, 1, at.map['burst:E0'])
			if frame % 2 == 0 then vfx.sprite(top, GX + R(-10, 10), GY - 10, 110, R(0, 6.28), 1 - k, 1, at.map['crackle:E0']) end
		end
		if t < 0.12 then vfx.sprite(top, 180, 180, 900, 0, 0.35 * (1 - t / 0.12), 1, at.map['sglow:E1']) end
	end
	vfx.draw(r, back)
	vfx.draw(r, self.dust :: vfx.Layer)
	vfx.draw(r, top)
	vfx.draw(r, self.sparks :: vfx.Layer)
end

return function(): Node<S>
	return { cycle = 0, fired = false, at = nil, back = nil, dust = nil, sparks = nil, top = nil, init = init, advance = advance, draw = draw }
end
