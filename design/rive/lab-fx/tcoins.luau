-- Награда (цикл 3 с): вспышка-лучи, фонтан монет и гемов. Монета вращается сменой рисованных кадров
-- (анфас → в три четверти → ребро → в три четверти), падает, отскакивает от пола и ложится.
-- По монетам пробегают блики, сзади — мягкое золотое свечение.
local vfx = require('vfx')
type C = { x: number, y: number, vx: number, vy: number, spin: number, vs: number, rot: number, size: number, gem: number, age: number, rest: boolean }
type S = { cycle: number, fired: boolean, items: { C }, at: vfx.Atlas?, back: vfx.Layer?, fx: vfx.Layer?, tw: vfx.Layer? }
local CX, FLOOR, PERIOD = 180, 318, 3.0
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'coins')
	self.at = at
	self.back, self.fx, self.tw = vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function burst(self: S)
	self.items = {}
	for i = 1, 22 do
		local a = -math.pi / 2 + R(-0.6, 0.6)
		local sp = R(380, 620)
		table.insert(self.items, { x = CX + R(-10, 10), y = 250, vx = math.cos(a) * sp, vy = math.sin(a) * sp, spin = R(0, 6.28), vs = R(9, 16), rot = R(-0.3, 0.3),
			size = R(36, 48), gem = if i % 6 == 0 then 1 elseif i % 7 == 0 then 2 elseif i % 11 == 0 then 3 else 0, age = 0, rest = false })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false end
	if not self.fired and self.cycle > 0.1 then self.fired = true; burst(self) end
	for _, c in self.items do
		c.age += dt
		if not c.rest then
			c.vy += 1300 * dt
			c.x += c.vx * dt; c.y += c.vy * dt
			c.spin += c.vs * dt
			if c.y > FLOOR - c.size * 0.4 and c.vy > 0 then
				c.y = FLOOR - c.size * 0.4
				c.vy *= -0.42; c.vx *= 0.6; c.vs *= 0.6
				if math.abs(c.vy) < 70 then c.rest = true; c.vy = 0; c.spin = 0 end
			end
		end
	end
	-- блики: на случайной монете вспыхивает звёздочка
	if #self.items > 0 and math.random() < dt * 14 then
		local c = self.items[math.random(1, #self.items)]
		vfx.spawn(self.tw :: vfx.Layer, { x = c.x + R(-8, 8), y = c.y + R(-10, 4), size = R(26, 40), life = 0.45, rot = R(0, 1), vr = 2,
			cells = vfx.seq(at, 'twinkle', 'W0', 'G0'), add = 1, fadeIn = 0.35, fadeOut = 0.5 })
	end
	vfx.step(self.tw :: vfx.Layer, dt)
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back, fx = self.back :: vfx.Layer, self.fx :: vfx.Layer
	back.parts = {}; fx.parts = {}
	local t = self.cycle - 0.1
	local fadeAll = math.clamp((PERIOD - self.cycle) / 0.35, 0, 1)
	vfx.sprite(back, CX, 250, 360, 0, 0.35 * fadeAll, 1, at.map['sglow:G1'], 0.8)
	if t >= 0 and t < 0.5 then
		local k = t / 0.5
		vfx.sprite(back, CX, 250, 160 + 260 * vfx.easeOut(k), k * 0.6, 1 - k, 1, at.map['burst:G0'])
		vfx.sprite(back, CX, 250, 220, 0, (1 - k) * 0.8, 1, at.map['sglow:G0'])
	end
	vfx.draw(r, back)
	for _, c in self.items do
		local cell: number
		local sx = 1
		if c.gem == 1 then cell = at.map['gem'] elseif c.gem == 2 then cell = at.map['gem2'] elseif c.gem == 3 then cell = at.map['gemP'] else
			local s = math.cos(c.spin)
			local a = math.abs(s)
			cell = if a > 0.7 then at.map['coinF'] elseif a > 0.25 then at.map['coinT'] else at.map['coinE']
			sx = if s < 0 then -1 else 1
		end
		-- ребро монеты уже рисованного кадра coinE, зеркало по знаку cos — вращение в обе стороны
		vfx.sprite(fx, c.x, c.y, c.size * sx * 1.6, c.rot * (if c.rest then 0.3 else 1), fadeAll, 0, cell, sx)
	end
	vfx.draw(r, fx)
	vfx.draw(r, self.tw :: vfx.Layer)
end

return function(): Node<S>
	return { cycle = 0, fired = false, items = {}, at = nil, back = nil, fx = nil, tw = nil, init = init, advance = advance, draw = draw }
end
