-- Костёр слоями (свой лист масок fire.png из Magnific). Снизу вверх:
--   свечение земли и воздуха → основа (широкий низкий купол огня) → большие языки (4 силуэта) →
--   малые язычки на макушках → горячие ядра у основания → угольки и искорки → дым.
-- Каждый язык живёт по «кадрам» атласа: рождается почти белым, желтеет, краснеет и к концу
-- истончается и рвётся (растворение: тусклые края маски пропадают первыми) — как в AAA, но мягко.
-- Языки рождаются в трёх «гнёздах» (центр выше, края ниже) — у огня есть силуэт, а не облако.
-- Общий ветер качает весь огонь разом: чем выше частица, тем сильнее снос и наклон.
local vfx = require('vfx')
type S = { t: number, wind: number, acc: { number }, at: vfx.Atlas?, back: vfx.Layer?, base: vfx.Layer?, big: vfx.Layer?, small: vfx.Layer?, core: vfx.Layer?, emb: vfx.Layer?, smoke: vfx.Layer? }
local BX, BY = 180, 304
local R = vfx.rand
local NEST = { { x = -34, s = 0.78 }, { x = 0, s = 1 }, { x = 34, s = 0.82 } }  -- гнёзда языков: смещение и масштаб

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'fire')
	self.at = at
	self.back, self.base, self.big, self.small, self.core, self.emb, self.smoke = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function tongue(self: S)
	local at = self.at :: vfx.Atlas
	local n = NEST[math.random(1, 3)]
	local size = R(150, 185) * n.s
	local m = 'tongue' .. math.random(1, 4)
	-- основание маски — ниже центра ячейки на ~0.36 размера: ставим его на угли
	vfx.spawn(self.big :: vfx.Layer, { x = BX + n.x + R(-8, 8), y = BY - size * 0.34, vx = -n.x * 0.3, vy = R(-70, -45), size = size, grow = -0.25,
		stretch = R(1.0, 1.15), life = R(0.75, 1.0), cells = vfx.seq(at, m, 'F1', 'F2', 'F2~0.2', 'F3~0.45'), add = 0.45, alpha = 0.9, fadeIn = 0.22, fadeOut = 0.3 })
end

local function lick(self: S)
	local at = self.at :: vfx.Atlas
	local n = NEST[math.random(1, 3)]
	local size = R(54, 80)
	vfx.spawn(self.small :: vfx.Layer, { x = BX + n.x * 1.2 + R(-14, 14), y = BY - 80 * n.s - R(0, 24), vx = R(-15, 15), vy = R(-170, -120), size = size, grow = -0.3,
		life = R(0.35, 0.55), cells = vfx.seq(at, 'lick' .. math.random(1, 4), 'F1', 'F2~0.2', 'F3~0.45'), add = 0.8, alpha = 0.8, sway = 30, fadeIn = 0.15, fadeOut = 0.45 })
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.t += dt
	local t = self.t
	self.wind = math.sin(t * 1.1) * 0.55 + math.sin(t * 2.9) * 0.25 + math.sin(t * 7.3) * 0.08
	local w = self.wind
	vfx.emit(self.acc, 1, 9, dt, function() tongue(self) end)
	vfx.emit(self.acc, 2, 11, dt, function() lick(self) end)
	vfx.emit(self.acc, 3, 6, dt, function()
		vfx.spawn(self.core :: vfx.Layer, { x = BX + R(-26, 26), y = BY - 18, vy = -30, size = R(60, 80), grow = -0.3, stretch = 0.8, life = 0.5,
			cells = { at.map['fcore:F0'] }, add = 1, alpha = 0.22, fadeIn = 0.3, fadeOut = 0.5 })
	end)
	vfx.emit(self.acc, 4, 6, dt, function()
		local vx = R(-50, 50)
		vfx.spawn(self.emb :: vfx.Layer, { x = BX + R(-40, 40), y = BY - R(40, 90), vx = vx, vy = R(-230, -150), rot = math.pi + vx * 0.004, size = R(16, 26), life = R(0.9, 1.5),
			cells = vfx.seq(at, 'ember', 'F0', 'F2'), add = 1, drag = 0.8, sway = 55, fadeIn = 0.06, fadeOut = 0.5 })
	end)
	vfx.emit(self.acc, 5, 1.2, dt, function()
		vfx.spawn(self.emb :: vfx.Layer, { x = BX + R(-30, 30), y = BY - 100, vx = R(-30, 30), vy = R(-120, -80), rot = R(0, 6.28), vr = R(-2, 2), size = R(40, 56), life = R(1.0, 1.4),
			cells = { at.map['specks:F0'] }, add = 1, sway = 40, fadeIn = 0.2, fadeOut = 0.5 })
	end)
	vfx.emit(self.acc, 6, 1.6, dt, function()
		local wisp = math.random() < 0.5
		vfx.spawn(self.smoke :: vfx.Layer, { x = BX + R(-14, 14), y = BY - 200, vx = w * 30, vy = R(-50, -35), rot = if wisp then R(-0.2, 0.2) else R(0, 6.28), vr = R(-0.3, 0.3),
			size = if wisp then 90 else 70, grow = 1.0, life = 2.4, cells = vfx.seq(at, if wisp then 'wisp' else 'fpuff', 'F4', 'F4~0.4'), add = 0, alpha = 0.2, sway = 12, fadeIn = 0.35, fadeOut = 0.5 })
	end)
	-- ветер: снос растёт с высотой (с возрастом), языки наклоняются по ветру
	for _, l in { self.big, self.small, self.core, self.emb } do
		for _, p in (l :: vfx.Layer).parts do
			local k = p.age / p.life
			p.vx += w * 120 * k * dt
		end
	end
	for _, p in (self.big :: vfx.Layer).parts do p.rot = w * 0.22 * (0.4 + p.age / p.life) end
	for _, p in (self.small :: vfx.Layer).parts do p.rot = w * 0.35 end
	for _, l in { self.big, self.small, self.core, self.emb, self.smoke } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back, base = self.back :: vfx.Layer, self.base :: vfx.Layer
	back.parts = {}; base.parts = {}
	local t, w = self.t, self.wind
	local fl = 0.92 + 0.05 * math.sin(t * 9) + 0.03 * math.sin(t * 23)
	vfx.sprite(back, BX + w * 12, BY - 90, 420 * fl, 0, 0.32, 1, at.map['sglow:F2'], 1.15)
	vfx.sprite(back, BX, BY + 8, 300 * fl, 0, 0.75, 1, at.map['gglow:F2'], 0.7)
	vfx.sprite(back, BX, BY - 30, 220 * fl, 0, 0.25, 1, at.map['sglow:F1'], 0.6)
	vfx.draw(r, back)
	-- основа: два купола огня, дышат и чуть сдвигаются, чтобы не было статичной «шапки»
	local b1 = 1 + 0.06 * math.sin(t * 5.3)
	local b2 = 1 + 0.06 * math.sin(t * 6.1 + 1.7)
	vfx.sprite(base, BX - 4 + w * 6, BY - 22, 190 * b1, w * 0.06, 0.75, 0.4, at.map['fbase:F2'], 0.9 * b1)
	vfx.sprite(base, BX + 6 + w * 8, BY - 26, 160 * b2, w * 0.08 + 0.04, 0.55, 0.6, at.map['fbase:F1'], 0.8 * b2)
	vfx.draw(r, base)
	vfx.draw(r, self.smoke :: vfx.Layer)
	vfx.draw(r, self.big :: vfx.Layer)
	vfx.draw(r, self.small :: vfx.Layer)
	vfx.draw(r, self.core :: vfx.Layer)
	vfx.draw(r, self.emb :: vfx.Layer)
end

return function(): Node<S>
	return { t = 0, wind = 0, acc = {}, at = nil, back = nil, base = nil, big = nil, small = nil, core = nil, emb = nil, smoke = nil, init = init, advance = advance, draw = draw }
end
