-- Портал: туннель — мягкие кольца рождаются на краю и сжимаются к центру, светлея (розовый → фиолетовый → голубой → белый),
-- это даёт глубину. Тёмное «окно» внутри с ярким ободком, руны вращаются навстречу, вихри-завитки кружат по сужающейся
-- орбите, искры затягиваются по спирали, по краю перемигиваются звёздочки.
local vfx = require('vfx')
type W = { a: number, r: number, age: number, life: number, cell: number }
type S = { t: number, acc: { number }, wisps: { W }, at: vfx.Atlas?, base: vfx.Layer?, tun: vfx.Layer?, mid: vfx.Layer?, inP: vfx.Layer?, top: vfx.Layer?, hole: Path, holePaint: Paint }
local CX, CY = 180, 180
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'portal')
	self.at = at
	self.base, self.tun, self.mid, self.inP, self.top = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.t += dt
	vfx.emit(self.acc, 1, 2.6, dt, function()
		vfx.spawn(self.tun :: vfx.Layer, { x = CX, y = CY, size = 300, grow = -0.7, life = 1.5, rot = R(0, 6.28), vr = 0.6,
			cells = vfx.seq(at, 'sring', 'M3', 'M2', 'M1'), add = 1, alpha = 0.32, fadeIn = 0.35, fadeOut = 0.3 })
	end)
	vfx.emit(self.acc, 2, 3, dt, function()
		table.insert(self.wisps, { a = R(0, 6.28), r = 150, age = 0, life = R(1.1, 1.5), cell = if math.random() < 0.5 then at.map['sswirl:M1'] else at.map['sswirl:M2'] })
	end)
	vfx.emit(self.acc, 3, 40, dt, function()
		local a = R(0, 6.28)
		vfx.spawn(self.inP :: vfx.Layer, { x = CX + math.cos(a) * 160, y = CY + math.sin(a) * 160, vx = -math.sin(a) * 240 - math.cos(a) * 40, vy = math.cos(a) * 240 - math.sin(a) * 40,
			size = R(18, 28), life = 0.9, cells = vfx.seq(at, 'spark', 'M3', 'M2', 'M1', 'M0'), add = 1, alpha = 0.9, orient = true, speedStretch = 0.0015, fadeIn = 0.2, fadeOut = 0.3 })
	end)
	-- притяжение искр к центру (ближе — сильнее); у центра исчезают
	for _, p in (self.inP :: vfx.Layer).parts do
		local dx, dy = CX - p.x, CY - p.y
		local d = math.max(math.sqrt(dx * dx + dy * dy), 8)
		local g = 48000 / d
		p.vx += dx / d * g * dt; p.vy += dy / d * g * dt
		if d < 30 then p.age = math.max(p.age, p.life * 0.75) end
	end
	-- завитки: угловая скорость растёт при сужении орбиты (как вода в воронке)
	local i = 1
	while i <= #self.wisps do
		local w = self.wisps[i]
		w.age += dt
		if w.age >= w.life then table.remove(self.wisps, i) else
			w.r = 150 * (1 - w.age / w.life) ^ 1.3 + 20
			w.a += (1.2 + 160 / w.r) * dt
			i += 1
		end
	end
	vfx.step(self.tun :: vfx.Layer, dt); vfx.step(self.inP :: vfx.Layer, dt)
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local base, mid, top = self.base :: vfx.Layer, self.mid :: vfx.Layer, self.top :: vfx.Layer
	base.parts = {}; mid.parts = {}; top.parts = {}
	local t = self.t
	local pulse = 1 + 0.05 * math.sin(t * 5)
	vfx.sprite(base, CX, CY, 440, 0, 0.45, 1, at.map['sglow:M2'])
	vfx.sprite(base, CX, CY, 330, t * 0.25, 0.5, 1, at.map['rune:M1'])
	vfx.draw(r, base)
	-- тёмное окно: глубина, на нём светлое читается ярче
	self.hole:reset()
	local hr = 104 * pulse
	self.hole:moveTo(Vector.xy(CX + hr, CY))
	for k = 1, 32 do local a = k / 32 * 6.2832; self.hole:lineTo(Vector.xy(CX + math.cos(a) * hr, CY + math.sin(a) * hr)) end
	self.hole:close()
	r:drawPath(self.hole, self.holePaint)
	vfx.draw(r, self.tun :: vfx.Layer)
	vfx.sprite(mid, CX, CY, 230, -t * 0.5, 0.35, 1, at.map['circle:M2'])
	vfx.sprite(mid, CX, CY, 250 * pulse, 0, 0.7, 1, at.map['sring:M1'])
	for _, w in self.wisps do
		local k = w.age / w.life
		local al = math.min(1, k / 0.2) * math.min(1, (1 - k) / 0.35)
		vfx.sprite(mid, CX + math.cos(w.a) * w.r, CY + math.sin(w.a) * w.r, 80 * (0.5 + 0.5 * w.r / 170), w.a + 3.6, 0.8 * al, 1, w.cell)
	end
	vfx.draw(r, mid)
	vfx.draw(r, self.inP :: vfx.Layer)
	vfx.sprite(top, CX, CY, 90 * pulse, 0, 0.35, 1, at.map['sglow:M0'])
	vfx.sprite(top, CX, CY, 60 * pulse, 0, 0.5, 1, at.map['sglow:M3'])
	for k = 0, 7 do
		local ph = (t * 0.6 + k * 0.37) % 1
		local tw = math.max(0, math.sin(ph * math.pi)) ^ 2
		local a = k * 0.785 + 0.3
		if tw > 0.02 then vfx.sprite(top, CX + math.cos(a) * (140 + k * 4), CY + math.sin(a) * (140 + k * 4), 44 * tw, t, tw, 1, at.map['twinkle:M0']) end
	end
	vfx.draw(r, top)
end

return function(): Node<S>
	return { t = 0, acc = {}, wisps = {}, at = nil, base = nil, tun = nil, mid = nil, inP = nil, top = nil, hole = Path.new(),
		holePaint = Paint.with({ color = Color.rgba(24, 12, 52, 235), feather = 28 }), init = init, advance = advance, draw = draw }
end
