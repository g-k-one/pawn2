-- Конфетти победы: две хлопушки снизу по углам. Бумажка кувыркается (высота = cos угла), порхает (снос по синусу),
-- сильное сопротивление воздуха — быстрый вылет, медленное падение. 5 цветов — 5 контуров на кадр.
local fx = require('fxlib')
type P = { x: number, y: number, vx: number, vy: number, a: number, va: number, flip: number, vf: number, ph: number, col: number, w: number, age: number }
type S = { parts: { P }, cycle: number, fired: boolean, paths: { Path }, paints: { Paint }, pFlash: Path, cFlash: Paint }
local PERIOD = 3.2
local COLS = { { 255, 79, 216 }, { 255, 210, 63 }, { 79, 214, 255 }, { 120, 255, 140 }, { 255, 120, 60 } }

local function cannon(self: S, x: number, dir: number)
	for _ = 1, 70 do
		local a = -math.pi / 2 + dir * fx.rand(0.25, 0.75)
		local sp = fx.rand(420, 900)
		table.insert(self.parts, { x = x, y = 330, vx = math.cos(a) * sp, vy = math.sin(a) * sp, a = fx.rand(0, 6.28), va = fx.rand(-6, 6),
			flip = fx.rand(0, 6.28), vf = fx.rand(6, 14), ph = fx.rand(0, 6.28), col = math.random(1, #COLS), w = fx.rand(3.5, 6), age = 0 })
	end
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.cycle += dt
	if self.cycle >= PERIOD then self.cycle = 0; self.fired = false; self.parts = {} end
	if not self.fired and self.cycle > 0.1 then self.fired = true; cannon(self, 20, 1); cannon(self, 340, -1) end
	for _, p in self.parts do
		p.age += dt
		local drag = 1 - 2.6 * dt
		p.vx *= drag; p.vy = p.vy * drag + 420 * dt
		p.vy = math.min(p.vy, 110)                                         -- предельная скорость падения: бумажка порхает
		p.x += (p.vx + math.sin(p.age * 5 + p.ph) * 40) * dt; p.y += p.vy * dt
		p.a += p.va * dt; p.flip += p.vf * dt
	end
	return true
end

local function draw(self: S, r: Renderer)
	local c = self.cycle
	if c < 0.35 then
		self.pFlash:reset(); fx.circle(self.pFlash, 30, 320, 40 * fx.easeOut(c / 0.35)); fx.circle(self.pFlash, 330, 320, 40 * fx.easeOut(c / 0.35))
		self.cFlash.color = Color.rgba(255, 240, 200, math.floor(220 * (1 - c / 0.35))); r:drawPath(self.pFlash, self.cFlash)
	end
	for _, p in self.paths do p:reset() end
	for _, p in self.parts do
		local life = math.clamp(1 - (p.age - 2.4) / 0.5, 0, 1)
		if life > 0 then fx.rect(self.paths[p.col], p.x, p.y, p.w * life, p.w * 1.7 * math.abs(math.cos(p.flip)) * life + 0.5, p.a) end
	end
	for i = 1, #COLS do r:drawPath(self.paths[i], self.paints[i]) end
end

return function(): Node<S>
	local paths: { Path } = {}
	local paints: { Paint } = {}
	for i, c in COLS do paths[i] = Path.new(); paints[i] = Paint.with({ color = Color.rgba(c[1], c[2], c[3], 255) }) end
	return { parts = {}, cycle = 0, fired = false, paths = paths, paints = paints, pFlash = Path.new(),
		cFlash = Paint.with({ color = Color.rgba(255, 240, 200, 220), blendMode = 'screen', feather = 18 }), advance = advance, draw = draw }
end
