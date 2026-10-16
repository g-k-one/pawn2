-- Джекпот: фонтан гемов GRAM и золотых монет. Фазы: свечение нарастает (0.25 с) → выброс → отскоки → угасание.
-- Монета «крутится» — её ширина = |cos(угол)|, ребро темнее грани; гем — ромб из светлой и тёмной граней.
local fx = require('fxlib')
type P = { x: number, y: number, vx: number, vy: number, a: number, va: number, spin: number, vs: number, size: number, coin: boolean, age: number }
type S = { parts: { P }, t: number, cycle: number, fired: boolean,
	pRim: Path, pFace: Path, pShine: Path, pGemTop: Path, pGemBot: Path, pSpark: Path, pGlow: Path,
	cRim: Paint, cFace: Paint, cShine: Paint, cGemTop: Paint, cGemBot: Paint, cSpark: Paint, cGlow: Paint }
local FLOOR, PERIOD = 312, 2.6

local function burst(self: S)
	for i = 1, 46 do
		local a = -math.pi / 2 + fx.rand(-0.75, 0.75)
		local sp = fx.rand(380, 760)
		table.insert(self.parts, { x = 180 + fx.rand(-10, 10), y = FLOOR - 6, vx = math.cos(a) * sp, vy = math.sin(a) * sp,
			a = fx.rand(0, 6.28), va = fx.rand(-8, 8), spin = fx.rand(0, 6.28), vs = fx.rand(8, 16), size = fx.rand(9, 15), coin = i % 3 == 0, age = 0 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false; self.parts = {} end
	if not self.fired and self.cycle >= 0.25 then self.fired = true; burst(self) end
	for _, p in self.parts do
		p.age += dt
		p.vy += 1500 * dt
		p.vx *= 1 - 0.6 * dt
		p.x += p.vx * dt; p.y += p.vy * dt
		p.a += p.va * dt; p.spin += p.vs * dt
		if p.y > FLOOR and p.vy > 0 then p.y = FLOOR; p.vy = -p.vy * 0.45; p.vx *= 0.7; p.va *= 0.6; p.vs *= 0.7 end
	end
	return true
end

local function draw(self: S, r: Renderer)
	-- свечение в точке выброса: нарастает до удара, гаснет после
	local c = self.cycle
	local g = if c < 0.25 then fx.easeIn(c / 0.25) else math.max(0, 1 - (c - 0.25) / 0.5)
	if g > 0.01 then
		self.pGlow:reset(); fx.ellipse(self.pGlow, 180, FLOOR - 10, 70 + 50 * g, 30 + 18 * g, 0)
		self.cGlow.color = Color.rgba(255, 220, 120, math.floor(200 * g)); r:drawPath(self.pGlow, self.cGlow)
	end
	for _, path in { self.pRim, self.pFace, self.pShine, self.pGemTop, self.pGemBot, self.pSpark } do path:reset() end
	for _, p in self.parts do
		local life = math.max(0, 1 - math.max(0, p.age - 1.6) / 0.5)
		if life <= 0 then continue end
		local s = p.size * life
		if p.coin then
			local w = math.abs(math.cos(p.spin))
			fx.ellipse(self.pRim, p.x, p.y, s * math.max(w, 0.12), s, p.a)
			fx.ellipse(self.pFace, p.x - 1.2 * w, p.y, s * 0.78 * math.max(w, 0.05), s * 0.78, p.a)
			if w > 0.5 then fx.ellipse(self.pShine, p.x - s * 0.25 * w, p.y - s * 0.3, s * 0.18 * w, s * 0.28, p.a) end
		else
			-- гем: верхняя грань светлая, нижняя тёмная; вращение — ширина
			local w = 0.35 + 0.65 * math.abs(math.cos(p.spin))
			local ca, sa = math.cos(p.a), math.sin(p.a)
			local function pt(u: number, v: number): Vector return Vector.xy(p.x + u * ca - v * sa, p.y + u * sa + v * ca) end
			self.pGemTop:moveTo(pt(-s * w, -s * 0.15)); self.pGemTop:lineTo(pt(-s * 0.5 * w, -s * 0.6)); self.pGemTop:lineTo(pt(s * 0.5 * w, -s * 0.6)); self.pGemTop:lineTo(pt(s * w, -s * 0.15)); self.pGemTop:close()
			self.pGemBot:moveTo(pt(-s * w, -s * 0.15)); self.pGemBot:lineTo(pt(s * w, -s * 0.15)); self.pGemBot:lineTo(pt(0, s * 0.85)); self.pGemBot:close()
		end
		if p.age < 0.5 and math.sin(p.age * 40 + p.spin) > 0.6 then fx.star4(self.pSpark, p.x + 6, p.y - 6, 5 * (1 - p.age * 2), p.a) end
	end
	r:drawPath(self.pGemBot, self.cGemBot); r:drawPath(self.pGemTop, self.cGemTop)
	r:drawPath(self.pRim, self.cRim); r:drawPath(self.pFace, self.cFace); r:drawPath(self.pShine, self.cShine)
	r:drawPath(self.pSpark, self.cSpark)
end

return function(): Node<S>
	return {
		parts = {}, t = 0, cycle = 0, fired = false,
		pRim = Path.new(), pFace = Path.new(), pShine = Path.new(), pGemTop = Path.new(), pGemBot = Path.new(), pSpark = Path.new(), pGlow = Path.new(),
		cRim = Paint.with({ color = Color.rgba(176, 108, 20, 255) }), cFace = Paint.with({ color = Color.rgba(255, 196, 54, 255) }),
		cShine = Paint.with({ color = Color.rgba(255, 246, 200, 230) }),
		cGemTop = Paint.with({ color = Color.rgba(120, 214, 255, 255) }), cGemBot = Paint.with({ color = Color.rgba(30, 120, 240, 255) }),
		cSpark = Paint.with({ color = Color.rgba(255, 255, 255, 255), blendMode = 'screen' }),
		cGlow = Paint.with({ color = Color.rgba(255, 220, 120, 200), blendMode = 'screen', feather = 30 }),
		advance = advance, draw = draw,
	}
end
