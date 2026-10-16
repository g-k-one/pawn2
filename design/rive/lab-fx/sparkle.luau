-- Блёстки редкого NFT: вокруг карточки мерцают четырёхлучевые звёздочки (рост → вспышка → угасание, со своим ритмом),
-- медленно всплывают; по рамке бежит блик; мягкие «боке»-точки на фоне — вторичный, тусклый слой.
local fx = require('fxlib')
type St = { x: number, y: number, ph: number, sp: number, size: number, rot: number, gold: boolean }
type S = { stars: { St }, bokeh: { St }, t: number, pCard: Path, cCard: Paint, pFrame: Path, cFrame: Paint, pRun: Path, cRun: Paint, pWhite: Path, cWhite: Paint, pGold: Path, cGold: Paint, pBokeh: Path, cBokeh: Paint }
local L, T, R, B = 110, 70, 250, 290

local function init(self: S, context: Context): boolean
	for _ = 1, 34 do
		local side = math.random(1, 4)
		local x = if side <= 2 then fx.rand(L - 30, R + 30) else (if side == 3 then fx.rand(L - 40, L + 10) else fx.rand(R - 10, R + 40))
		local y = if side == 1 then fx.rand(T - 40, T + 10) elseif side == 2 then fx.rand(B - 10, B + 40) else fx.rand(T, B)
		table.insert(self.stars, { x = x, y = y, ph = fx.rand(0, 1), sp = fx.rand(0.5, 1.1), size = fx.rand(5, 13), rot = fx.rand(-0.3, 0.3), gold = math.random() < 0.45 })
	end
	for _ = 1, 22 do table.insert(self.bokeh, { x = fx.rand(20, 340), y = fx.rand(20, 340), ph = fx.rand(0, 6.28), sp = fx.rand(0.2, 0.5), size = fx.rand(4, 12), rot = 0, gold = false }) end
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	for _, s in self.stars do s.y -= 6 * dt; if s.y < T - 50 then s.y = B + 40 end end
	return true
end

local function draw(self: S, r: Renderer)
	self.pBokeh:reset()
	for _, b in self.bokeh do fx.circle(self.pBokeh, b.x, b.y + math.sin(self.t * b.sp + b.ph) * 6, b.size * (0.6 + 0.4 * math.sin(self.t * b.sp * 2 + b.ph))) end
	r:drawPath(self.pBokeh, self.cBokeh)
	-- карточка: тёмная плашка + золотая рамка; по рамке бежит блик
	self.pCard:reset(); fx.rect(self.pCard, (L + R) / 2, (T + B) / 2, (R - L) / 2, (B - T) / 2, 0); r:drawPath(self.pCard, self.cCard)
	self.pFrame:reset(); fx.rect(self.pFrame, (L + R) / 2, (T + B) / 2, (R - L) / 2, (B - T) / 2, 0); r:drawPath(self.pFrame, self.cFrame)
	local per = 2 * ((R - L) + (B - T))
	local d = (self.t * 240) % per
	local function at(s: number): Vector
		s = s % per
		if s < R - L then return Vector.xy(L + s, T) end; s -= R - L
		if s < B - T then return Vector.xy(R, T + s) end; s -= B - T
		if s < R - L then return Vector.xy(R - s, B) end; s -= R - L
		return Vector.xy(L, B - s)
	end
	self.pRun:reset(); self.pRun:moveTo(at(d)); for k = 1, 10 do self.pRun:lineTo(at(d + k * 6)) end; r:drawPath(self.pRun, self.cRun)
	-- звёздочки: у каждой свой цикл «рост → вспышка → угасание»
	self.pWhite:reset(); self.pGold:reset()
	for _, s in self.stars do
		local k = (self.t * s.sp + s.ph) % 1
		local a = if k < 0.25 then fx.easeOut(k / 0.25) elseif k < 0.45 then 1 - (k - 0.25) / 0.2 * 0.8 else math.max(0, 0.2 - (k - 0.45))
		if a > 0.02 then fx.star4(if s.gold then self.pGold else self.pWhite, s.x, s.y, s.size * a, s.rot + k * 0.6) end
	end
	r:drawPath(self.pGold, self.cGold); r:drawPath(self.pWhite, self.cWhite)
end

return function(): Node<S>
	return { stars = {}, bokeh = {}, t = 0,
		pCard = Path.new(), cCard = Paint.with({ color = Color.rgba(34, 24, 66, 255) }),
		pFrame = Path.new(), cFrame = Paint.with({ style = 'stroke', thickness = 4, color = Color.rgba(232, 182, 76, 255) }),
		pRun = Path.new(), cRun = Paint.with({ style = 'stroke', thickness = 6, cap = 'round', color = Color.rgba(255, 245, 210, 255), blendMode = 'screen', feather = 4 }),
		pWhite = Path.new(), cWhite = Paint.with({ color = Color.rgba(255, 255, 255, 255), blendMode = 'screen', feather = 0.8 }),
		pGold = Path.new(), cGold = Paint.with({ color = Color.rgba(255, 214, 110, 255), blendMode = 'screen', feather = 0.8 }),
		pBokeh = Path.new(), cBokeh = Paint.with({ color = Color.rgba(140, 110, 255, 60), blendMode = 'screen', feather = 6 }),
		init = init, advance = advance, draw = draw }
end
