-- Волшебная пыль: звёздочки вспыхивают в случайных местах (рост → вращение → гаснут), крупное мягкое боке
-- плывёт на заднем плане, редкие лучистые вспышки, золотистая дымка в центре. Спокойный фон для экрана наград.
local vfx = require('vfx')
type S = { t: number, acc: { number }, at: vfx.Atlas?, back: vfx.Layer?, bokeh: vfx.Layer?, tw: vfx.Layer?, bursts: vfx.Layer? }
local R = vfx.rand

local function init(self: S, context: Context): boolean
	local at = vfx.atlas(context, 'sparkle')
	self.at = at
	self.back, self.bokeh, self.tw, self.bursts = vfx.layer(at), vfx.layer(at), vfx.layer(at), vfx.layer(at)
	-- сразу заполняем, чтобы первый кадр не был пустым
	for _ = 1, 8 do
		vfx.spawn(self.bokeh :: vfx.Layer, { x = R(20, 340), y = R(20, 340), vx = R(-8, 8), vy = R(-18, -6), size = R(40, 90), life = R(3, 5), age = R(0, 2),
			cells = vfx.seq(at, 'bokeh', if math.random() < 0.5 then 'M2' else 'M1'), add = 1, alpha = R(0.2, 0.4), sway = 6, fadeIn = 0.3, fadeOut = 0.4 })
	end
	return true
end

local function advance(self: S, seconds: number): boolean
	local dt = math.min(seconds, 1 / 30)
	local at = self.at :: vfx.Atlas
	self.t += dt
	vfx.emit(self.acc, 1, 2, dt, function()
		vfx.spawn(self.bokeh :: vfx.Layer, { x = R(20, 340), y = R(60, 360), vx = R(-8, 8), vy = R(-18, -6), size = R(40, 90), life = R(3, 5),
			cells = vfx.seq(at, 'bokeh', if math.random() < 0.5 then 'M2' else 'M1'), add = 1, alpha = R(0.2, 0.4), sway = 6, fadeIn = 0.3, fadeOut = 0.4 })
	end)
	vfx.emit(self.acc, 2, 16, dt, function()
		local a, d = R(0, 6.28), R(0, 1) ^ 0.7 * 150
		vfx.spawn(self.tw :: vfx.Layer, { x = 180 + math.cos(a) * d, y = 180 + math.sin(a) * d, vy = R(-24, -8), size = R(18, 44), grow = 0.3, life = R(0.6, 1.0), rot = R(0, 0.8), vr = R(-2, 2),
			cells = vfx.seq(at, 'twinkle', if math.random() < 0.6 then 'W0' else 'G0'), add = 1, fadeIn = 0.4, fadeOut = 0.45 })
	end)
	vfx.emit(self.acc, 3, 0.9, dt, function()
		vfx.spawn(self.bursts :: vfx.Layer, { x = R(70, 290), y = R(70, 290), size = R(90, 130), grow = 0.4, life = 0.55, vr = 1, cells = vfx.seq(at, 'burst', 'G0'), add = 1, alpha = 0.8, fadeIn = 0.15, fadeOut = 0.7 })
	end)
	for _, l in { self.bokeh, self.tw, self.bursts } do vfx.step(l :: vfx.Layer, dt) end
	return true
end

local function draw(self: S, r: Renderer)
	local at = self.at :: vfx.Atlas
	local back = self.back :: vfx.Layer
	back.parts = {}
	vfx.sprite(back, 180, 180, 380 * (1 + 0.04 * math.sin(self.t * 1.7)), 0, 0.3, 1, at.map['sglow:G1'])
	vfx.draw(r, back)
	vfx.draw(r, self.bokeh :: vfx.Layer)
	vfx.draw(r, self.bursts :: vfx.Layer)
	vfx.draw(r, self.tw :: vfx.Layer)
end

return function(): Node<S>
	return { t = 0, acc = {}, at = nil, back = nil, bokeh = nil, tw = nil, bursts = nil, init = init, advance = advance, draw = draw }
end
