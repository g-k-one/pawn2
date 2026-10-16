-- Заряд → взрыв (раскрытие «Ультра»): 1.1 с частицы стягиваются в шар по кривой (резкий старт к концу),
-- шар растёт и дрожит; удар — белая вспышка, кольцо, лучи-штрихи наружу; короткое тусклое затухание.
local fx = require('fxlib')
type P = { a: number, r0: number, d: number, size: number }
type R = { a: number, sp: number, len: number }
type S = { inP: { P }, rays: { R }, cycle: number, pIn: Path, cIn: Paint, pOrb: Path, cOrb: Paint, pOrbCore: Path, cOrbCore: Paint, pRay: Path, cRay: Paint, pRing: Path, cRing: Paint, pFlash: Path, cFlash: Paint }
local CX, CY, CHARGE, PERIOD = 180, 180, 1.1, 2.4

local function reset(self: S)
	self.inP = {}; self.rays = {}
	for _ = 1, 90 do table.insert(self.inP, { a = fx.rand(0, 6.28), r0 = fx.rand(110, 170), d = fx.rand(0, 0.5), size = fx.rand(2, 4) }) end
	for i = 1, 26 do table.insert(self.rays, { a = i / 26 * 6.28 + fx.rand(-0.1, 0.1), sp = fx.rand(260, 420), len = fx.rand(18, 40) }) end
end

local function advance(self: S, seconds: number): boolean
	self.cycle += math.min(seconds, 1 / 30)
	if self.cycle >= PERIOD then self.cycle = 0; reset(self) end
	return true
end

local function draw(self: S, r: Renderer)
	local c = self.cycle
	local col = { 255, 79, 216 }                                           -- цвет ранга «Ультра»
	if c < CHARGE then
		local k = c / CHARGE
		self.pIn:reset()
		for _, p in self.inP do
			local t = math.clamp((c - p.d) / (CHARGE - p.d), 0, 1)
			local rr = p.r0 * (1 - fx.easeIn(t))
			if t > 0 and rr > 4 then
				local a = p.a + t * 2.2
				fx.ellipse(self.pIn, CX + math.cos(a) * rr, CY + math.sin(a) * rr, p.size * (1 + t * 2), p.size * 0.7, a + math.pi / 2)
			end
		end
		r:drawPath(self.pIn, self.cIn)
		local jit = k * k * 3
		self.pOrb:reset(); fx.circle(self.pOrb, CX + fx.rand(-jit, jit), CY + fx.rand(-jit, jit), 14 + 34 * k * k); r:drawPath(self.pOrb, self.cOrb)
		self.pOrbCore:reset(); fx.circle(self.pOrbCore, CX, CY, 6 + 16 * k); r:drawPath(self.pOrbCore, self.cOrbCore)
	else
		local t = c - CHARGE
		-- вспышка: самый яркий кадр — сразу, потом быстро вниз
		if t < 0.3 then
			self.pFlash:reset(); fx.circle(self.pFlash, CX, CY, 60 + 300 * fx.easeOut(t / 0.3))
			self.cFlash.color = Color.rgba(255, 220, 250, math.floor(255 * (1 - t / 0.3))); r:drawPath(self.pFlash, self.cFlash)
		end
		if t < 0.6 then
			self.pRing:reset(); local rr = 30 + 170 * fx.easeOut(t / 0.6); fx.circle(self.pRing, CX, CY, rr)
			self.cRing.thickness = 14 * (1 - t / 0.6) + 1; self.cRing.color = Color.rgba(col[1], col[2], col[3], math.floor(255 * (1 - t / 0.6))); r:drawPath(self.pRing, self.cRing)
		end
		if t < 0.7 then
			self.pRay:reset()
			for _, ray in self.rays do
				local d = ray.sp * fx.easeOut(t / 0.7) * 0.7 + 20
				local l = ray.len * (1 - t / 0.7)
				self.pRay:moveTo(Vector.xy(CX + math.cos(ray.a) * d, CY + math.sin(ray.a) * d))
				self.pRay:lineTo(Vector.xy(CX + math.cos(ray.a) * (d + l), CY + math.sin(ray.a) * (d + l)))
			end
			self.cRay.color = Color.rgba(255, 230, 250, math.floor(255 * (1 - t / 0.7))); r:drawPath(self.pRay, self.cRay)
		end
	end
end

local function init(self: S, context: Context): boolean
	reset(self)
	return true
end

return function(): Node<S>
	return { inP = {}, rays = {}, cycle = 0,
		pIn = Path.new(), cIn = Paint.with({ color = Color.rgba(255, 140, 230, 230), blendMode = 'screen', feather = 1.5 }),
		pOrb = Path.new(), cOrb = Paint.with({ color = Color.rgba(255, 79, 216, 220), blendMode = 'screen', feather = 16 }),
		pOrbCore = Path.new(), cOrbCore = Paint.with({ color = Color.rgba(255, 245, 255, 255), feather = 4 }),
		pRay = Path.new(), cRay = Paint.with({ style = 'stroke', thickness = 4, cap = 'round', color = Color.rgba(255, 230, 250, 255), blendMode = 'screen' }),
		pRing = Path.new(), cRing = Paint.with({ style = 'stroke', thickness = 12, color = Color.rgba(255, 79, 216, 255), blendMode = 'screen', feather = 6 }),
		pFlash = Path.new(), cFlash = Paint.with({ color = Color.rgba(255, 220, 250, 255), blendMode = 'screen', feather = 60 }),
		init = init, advance = advance, draw = draw }
end
