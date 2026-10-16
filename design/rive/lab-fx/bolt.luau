-- Молния скриптом: каждые ~1.6 с удар сверху в землю. Ломаная строится заново каждые 2 кадра
-- (смещение середин), с ветками; три обводки — широкое мягкое свечение, голубой слой, белое ядро.
-- В точке удара — искры по баллистике (короткие штрихи вдоль скорости) и кольцо по земле.
type S = { x: number, y: number, vx: number, vy: number, age: number, life: number }
type Bolt = {
	t: number,
	strikeT: number,
	flick: number,
	tx: number,
	pts: { Vector },
	branches: { { Vector } },
	sparks: { S },
	path: Path,
	brPath: Path,
	sparkPath: Path,
	ringPath: Path,
	outer: Paint,
	mid: Paint,
	core: Paint,
	brOuter: Paint,
	brCore: Paint,
	sparkPaint: Paint,
	ringPaint: Paint,
	glowPaint: Paint,
	glowPath: Path,
}

local GROUND = 318
local PERIOD = 1.6
local K = 0.5523

local function jag(out: { Vector }, x0: number, y0: number, x1: number, y1: number, off: number)
	if off < 4 then
		table.insert(out, Vector.xy(x1, y1))
		return
	end
	local dx, dy = x1 - x0, y1 - y0
	local l = math.max(1, math.sqrt(dx * dx + dy * dy))
	local s = (math.random() - 0.5) * off
	local mx, my = (x0 + x1) / 2 - dy / l * s, (y0 + y1) / 2 + dx / l * s
	jag(out, x0, y0, mx, my, off / 2)
	jag(out, mx, my, x1, y1, off / 2)
end

local function rebuild(self: Bolt)
	self.pts = { Vector.xy(180 + (math.random() - 0.5) * 16, 0) }
	jag(self.pts, self.pts[1].x, 0, self.tx, GROUND, 150)
	self.branches = {}
	for _ = 1, 3 do
		local p = self.pts[math.random(6, math.max(7, #self.pts - 10))]
		local a = math.pi / 2 + (math.random() - 0.5) * 2.2
		local l = 40 + math.random() * 70
		local b = { p }
		jag(b, p.x, p.y, p.x + math.cos(a) * l, p.y + math.sin(a) * l, l * 0.5)
		table.insert(self.branches, b)
	end
end

local function strike(self: Bolt)
	self.tx = 180 + (math.random() - 0.5) * 70
	rebuild(self)
	for _ = 1, 70 do
		local a = -math.pi / 2 + (math.random() - 0.5) * 2.8
		local sp = 120 + math.random() ^ 1.5 * 520
		table.insert(self.sparks, { x = self.tx, y = GROUND, vx = math.cos(a) * sp, vy = math.sin(a) * sp, age = 0, life = 0.25 + math.random() * 0.5 })
	end
end

local function line(p: Path, pts: { Vector })
	p:moveTo(pts[1])
	for i = 2, #pts do
		p:lineTo(pts[i])
	end
end

local function oval(p: Path, x: number, y: number, rx: number, ry: number)
	p:moveTo(Vector.xy(x + rx, y))
	p:cubicTo(Vector.xy(x + rx, y + ry * K), Vector.xy(x + rx * K, y + ry), Vector.xy(x, y + ry))
	p:cubicTo(Vector.xy(x - rx * K, y + ry), Vector.xy(x - rx, y + ry * K), Vector.xy(x - rx, y))
	p:cubicTo(Vector.xy(x - rx, y - ry * K), Vector.xy(x - rx * K, y - ry), Vector.xy(x, y - ry))
	p:cubicTo(Vector.xy(x + rx * K, y - ry), Vector.xy(x + rx, y - ry * K), Vector.xy(x + rx, y))
	p:close()
end

local function advance(self: Bolt, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	self.strikeT += dt
	if self.strikeT >= PERIOD then
		self.strikeT = 0
		strike(self)
	end
	-- пока молния видна — новая форма каждые 2 кадра
	self.flick += dt
	if self.strikeT < 0.45 and self.flick >= 2 / 60 then
		self.flick = 0
		rebuild(self)
	end
	local i = 1
	while i <= #self.sparks do
		local s = self.sparks[i]
		s.age += dt
		if s.age >= s.life then
			self.sparks[i] = self.sparks[#self.sparks]
			table.remove(self.sparks)
		else
			s.vy += 900 * dt
			s.vx *= 1 - 1.5 * dt
			s.x += s.vx * dt
			s.y += s.vy * dt
			if s.y > GROUND + 6 then
				s.y = GROUND + 6
				s.vy = -s.vy * 0.3
			end
			i += 1
		end
	end
	return true
end

local function draw(self: Bolt, renderer: Renderer)
	local st = self.strikeT
	-- видимость: удар, короткий провал, повтор, затухание
	local on = st < 0.12 or (st > 0.17 and st < 0.32) or (st > 0.36 and st < 0.45 and math.random() > 0.3)
	if on and #self.pts > 1 then
		-- прорисовка сверху вниз за первые 3 кадра
		local n = math.max(2, math.floor(#self.pts * math.min(1, st / 0.05)))
		local shown: { Vector } = table.move(self.pts, 1, n, 1, {})
		self.path:reset()
		line(self.path, shown)
		renderer:drawPath(self.path, self.outer)
		renderer:drawPath(self.path, self.mid)
		renderer:drawPath(self.path, self.core)
		if n == #self.pts then
			self.brPath:reset()
			for _, b in self.branches do
				line(self.brPath, b)
			end
			renderer:drawPath(self.brPath, self.brOuter)
			renderer:drawPath(self.brPath, self.brCore)
		end
	end
	-- свечение и кольцо в точке удара
	if st < 0.6 then
		local k = st / 0.6
		self.glowPath:reset()
		oval(self.glowPath, self.tx, GROUND, 120 * (0.6 + k), 34 * (0.6 + k))
		self.glowPaint.color = Color.rgba(150, 210, 255, math.floor(200 * (1 - k)))
		renderer:drawPath(self.glowPath, self.glowPaint)
		self.ringPath:reset()
		oval(self.ringPath, self.tx, GROUND + 4, 20 + 150 * k, 6 + 40 * k)
		self.ringPaint.color = Color.rgba(170, 225, 255, math.floor(230 * (1 - k)))
		renderer:drawPath(self.ringPath, self.ringPaint)
	end
	self.sparkPath:reset()
	for _, s in self.sparks do
		local k = 1 - s.age / s.life
		local len = 0.03 * k
		self.sparkPath:moveTo(Vector.xy(s.x, s.y))
		self.sparkPath:lineTo(Vector.xy(s.x - s.vx * len, s.y - s.vy * len))
	end
	renderer:drawPath(self.sparkPath, self.sparkPaint)
end

local function init(self: Bolt, context: Context): boolean
	self.strikeT = PERIOD - 0.3
	self.tx = 180
	rebuild(self)
	return true
end

return function(): Node<Bolt>
	return {
		t = 0,
		strikeT = 0,
		flick = 0,
		tx = 180,
		pts = {},
		branches = {},
		sparks = {},
		path = Path.new(),
		brPath = Path.new(),
		sparkPath = Path.new(),
		ringPath = Path.new(),
		glowPath = Path.new(),
		outer = Paint.with({ style = 'stroke', thickness = 26, color = Color.rgba(61, 123, 255, 150), blendMode = 'screen', feather = 18, cap = 'round', join = 'round' }),
		mid = Paint.with({ style = 'stroke', thickness = 9, color = Color.rgba(168, 220, 255, 255), blendMode = 'screen', feather = 3, cap = 'round', join = 'round' }),
		core = Paint.with({ style = 'stroke', thickness = 3, color = Color.rgba(255, 255, 255, 255), cap = 'round', join = 'round' }),
		brOuter = Paint.with({ style = 'stroke', thickness = 12, color = Color.rgba(61, 123, 255, 120), blendMode = 'screen', feather = 9, cap = 'round', join = 'round' }),
		brCore = Paint.with({ style = 'stroke', thickness = 1.6, color = Color.rgba(220, 240, 255, 255), cap = 'round', join = 'round' }),
		sparkPaint = Paint.with({ style = 'stroke', thickness = 2.2, color = Color.rgba(140, 210, 255, 255), blendMode = 'screen', feather = 1.5, cap = 'round' }),
		ringPaint = Paint.with({ style = 'stroke', thickness = 5, color = Color.rgba(170, 225, 255, 230), blendMode = 'screen', feather = 4 }),
		glowPaint = Paint.with({ color = Color.rgba(150, 210, 255, 200), blendMode = 'screen', feather = 30 }),
		init = init,
		advance = advance,
		draw = draw,
	}
end
