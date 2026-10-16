-- Ударная волна (приземление, удар молота): кольцо по земле в перспективе, пыль клубами вдоль земли,
-- камешки по баллистике с вращением и отскоком, вспышка, трещины. Порядок слоёв: пыль сзади → кольцо → камни → вспышка.
local fx = require('fxlib')
type P = { x: number, y: number, vx: number, vy: number, r: number, a: number, va: number, age: number, life: number, seed: number }
type S = { dust: { P }, rocks: { P }, cycle: number, fired: boolean, pDustS: Path, pDustL: Path, pRing: Path, pRock: Path, pRockL: Path, pFlash: Path, pCrack: Path,
	cDustS: Paint, cDustL: Paint, cRing: Paint, cRock: Paint, cRockL: Paint, cFlash: Paint, cCrack: Paint }
local GX, GY, PERIOD = 180, 260, 2.2

local function fire(self: S)
	self.dust = {}; self.rocks = {}
	for i = 1, 22 do
		local dir = if i % 2 == 0 then 1 else -1
		table.insert(self.dust, { x = GX, y = GY, vx = dir * fx.rand(80, 300), vy = fx.rand(-60, -10), r = fx.rand(12, 26), a = 0, va = 0, age = 0, life = fx.rand(0.9, 1.5), seed = 0 })
	end
	for _ = 1, 14 do
		local a = -math.pi / 2 + fx.rand(-1.1, 1.1)
		local sp = fx.rand(250, 520)
		table.insert(self.rocks, { x = GX, y = GY, vx = math.cos(a) * sp, vy = math.sin(a) * sp, r = fx.rand(4, 9), a = fx.rand(0, 6), va = fx.rand(-12, 12), age = 0, life = 1.6, seed = fx.rand(0, 10) })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false end
	if not self.fired and self.cycle > 0.05 then self.fired = true; fire(self) end
	for _, p in self.dust do p.age += dt; p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2 * dt; p.x += p.vx * dt; p.y += p.vy * dt end
	for _, p in self.rocks do
		p.age += dt; p.vy += 1300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt
		if p.y > GY + 30 and p.vy > 0 then p.y = GY + 30; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.va *= 0.5 end
	end
	return true
end

local function draw(self: S, r: Renderer)
	local t = self.cycle
	self.pCrack:reset()
	if t < 1.6 then
		for k = 0, 5 do
			local a = k * 1.05 + 0.3
			local l = 70 * fx.easeOut(t / 0.15)
			self.pCrack:moveTo(Vector.xy(GX, GY + 6)); self.pCrack:lineTo(Vector.xy(GX + math.cos(a) * l * 0.6, GY + 6 + math.sin(a) * l * 0.18)); self.pCrack:lineTo(Vector.xy(GX + math.cos(a + 0.2) * l, GY + 6 + math.sin(a + 0.2) * l * 0.3))
		end
		self.cCrack.color = Color.rgba(40, 24, 18, math.floor(220 * math.min(1, (1.6 - t) / 0.4))); r:drawPath(self.pCrack, self.cCrack)
	end
	self.pDustS:reset(); self.pDustL:reset()
	for _, p in self.dust do
		local k = p.age / p.life
		if k < 1 then local rr = p.r * (0.5 + fx.easeOut(k)) * (1 - math.max(0, k - 0.6) / 0.4); fx.circle(self.pDustS, p.x, p.y, rr); fx.circle(self.pDustL, p.x - rr * 0.2, p.y - rr * 0.25, rr * 0.6) end
	end
	r:drawPath(self.pDustS, self.cDustS); r:drawPath(self.pDustL, self.cDustL)
	if t < 0.55 then
		local k = t / 0.55
		self.pRing:reset(); fx.ellipse(self.pRing, GX, GY + 6, 20 + 160 * fx.easeOut(k), (20 + 160 * fx.easeOut(k)) * 0.28, 0)
		self.cRing.thickness = 16 * (1 - k) + 1; self.cRing.color = Color.rgba(255, 230, 190, math.floor(255 * (1 - k))); r:drawPath(self.pRing, self.cRing)
	end
	self.pRock:reset(); self.pRockL:reset()
	for _, p in self.rocks do
		if p.age < p.life then fx.rock(self.pRock, p.x, p.y, p.r, p.a, p.seed); fx.rock(self.pRockL, p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.5, p.a, p.seed) end
	end
	r:drawPath(self.pRock, self.cRock); r:drawPath(self.pRockL, self.cRockL)
	if t < 0.2 then
		self.pFlash:reset(); fx.ellipse(self.pFlash, GX, GY, 40 + 120 * fx.easeOut(t / 0.2), 30 + 50 * fx.easeOut(t / 0.2), 0)
		self.cFlash.color = Color.rgba(255, 245, 220, math.floor(255 * (1 - t / 0.2))); r:drawPath(self.pFlash, self.cFlash)
	end
end

return function(): Node<S>
	return { dust = {}, rocks = {}, cycle = 0, fired = false,
		pDustS = Path.new(), pDustL = Path.new(), pRing = Path.new(), pRock = Path.new(), pRockL = Path.new(), pFlash = Path.new(), pCrack = Path.new(),
		cDustS = Paint.with({ color = Color.rgba(150, 110, 80, 255), feather = 2 }), cDustL = Paint.with({ color = Color.rgba(212, 176, 136, 255), feather = 4 }),
		cRing = Paint.with({ style = 'stroke', thickness = 14, color = Color.rgba(255, 230, 190, 255), blendMode = 'screen', feather = 5 }),
		cRock = Paint.with({ color = Color.rgba(92, 64, 46, 255) }), cRockL = Paint.with({ color = Color.rgba(160, 120, 88, 255) }),
		cFlash = Paint.with({ color = Color.rgba(255, 245, 220, 255), blendMode = 'screen', feather = 26 }),
		cCrack = Paint.with({ style = 'stroke', thickness = 3, cap = 'round', join = 'round', color = Color.rgba(40, 24, 18, 220) }),
		advance = advance, draw = draw }
end
