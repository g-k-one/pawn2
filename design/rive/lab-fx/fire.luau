-- Огонь частицами: каждую секунду ~300 новых частиц у основания, они всплывают (подъёмная сила),
-- их сносит «ветер» (сумма синусов), они уменьшаются и остывают: белый → жёлтый → оранжевый → красный → дым.
-- Мультяшный вид: каждая частица — 4 вложенных круга (красный, оранжевый, жёлтый, белое ядро); круги одного
-- цвета у всех частиц — в одном контуре, непрозрачные, почти без пера: пятна сливаются в языки с чистыми полосами.
type P = { x: number, y: number, vx: number, vy: number, age: number, life: number, size: number, ph: number }
type Fire = {
	parts: { P },
	embers: { P },
	t: number,
	acc: number,
	accE: number,
	paths: { Path },
	paints: { Paint },
	emberPath: Path,
	emberPaint: Paint,
	glowPath: Path,
	glowPaint: Paint,
}

local N = 4
local K = 0.5523
local BASE_Y = 300
local COLORS = { -- снаружи внутрь
	Color.rgba(222, 52, 28, 255),
	Color.rgba(255, 128, 26, 255),
	Color.rgba(255, 206, 54, 255),
	Color.rgba(255, 246, 196, 255),
}
local SCALE = { 1, 0.78, 0.55, 0.3 } -- доля радиуса слоя
local UNTIL = { 1, 0.8, 0.55, 0.3 } -- до какого возраста частицы слой виден

local function circle(p: Path, x: number, y: number, r: number)
	p:moveTo(Vector.xy(x + r, y))
	p:cubicTo(Vector.xy(x + r, y + r * K), Vector.xy(x + r * K, y + r), Vector.xy(x, y + r))
	p:cubicTo(Vector.xy(x - r * K, y + r), Vector.xy(x - r, y + r * K), Vector.xy(x - r, y))
	p:cubicTo(Vector.xy(x - r, y - r * K), Vector.xy(x - r * K, y - r), Vector.xy(x, y - r))
	p:cubicTo(Vector.xy(x + r * K, y - r), Vector.xy(x + r, y - r * K), Vector.xy(x + r, y))
	p:close()
end

local function wind(x: number, y: number, t: number): number
	return math.sin(y * 0.035 + t * 3.1) * 22 + math.sin(y * 0.08 - t * 5.3 + x * 0.02) * 12
end

local function spawn(self: Fire)
	-- основание — овал шириной ~110 px, гуще к центру
	local u = (math.random() + math.random() + math.random()) / 3 - 0.5
	table.insert(self.parts, {
		x = 180 + u * 110,
		y = BASE_Y + (math.random() - 0.5) * 10,
		vx = (math.random() - 0.5) * 20,
		vy = -90 - math.random() * 90,
		age = 0,
		life = 0.7 + math.random() * 0.6 - math.abs(u) * 0.6,
		size = 30 + math.random() * 14 - math.abs(u) * 22,
		ph = math.random() * 6.28,
	})
end

local function spawnEmber(self: Fire)
	table.insert(self.embers, {
		x = 180 + (math.random() - 0.5) * 80,
		y = BASE_Y - 30,
		vx = (math.random() - 0.5) * 40,
		vy = -90 - math.random() * 90,
		age = 0,
		life = 1.2 + math.random() * 1.4,
		size = 1.4 + math.random() * 1.6,
		ph = math.random() * 6.28,
	})
end

local function init(self: Fire, context: Context): boolean
	for _ = 1, 160 do
		spawn(self)
		local p = self.parts[#self.parts]
		p.age = math.random() * p.life
	end
	return true
end

local function advance(self: Fire, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	self.t += dt
	self.acc += dt * 200
	while self.acc >= 1 do
		self.acc -= 1
		spawn(self)
	end
	self.accE += dt * 9
	while self.accE >= 1 do
		self.accE -= 1
		spawnEmber(self)
	end
	local t = self.t
	local i = 1
	while i <= #self.parts do
		local p = self.parts[i]
		p.age += dt
		if p.age >= p.life then
			self.parts[i] = self.parts[#self.parts]
			table.remove(self.parts)
		else
			local k = p.age / p.life
			p.vy -= 330 * dt -- подъёмная сила
			p.vx += (wind(p.x, p.y, t) - p.vx) * 2.2 * dt -- ветер с запаздыванием
			p.vx += (180 - p.x) * 1.8 * dt * (1 - k) -- язык стягивается к оси, верх свободнее
			p.x += p.vx * dt
			p.y += p.vy * dt
			i += 1
		end
	end
	i = 1
	while i <= #self.embers do
		local e = self.embers[i]
		e.age += dt
		if e.age >= e.life then
			self.embers[i] = self.embers[#self.embers]
			table.remove(self.embers)
		else
			e.vy += 30 * dt
			e.vx += math.sin(t * 4 + e.ph) * 60 * dt
			e.x += e.vx * dt
			e.y += e.vy * dt
			i += 1
		end
	end
	return true
end

local function draw(self: Fire, renderer: Renderer)
	-- свечение под огнём «дышит»
	local g = 1 + math.sin(self.t * 9) * 0.05 + math.sin(self.t * 23) * 0.03
	self.glowPath:reset()
	circle(self.glowPath, 180, BASE_Y - 40, 120 * g)
	renderer:drawPath(self.glowPath, self.glowPaint)
	for b = 1, N do
		self.paths[b]:reset()
	end
	for _, p in self.parts do
		local k = p.age / p.life
		local r = p.size * (1 - k) ^ 0.7 + 1
		for b = 1, N do
			if k < UNTIL[b] then
				circle(self.paths[b], p.x, p.y + r * (1 - SCALE[b]) * 0.35, r * SCALE[b] * (1 - k / UNTIL[b] * 0.4))
			end
		end
	end
	for b = 1, N do
		renderer:drawPath(self.paths[b], self.paints[b])
	end
	self.emberPath:reset()
	for _, e in self.embers do
		local k = e.age / e.life
		if math.sin(e.age * 30 + e.ph) > -0.6 then
			circle(self.emberPath, e.x, e.y, e.size * (1 - k))
		end
	end
	renderer:drawPath(self.emberPath, self.emberPaint)
end

return function(): Node<Fire>
	local paths: { Path } = {}
	local paints: { Paint } = {}
	for b = 1, N do
		paths[b] = Path.new()
		paints[b] = Paint.with({ color = COLORS[b], feather = if b == 1 then 3 else 5 })
	end
	return {
		parts = {},
		embers = {},
		t = 0,
		acc = 0,
		accE = 0,
		paths = paths,
		paints = paints,
		emberPath = Path.new(),
		emberPaint = Paint.with({ color = Color.rgba(255, 200, 90, 255), blendMode = 'screen', feather = 1.5 }),
		glowPath = Path.new(),
		glowPaint = Paint.with({ color = Color.rgba(255, 110, 30, 70), blendMode = 'screen', feather = 70 }),
		init = init,
		advance = advance,
		draw = draw,
	}
end
