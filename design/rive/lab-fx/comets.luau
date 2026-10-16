-- Кометы: летят по диагонали, за каждой — шлейф по истории положений, сужается к хвосту: отрезки раскладываются
-- по 4 «корзинам» толщины (у головы толще), 3 слоя — мягкое свечение, цвет, белое ядро; голова — яркая точка; у земли — искры.
-- (Залитый многоугольник-лента отрисовщиком не принимается — шлейф из обводок.)
local fx = require('fxlib')
type C = { x: number, y: number, vx: number, vy: number, hx: { number }, hy: { number }, n: number, hue: number, delay: number }
type Sp = { x: number, y: number, vx: number, vy: number, age: number }
type S = { comets: { C }, sparks: { Sp }, t: number, tp: { Path }, tc: { Paint }, pHead: Path, pSpark: Path, cHead: Paint, cSpark: Paint }
local HIST, GROUND = 18, 330

local function respawn(c: C)
	c.x = fx.rand(-80, 260); c.y = fx.rand(-60, -20)
	local sp = fx.rand(320, 520); c.vx = sp * 0.55; c.vy = sp
	c.n = 0; c.delay = fx.rand(0, 0.8)
end

local function init(self: S, context: Context): boolean
	for _ = 1, 5 do local c: C = { x = 0, y = 0, vx = 0, vy = 0, hx = {}, hy = {}, n = 0, hue = 0, delay = 0 }; respawn(c); c.delay = fx.rand(0, 1.5); table.insert(self.comets, c) end
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	for _, c in self.comets do
		if c.delay > 0 then c.delay -= dt; continue end
		c.x += c.vx * dt; c.y += c.vy * dt
		-- история для шлейфа: голова — первая
		table.insert(c.hx, 1, c.x); table.insert(c.hy, 1, c.y)
		if #c.hx > HIST then table.remove(c.hx); table.remove(c.hy) end
		c.n = #c.hx
		if c.y > GROUND then
			for _ = 1, 10 do local a = -math.pi / 2 + fx.rand(-1.3, 1.3); local sp = fx.rand(80, 260); table.insert(self.sparks, { x = c.x, y = GROUND, vx = math.cos(a) * sp, vy = math.sin(a) * sp, age = 0 }) end
			c.hx = {}; c.hy = {}; respawn(c)
		end
	end
	local i = 1
	while i <= #self.sparks do
		local s = self.sparks[i]
		s.age += dt; s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt
		if s.age > 0.45 then self.sparks[i] = self.sparks[#self.sparks]; table.remove(self.sparks) else i += 1 end
	end
	return true
end

local BUCKETS = 4
local LAYERS = { { 120, 90, 255, 110, 16, 8 }, { 120, 210, 255, 220, 7, 2 }, { 255, 255, 255, 255, 2.6, 0 } }   -- r, g, b, a, толщина у головы, перо

local function draw(self: S, r: Renderer)
	for _, p in self.tp do p:reset() end
	self.pHead:reset()
	for _, c in self.comets do
		if c.n >= 2 then
			for i = 1, c.n - 1 do
				local b = math.min(BUCKETS, math.floor((i - 1) / (c.n - 1) * BUCKETS) + 1)
				for L = 1, #LAYERS do
					if L == 3 and i > 9 then continue end
					local p = self.tp[(L - 1) * BUCKETS + b]
					p:moveTo(Vector.xy(c.hx[i], c.hy[i])); p:lineTo(Vector.xy(c.hx[i + 1], c.hy[i + 1]))
				end
			end
			fx.circle(self.pHead, c.x, c.y, 6)
		end
	end
	for i, p in self.tp do r:drawPath(p, self.tc[i]) end
	r:drawPath(self.pHead, self.cHead)
	self.pSpark:reset()
	for _, s in self.sparks do local k = 1 - s.age / 0.45; self.pSpark:moveTo(Vector.xy(s.x, s.y)); self.pSpark:lineTo(Vector.xy(s.x - s.vx * 0.03 * k, s.y - s.vy * 0.03 * k)) end
	r:drawPath(self.pSpark, self.cSpark)
end

return function(): Node<S>
	local tp: { Path } = {}
	local tc: { Paint } = {}
	for L, l in LAYERS do for b = 1, BUCKETS do
		local k = 1 - (b - 1) / BUCKETS
		tp[(L - 1) * BUCKETS + b] = Path.new()
		tc[(L - 1) * BUCKETS + b] = Paint.with({ style = 'stroke', cap = 'round', join = 'round', thickness = l[5] * k + 0.6, color = Color.rgba(l[1], l[2], l[3], math.floor(l[4] * (0.4 + 0.6 * k))), blendMode = 'screen', feather = l[6] * k })
	end end
	return { comets = {}, sparks = {}, t = 0, tp = tp, tc = tc, pHead = Path.new(), pSpark = Path.new(),
		cHead = Paint.with({ color = Color.rgba(235, 248, 255, 255), blendMode = 'screen', feather = 6 }),
		cSpark = Paint.with({ style = 'stroke', thickness = 2, cap = 'round', color = Color.rgba(170, 230, 255, 255), blendMode = 'screen' }),
		init = init, advance = advance, draw = draw }
end
