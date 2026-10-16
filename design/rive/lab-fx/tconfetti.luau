-- Конфетти победы: две хлопушки снизу по углам — мягкая вспышка-лучи на текстуре, бумажки вектором
-- (кувыркаются: высота = cos угла, порхают по синусу, сильное сопротивление воздуха), сверху — мерцающие звёздочки.
local fx = require('fxlib')
local vfx = require('vfx')
type P = { x: number, y: number, vx: number, vy: number, a: number, va: number, flip: number, vf: number, ph: number, col: number, w: number, age: number }
type S = { parts: { P }, cycle: number, fired: boolean, paths: { Path }, paints: { Paint }, at: vfx.Atlas?, glow: vfx.Layer?, tw: vfx.Layer? }
local PERIOD = 3.2
-- мягкая мобильная палитра: насыщенно, но без кислотности
local COLS = { { 255, 110, 196 }, { 255, 206, 84 }, { 96, 206, 255 }, { 130, 232, 150 }, { 176, 132, 255 } }
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'confetti')
	self.at = at
	self.glow, self.tw = vfx.layer(at), vfx.layer(at)
	return true
end

local function cannon(self: S, x: number, dir: number)
	for _ = 1, 60 do
		local a = -math.pi / 2 + dir * R(0.25, 0.75)
		local sp = R(420, 900)
		table.insert(self.parts, { x = x, y = 330, vx = math.cos(a) * sp, vy = math.sin(a) * sp, a = R(0, 6.28), va = R(-6, 6),
			flip = R(0, 6.28), vf = R(6, 14), ph = R(0, 6.28), col = math.random(1, #COLS), w = R(4.5, 7), age = 0 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false; self.parts = {} end
	if not self.fired and self.cycle > 0.1 then self.fired = true; cannon(self, 20, 1); cannon(self, 340, -1) end
	for _, p in self.parts do
		p.age += dt
		local drag = 1 - 2.6 * dt
		p.vx *= drag; p.vy = p.vy * drag + 420 * dt
		p.vy = math.min(p.vy, 110)
		p.x += (p.vx + math.sin(p.age * 5 + p.ph) * 40) * dt; p.y += p.vy * dt
		p.a += p.va * dt; p.flip += p.vf * dt
	end
	if self.cycle > 0.3 and self.cycle < 2.6 and math.random() < dt * 10 and #self.parts > 0 then
		local p = self.parts[math.random(1, #self.parts)]
		vfx.spawn(self.tw :: vfx.Layer, { x = p.x, y = p.y, size = R(22, 36), life = 0.5, vr = 2, cells = vfx.seq(at, 'twinkle', 'W0', 'G0'), add = 1, fadeIn = 0.35, fadeOut = 0.5 })
	end
	vfx.step(self.tw :: vfx.Layer, dt)
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local glow = self.glow :: vfx.Layer
	glow.parts = {}
	local t = self.cycle - 0.1
	if t >= 0 and t < 0.45 then
		local k = t / 0.45
		for _, x in { 26, 334 } do
			vfx.sprite(glow, x, 322, 120 + 180 * vfx.easeOut(k), k * 0.4, 1 - k, 1, at.map['burst:W0'])
			vfx.sprite(glow, x, 322, 200, 0, (1 - k) * 0.8, 1, at.map['sglow:G0'])
		end
	end
	vfx.draw(r, glow)
	for _, p in self.paths do p:reset() end
	for _, p in self.parts do
		local life = math.clamp(1 - (p.age - 2.4) / 0.5, 0, 1)
		if life > 0 then fx.rect(self.paths[p.col], p.x, p.y, p.w * life, p.w * 1.6 * math.abs(math.cos(p.flip)) * life + 0.5, p.a) end
	end
	for i = 1, #COLS do r:drawPath(self.paths[i], self.paints[i]) end
	vfx.draw(r, self.tw :: vfx.Layer)
end

return function(): Node<S>
	local paths: { Path } = {}
	local paints: { Paint } = {}
	for i, c in COLS do paths[i] = Path.new(); paints[i] = Paint.with({ color = Color.rgba(c[1], c[2], c[3], 255) }) end
	return { parts = {}, cycle = 0, fired = false, paths = paths, paints = paints, at = nil, glow = nil, tw = nil, init = init, advance = advance, draw = draw }
end
