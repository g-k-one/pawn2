-- Дым (мобильный, «ватный»): рисованные клубы рождаются у основания, поднимаются, растут, медленно вращаются и
-- темнеют к верху (светлый → лавандово-серый); обычное смешивание, а не сложение — дым закрывает фон.
-- У основания тлеет тёплое свечение, изредка взлетают искорки.
local vfx = require('vfx')
type S = { t: number, acc: { number }, at: vfx.Atlas?, back: vfx.Layer?, puffs: vfx.Layer?, small: vfx.Layer?, tw: vfx.Layer? }
local BX, BY = 180, 320
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'smoke')
	self.at = at
	self.back, self.puffs, self.small, self.tw = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.t += dt
	local w = math.sin(self.t * 0.8) * 20
	vfx.emit(self.acc, 1, 4.5, dt, function()
		vfx.spawn(self.puffs :: vfx.Layer, { x = BX + R(-20, 20), y = BY, vx = R(-10, 10), vy = R(-90, -70), rot = R(0, 6.28), vr = R(-0.4, 0.4), size = R(70, 90), grow = 1.6,
			life = R(3.0, 3.6), cells = vfx.seq(at, 'puff', 'S3', 'S2', 'S1'), add = 0, alpha = 0.85, drag = 0.25, sway = 10, fadeIn = 0.12, fadeOut = 0.45 })
	end)
	vfx.emit(self.acc, 2, 5, dt, function()
		vfx.spawn(self.small :: vfx.Layer, { x = BX + R(-40, 40), y = BY - R(0, 20), vx = R(-30, 30), vy = R(-60, -40), rot = R(0, 6.28), vr = R(-0.8, 0.8), size = R(36, 50), grow = 0.8,
			life = R(1.4, 2.0), cells = vfx.seq(at, 'puffS', 'S3', 'S2'), add = 0, alpha = 0.7, sway = 14, fadeIn = 0.15, fadeOut = 0.5 })
	end)
	vfx.emit(self.acc, 3, 3, dt, function()
		vfx.spawn(self.tw :: vfx.Layer, { x = BX + R(-30, 30), y = BY - 20, vx = R(-30, 30), vy = R(-150, -90), size = R(14, 22), life = R(0.8, 1.2), vr = 3,
			cells = vfx.seq(at, 'twinkle', 'W0'), add = 1, alpha = 0.8, sway = 30, fadeIn = 0.2, fadeOut = 0.5 })
	end)
	for _, l in { self.puffs, self.small } do for _, p in (l :: vfx.Layer).parts do p.vx += w * dt end end
	for _, l in { self.puffs, self.small, self.tw } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back = self.back :: vfx.Layer
	back.parts = {}
	vfx.sprite(back, BX, BY + 10, 220 * (1 + 0.06 * math.sin(self.t * 4)), 0, 0.55, 1, at.map['sglow:F1'], 0.45)
	vfx.draw(r, back)
	vfx.draw(r, self.small :: vfx.Layer)
	vfx.draw(r, self.puffs :: vfx.Layer)
	vfx.draw(r, self.tw :: vfx.Layer)
end

return function(): Node<S>
	return { t = 0, acc = {}, at = nil, back = nil, puffs = nil, small = nil, tw = nil, init = init, advance = advance, draw = draw }
end
