-- Портал (открытие кейса): частицы рождаются на краю и по спирали затягиваются в центр, ускоряясь;
-- цвет — от фиолетового на краю к голубому и белому в ядре (светлый центр — «магия»); 3 дуги вращаются, ядро пульсирует.
local fx = require('fxlib')
type P = { r: number, a: number, w: number, size: number }
type S = { parts: { P }, t: number, acc: number, paths: { Path }, paints: { Paint }, pArc: Path, cArc: Paint, pCore: Path, cCore: Paint }
local CX, CY, R0 = 180, 180, 150
local COLS = { { 140, 70, 255, 200 }, { 110, 120, 255, 220 }, { 90, 200, 255, 235 }, { 230, 250, 255, 255 } }

local function spawn(self: S)
	table.insert(self.parts, { r = R0 + fx.rand(-10, 20), a = fx.rand(0, 6.28), w = fx.rand(1.6, 2.6), size = fx.rand(2, 4.5) })
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	self.acc += dt * 160
	while self.acc >= 1 do self.acc -= 1; spawn(self) end
	local i = 1
	while i <= #self.parts do
		local p = self.parts[i]
		local k = 1 - p.r / R0                                             -- ближе к центру — быстрее (закон закрученной воронки)
		p.a += p.w * (1 + k * 4) * dt
		p.r -= (40 + 180 * k * k) * dt
		if p.r < 6 then self.parts[i] = self.parts[#self.parts]; table.remove(self.parts) else i += 1 end
	end
	return true
end

local function draw(self: S, r: Renderer)
	local pulse = 1 + 0.12 * math.sin(self.t * 9)
	self.pCore:reset(); fx.circle(self.pCore, CX, CY, 38 * pulse); r:drawPath(self.pCore, self.cCore)
	-- три дуги-кольца вращаются в разные стороны
	self.pArc:reset()
	for k = 0, 2 do
		local rad, a0 = 60 + k * 32, self.t * (k % 2 == 0 and 1.4 or -1.1) + k
		for j = 0, 1 do
			local s = a0 + j * math.pi
			self.pArc:moveTo(Vector.xy(CX + math.cos(s) * rad, CY + math.sin(s) * rad * 0.92))
			for u = 1, 12 do local ang = s + u * 0.13; self.pArc:lineTo(Vector.xy(CX + math.cos(ang) * rad, CY + math.sin(ang) * rad * 0.92)) end
		end
	end
	r:drawPath(self.pArc, self.cArc)
	for _, p in self.paths do p:reset() end
	for _, p in self.parts do
		local k = 1 - p.r / R0
		local b = math.clamp(math.floor(k * 4) + 1, 1, 4)
		local x, y = CX + math.cos(p.a) * p.r, CY + math.sin(p.a) * p.r * 0.92
		-- штрих вдоль орбиты: длина растёт со скоростью (размытие по движению показывает направление)
		local tail = 0.08 + k * 0.25
		fx.ellipse(self.paths[b], x, y, p.size * (1 + k * 3), p.size * 0.6, p.a + math.pi / 2 + tail)
	end
	for i = 1, 4 do r:drawPath(self.paths[i], self.paints[i]) end
end

return function(): Node<S>
	local paths: { Path } = {}
	local paints: { Paint } = {}
	for i, c in COLS do paths[i] = Path.new(); paints[i] = Paint.with({ color = Color.rgba(c[1], c[2], c[3], c[4]), blendMode = 'screen', feather = 1.5 }) end
	return { parts = {}, t = 0, acc = 0, paths = paths, paints = paints,
		pArc = Path.new(), cArc = Paint.with({ style = 'stroke', thickness = 3, color = Color.rgba(170, 130, 255, 170), blendMode = 'screen', feather = 3, cap = 'round' }),
		pCore = Path.new(), cCore = Paint.with({ color = Color.rgba(200, 230, 255, 255), blendMode = 'screen', feather = 22 }), advance = advance, draw = draw }
end
