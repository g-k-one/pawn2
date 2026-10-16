-- Мультяшный дым-пуф: клубы раздуваются по кривой (быстро → медленно), всплывают и тают.
-- Объём — как у огня: каждый клуб = тень + основной тон + блик сверху-слева, одинаковые слои у всех клубов —
-- один контур, и клубы сливаются в облако с чистыми полосами света.
local fx = require('fxlib')
type P = { x: number, y: number, vx: number, vy: number, r: number, age: number, life: number }
type S = { parts: { P }, cycle: number, fired: boolean, pShadow: Path, pBase: Path, pLight: Path, cShadow: Paint, cBase: Paint, cLight: Paint, pFlash: Path, cFlash: Paint }
local PERIOD = 2.4

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false; self.parts = {} end
	if not self.fired then
		self.fired = true
		for _ = 1, 26 do
			local a = fx.rand(0, 6.28)
			local sp = fx.rand(60, 200)
			table.insert(self.parts, { x = 180 + math.cos(a) * 10, y = 230 + math.sin(a) * 6, vx = math.cos(a) * sp, vy = math.sin(a) * sp * 0.55 - 30, r = fx.rand(22, 40), age = 0, life = fx.rand(1.3, 2.0) })
		end
	end
	for _, p in self.parts do
		p.age += dt
		p.vx *= 1 - 3 * dt; p.vy = p.vy * (1 - 3 * dt) - 40 * dt
		p.x += p.vx * dt; p.y += p.vy * dt
	end
	return true
end

local function draw(self: S, r: Renderer)
	if self.cycle < 0.18 then
		self.pFlash:reset(); fx.circle(self.pFlash, 180, 230, 30 + 90 * fx.easeOut(self.cycle / 0.18))
		self.cFlash.color = Color.rgba(255, 236, 190, math.floor(255 * (1 - self.cycle / 0.18))); r:drawPath(self.pFlash, self.cFlash)
	end
	self.pShadow:reset(); self.pBase:reset(); self.pLight:reset()
	for _, p in self.parts do
		local k = p.age / p.life
		if k < 1 then
			local rr = p.r * (0.4 + 0.9 * fx.easeOut(math.min(1, k * 2.2))) * (1 - math.max(0, k - 0.7) / 0.3)
			fx.circle(self.pShadow, p.x + rr * 0.08, p.y + rr * 0.1, rr)
			fx.circle(self.pBase, p.x - rr * 0.04, p.y - rr * 0.05, rr * 0.86)
			fx.circle(self.pLight, p.x - rr * 0.25, p.y - rr * 0.3, rr * 0.42)
		end
	end
	r:drawPath(self.pShadow, self.cShadow); r:drawPath(self.pBase, self.cBase); r:drawPath(self.pLight, self.cLight)
end

return function(): Node<S>
	return { parts = {}, cycle = 0, fired = false, pShadow = Path.new(), pBase = Path.new(), pLight = Path.new(),
		cShadow = Paint.with({ color = Color.rgba(88, 84, 110, 255), feather = 1.5 }), cBase = Paint.with({ color = Color.rgba(150, 148, 172, 255), feather = 1.5 }),
		cLight = Paint.with({ color = Color.rgba(214, 214, 228, 255), feather = 4 }),
		pFlash = Path.new(), cFlash = Paint.with({ color = Color.rgba(255, 236, 190, 255), blendMode = 'screen', feather = 30 }), advance = advance, draw = draw }
end
