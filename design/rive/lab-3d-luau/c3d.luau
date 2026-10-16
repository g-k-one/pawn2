-- 3D Цезарь (Luau): сетка и запечённые матрицы костей — из c3d.bin (bake.mjs), текстура — tex.webp.
-- Каждый кадр: вершины смешиваются по 4 костям (матрицы между кадрами анимации — линейно),
-- поворот на 3/4 с покачиванием, перспектива, сортировка треугольников от дальних к ближним
-- подсчётом по корзинам, одна сетка с текстурой.
type C3 = {
	nV: number, nT: number, nJ: number, nF: number, fL: number, fS: number,
	cx: number, cy: number, cz: number, h: number,
	px: { number }, py: { number }, pz: { number }, ji: { number }, wi: { number }, idx: { number },
	mats: buffer, matOff: number, cur: { number },
	sx: { number }, sy: { number }, sz: { number },
	keys: { number }, counts: { number }, order: { number },
	verts: VertexBuffer, uvs: VertexBuffer, tris: TriangleBuffer,
	image: Image?, sampler: ImageSampler, t: number, ok: boolean,
}

local W, H = 360, 360
local BUCKETS = 512
local FPS = 30

local function init(self: C3, context: Context): boolean
	self.image = context:image('tex')
	local blob = context:blob('c3d')
	if not blob then
		print('c3d: blob not found')
		return true
	end
	local d = blob.data
	local o = 4
	local function u32(): number
		local v = buffer.readu32(d, o)
		o += 4
		return v
	end
	local function f32(): number
		local v = buffer.readf32(d, o)
		o += 4
		return v
	end
	self.nV = u32(); self.nT = u32(); self.nJ = u32(); self.nF = u32(); self.fL = u32(); self.fS = u32()
	self.cx = f32(); self.cy = f32(); self.cz = f32(); self.h = f32()
	local nV, nT = self.nV, self.nT
	for i = 1, nV do
		self.px[i] = f32(); self.py[i] = f32(); self.pz[i] = f32()
	end
	for _ = 1, nV do
		local u = f32()
		local v = f32()
		self.uvs:add(Vector.xy(u, v))
	end
	for i = 1, nT * 3 do
		self.idx[i] = buffer.readu16(d, o) + 1
		o += 2
	end
	if o % 4 ~= 0 then
		o += 2
	end
	for i = 1, nV * 4 do
		self.ji[i] = buffer.readu8(d, o)
		o += 1
	end
	for i = 1, nV * 4 do
		self.wi[i] = buffer.readu8(d, o) / 255
		o += 1
	end
	self.mats = d
	self.matOff = o
	for i = 1, nV do
		self.sx[i] = 0; self.sy[i] = 0; self.sz[i] = 0
	end
	for i = 1, self.nJ * 12 do
		self.cur[i] = 0
	end
	for i = 1, nT do
		self.keys[i] = 0; self.order[i] = 0
	end
	for i = 1, BUCKETS + 1 do
		self.counts[i] = 0
	end
	self.ok = true
	return true
end

-- матрицы костей для момента t: хохот, потом удар, по кругу; между кадрами — линейно
local function pose(self: C3, t: number)
	local total = self.nF / FPS
	local ft = (t % total) * FPS
	local f0 = math.floor(ft)
	local u = ft - f0
	local f1 = f0 + 1
	if f0 == self.fL - 1 or f1 >= self.nF then
		f1 = f0 -- на стыке клипов и в конце — без смешивания
	end
	local d, base, n = self.mats, self.matOff, self.nJ * 12
	local a0, a1 = base + f0 * n * 4, base + f1 * n * 4
	local cur = self.cur
	for k = 0, n - 1 do
		local v0 = buffer.readf32(d, a0 + k * 4)
		cur[k + 1] = v0 + (buffer.readf32(d, a1 + k * 4) - v0) * u
	end
end

local function advance(self: C3, seconds: number): boolean
	if not self.ok then
		return true
	end
	self.t += math.min(seconds, 0.05)
	pose(self, self.t)
	local yaw = -0.35 + 0.25 * math.sin(self.t * 0.6)
	local c, s = math.cos(yaw), math.sin(yaw)
	local scale = H * 0.86 / self.h
	local dist = self.h * 3.2
	local ox, oy = W / 2, H * 0.52
	local cx, cy, cz = self.cx, self.cy, self.cz
	local px, py, pz, ji, wi, M = self.px, self.py, self.pz, self.ji, self.wi, self.cur
	local sx, sy, sz = self.sx, self.sy, self.sz
	local zMin, zMax = math.huge, -math.huge
	local verts = self.verts
	verts:reset()
	for i = 1, self.nV do
		local x, y, z = px[i], py[i], pz[i]
		local X, Y, Z = 0, 0, 0
		local b = (i - 1) * 4
		for k = 1, 4 do
			local w = wi[b + k]
			if w > 0 then
				local m = ji[b + k] * 12
				X += w * (M[m + 1] * x + M[m + 4] * y + M[m + 7] * z + M[m + 10])
				Y += w * (M[m + 2] * x + M[m + 5] * y + M[m + 8] * z + M[m + 11])
				Z += w * (M[m + 3] * x + M[m + 6] * y + M[m + 9] * z + M[m + 12])
			end
		end
		X -= cx; Y -= cy; Z -= cz
		local rx, rz = X * c + Z * s, -X * s + Z * c
		local f = dist / (dist - rz)
		local SX, SY = ox + rx * scale * f, oy - Y * scale * f
		sx[i] = SX; sy[i] = SY; sz[i] = rz
		if rz < zMin then zMin = rz end
		if rz > zMax then zMax = rz end
		verts:add(Vector.xy(SX, SY))
	end
	-- сортировка подсчётом: дальние треугольники — первыми
	local idx, keys, counts, order = self.idx, self.keys, self.counts, self.order
	local range = math.max(zMax - zMin, 0.0001)
	local kb = (BUCKETS - 1) / range
	for b2 = 1, BUCKETS + 1 do
		counts[b2] = 0
	end
	local nT = self.nT
	for t = 1, nT do
		local q = (t - 1) * 3
		local z = (sz[idx[q + 1]] + sz[idx[q + 2]] + sz[idx[q + 3]]) / 3
		local key = math.floor((z - zMin) * kb) + 1
		keys[t] = key
		counts[key + 1] += 1
	end
	for b2 = 1, BUCKETS do
		counts[b2 + 1] += counts[b2]
	end
	for t = 1, nT do
		local key = keys[t]
		counts[key] += 1
		order[counts[key]] = t
	end
	local tris = self.tris
	tris:reset()
	for o2 = 1, nT do
		local q = (order[o2] - 1) * 3
		tris:add(idx[q + 1] - 1, idx[q + 2] - 1, idx[q + 3] - 1)
	end
	return true
end

local function draw(self: C3, renderer: Renderer)
	local image = self.image
	if image and self.ok then
		renderer:drawImageMesh(image, self.sampler, self.verts, self.uvs, self.tris, 'srcOver', 1)
	end
end

return function(): Node<C3>
	return {
		nV = 0, nT = 0, nJ = 0, nF = 0, fL = 0, fS = 0,
		cx = 0, cy = 0, cz = 0, h = 1,
		px = {}, py = {}, pz = {}, ji = {}, wi = {}, idx = {},
		mats = buffer.create(0), matOff = 0, cur = {},
		sx = {}, sy = {}, sz = {},
		keys = {}, counts = {}, order = {},
		verts = VertexBuffer(), uvs = VertexBuffer(), tris = TriangleBuffer(),
		image = nil, sampler = ImageSampler('clamp', 'clamp', 'bilinear'), t = 0, ok = false,
		init = init,
		advance = advance,
		draw = draw,
	}
end
