-- Общие помощники для эффектов-частиц: фигуры в контур (пачкой — много фигур в одном Path),
-- плавности и цвет. Принципы (гайд LoL VFX): светлое ядро, 1–2 близких оттенка, формы «плавно + остро»,
-- фазы «нарастание → удар → затухание», движение по кривой.
local M = {}
local K = 0.5523

function M.circle(p: Path, x: number, y: number, r: number)
	p:moveTo(Vector.xy(x + r, y))
	p:cubicTo(Vector.xy(x + r, y + r * K), Vector.xy(x + r * K, y + r), Vector.xy(x, y + r))
	p:cubicTo(Vector.xy(x - r * K, y + r), Vector.xy(x - r, y + r * K), Vector.xy(x - r, y))
	p:cubicTo(Vector.xy(x - r, y - r * K), Vector.xy(x - r * K, y - r), Vector.xy(x, y - r))
	p:cubicTo(Vector.xy(x + r * K, y - r), Vector.xy(x + r, y - r * K), Vector.xy(x + r, y))
	p:close()
end

function M.ellipse(p: Path, x: number, y: number, rx: number, ry: number, rot: number)
	local c, s = math.cos(rot), math.sin(rot)
	local function pt(u: number, v: number): Vector
		return Vector.xy(x + u * c - v * s, y + u * s + v * c)
	end
	p:moveTo(pt(rx, 0))
	p:cubicTo(pt(rx, ry * K), pt(rx * K, ry), pt(0, ry))
	p:cubicTo(pt(-rx * K, ry), pt(-rx, ry * K), pt(-rx, 0))
	p:cubicTo(pt(-rx, -ry * K), pt(-rx * K, -ry), pt(0, -ry))
	p:cubicTo(pt(rx * K, -ry), pt(rx, -ry * K), pt(rx, 0))
	p:close()
end

-- четырёхлучевая звёздочка-блик: острые лучи, вогнутые бока (плавно + остро) — 8 вершин, лучи и «талии»
function M.star4(p: Path, x: number, y: number, r: number, rot: number)
	local w = r * 0.2
	for i = 0, 7 do
		local a = rot + i * math.pi / 4 - math.pi / 2
		local rr = if i % 2 == 0 then r else w
		local v = Vector.xy(x + math.cos(a) * rr, y + math.sin(a) * rr)
		if i == 0 then p:moveTo(v) else p:lineTo(v) end
	end
	p:close()
end

-- повёрнутый прямоугольник (конфетти, обломки)
function M.rect(p: Path, x: number, y: number, w: number, h: number, rot: number)
	local c, s = math.cos(rot), math.sin(rot)
	local function pt(u: number, v: number): Vector
		return Vector.xy(x + u * c - v * s, y + u * s + v * c)
	end
	p:moveTo(pt(-w, -h)); p:lineTo(pt(w, -h)); p:lineTo(pt(w, h)); p:lineTo(pt(-w, h)); p:close()
end

-- многоугольник-камешек: n вершин с разбросом радиуса (seed — чтобы форма не дрожала)
function M.rock(p: Path, x: number, y: number, r: number, rot: number, seed: number)
	local n = 6
	for i = 0, n - 1 do
		local a = rot + i * 2 * math.pi / n
		local rr = r * (0.75 + 0.25 * math.sin(seed * 7.3 + i * 2.1))
		local v = Vector.xy(x + math.cos(a) * rr, y + math.sin(a) * rr)
		if i == 0 then p:moveTo(v) else p:lineTo(v) end
	end
	p:close()
end

-- лента-шлейф по истории точек: ширина от w0 у головы до 0 у хвоста; точки краёв считаются на лету
local function edge(xs: { number }, ys: { number }, n: number, i: number, w0: number, side: number): Vector
	local j = math.min(i + 1, n)
	local k = math.max(i - 1, 1)
	local dx, dy = xs[j] - xs[k], ys[j] - ys[k]
	local l = math.max(math.sqrt(dx * dx + dy * dy), 0.0001)
	local w = w0 * (1 - (i - 1) / (n - 1) * 0.92) * side   -- хвост не сходится в точку: вырожденный контур отрисовщик отбрасывает
	return Vector.xy(xs[i] - dy / l * w, ys[i] + dx / l * w)
end

function M.ribbon(p: Path, xs: { number }, ys: { number }, n: number, w0: number)
	if n < 2 then return end
	p:moveTo(edge(xs, ys, n, 1, w0, 1))
	for i = 2, n do p:lineTo(edge(xs, ys, n, i, w0, 1)) end
	for i = n, 1, -1 do p:lineTo(edge(xs, ys, n, i, w0, -1)) end
	p:close()
end

function M.easeOut(t: number): number
	local u = 1 - math.clamp(t, 0, 1)
	return 1 - u * u * u
end

function M.easeIn(t: number): number
	local u = math.clamp(t, 0, 1)
	return u * u * u
end

function M.rand(a: number, b: number): number
	return a + math.random() * (b - a)
end

return M
