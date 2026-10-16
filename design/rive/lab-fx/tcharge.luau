-- Заряд «Ультра» (цикл 2.4 с): ожидание — искры стягиваются к шару, кольца сжимаются внутрь, шар растёт и трещит;
-- разряд — вспышка-лучи, кольцо наружу, звёздочки разлетаются; затухание — шар гаснет. Розово-сиреневая гамма.
local vfx = require('vfx')
type S = { cycle: number, fired: boolean, acc: { number }, at: vfx.Atlas?, back: vfx.Layer?, inP: vfx.Layer?, out: vfx.Layer?, top: vfx.Layer? }
local CX, CY, PERIOD, CHARGE = 180, 180, 2.4, 1.5
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'charge')
	self.at = at
	self.back, self.inP, self.out, self.top = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function release(self: S)
	local at = self.at :: vfx.Atlas
	for _ = 1, 26 do
		local a = R(0, 6.28)
		local sp = R(260, 520)
		vfx.spawn(self.out :: vfx.Layer, { x = CX, y = CY, vx = math.cos(a) * sp, vy = math.sin(a) * sp, size = R(24, 40), life = R(0.5, 0.8), rot = R(0, 6.28), vr = R(-4, 4),
			cells = vfx.seq(at, 'twinkle', 'W0', 'P0'), add = 1, drag = 3, fadeIn = 0.02, fadeOut = 0.6 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.cycle += dt
	local c = self.cycle
	if c >= PERIOD then self.cycle = 0; self.fired = false end
	if c < CHARGE then
		-- темп нарастает к разряду
		vfx.emit(self.acc, 1, 20 + 50 * (c / CHARGE), dt, function()
			local a = R(0, 6.28)
			local d = R(130, 170)
			vfx.spawn(self.inP :: vfx.Layer, { x = CX + math.cos(a) * d, y = CY + math.sin(a) * d, vx = -math.cos(a) * 60, vy = -math.sin(a) * 60, size = R(18, 28), life = 0.5,
				cells = vfx.seq(at, 'spark', 'P1', 'P0'), add = 1, orient = true, speedStretch = 0.002, fadeIn = 0.3, fadeOut = 0.2 })
		end)
		vfx.emit(self.acc, 2, 2.2, dt, function()
			vfx.spawn(self.inP :: vfx.Layer, { x = CX, y = CY, size = 300, grow = -0.8, life = 0.6, cells = vfx.seq(at, 'sring', 'P1', 'P0'), add = 1, alpha = 0.5, fadeIn = 0.4, fadeOut = 0.2 })
		end)
	end
	if not self.fired and c >= CHARGE then self.fired = true; release(self) end
	-- искры ускоряются к центру
	for _, p in (self.inP :: vfx.Layer).parts do
		if p.orient then
			local dx, dy = CX - p.x, CY - p.y
			local d = math.max(math.sqrt(dx * dx + dy * dy), 6)
			p.vx += dx / d * 900 * dt; p.vy += dy / d * 900 * dt
			if d < 22 then p.age = p.life end
		end
	end
	for _, l in { self.inP, self.out } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back, top = self.back :: vfx.Layer, self.top :: vfx.Layer
	back.parts = {}; top.parts = {}
	local c = self.cycle
	local k = math.clamp(c / CHARGE, 0, 1)
	local orb: number
	if c < CHARGE then orb = 30 + 70 * k * k else orb = 100 * math.max(0, 1 - (c - CHARGE) / 0.5) end
	local jit = 1 + 0.06 * math.sin(c * 40) * k
	vfx.sprite(back, CX, CY, 360, 0, 0.25 + 0.3 * k, 1, at.map['sglow:P1'])
	vfx.draw(r, back)
	vfx.draw(r, self.inP :: vfx.Layer)
	if orb > 1 then
		vfx.sprite(top, CX, CY, orb * 2.6 * jit, 0, 0.7, 1, at.map['sglow:P1'])
		vfx.sprite(top, CX, CY, orb * 1.1, 0, 0.75, 1, at.map['sglow:P0'])
		if c < CHARGE and math.floor(c * 20) % 3 ~= 0 then
			vfx.sprite(top, CX, CY, orb * 2.2, math.floor(c * 20) * 1.7, 0.4 + 0.6 * k, 1, at.map[if math.floor(c * 20) % 2 == 0 then 'crackle:P0' else 'crackle:P1'])
		end
	end
	local t = c - CHARGE
	if t >= 0 and t < 0.5 then
		local e = t / 0.5
		vfx.sprite(top, CX, CY, 200 + 260 * vfx.easeOut(e), e, (1 - e) * 0.8, 1, at.map['burst:P0'])
		vfx.sprite(top, CX, CY, 80 + 420 * vfx.easeOut(e), 0, (1 - e) * 0.9, 1, at.map['sring:P0'])
	end
	vfx.draw(r, top)
	vfx.draw(r, self.out :: vfx.Layer)
end

return function(): Node<S>
	return { cycle = 0, fired = false, acc = {}, at = nil, back = nil, inP = nil, out = nil, top = nil, init = init, advance = advance, draw = draw }
end
