/* Горн — пакет «hits»: по референсам LoL — удары, щиты, круги действия, удар по картинке (режим 23; нужен пакет image).
   Подключается после src/app/16e-forge.js: <script src="src/forge/hits.js">. В приложение не входит — только то, что нужно игре, живёт в ядре. */
Forge.pack('hits', k => {
  const { R, PI, easeOut, spawn, step, draw, BX, BW, band, trail, arcBand, sprite, DEF, pic } = k;
  k.chunk(14,
    // 23 — чёткие формы без атласа (любой размер без мыла): .0 звезда-печать (vf.w лучей, vf.y острота, vf.z тёмное ядро) · .1 ромб-осколок (vf.y ширина) ·
    // .2 крест-вспышка (vf.y толщина, vf.z доля вертикали) · .3 кольцо (vf.y толщина) · .5 боке-круг (светлый обод) · .6 луч-столб (vf.y ширина) ·
    // .7 щит-пузырь (френель, внутри течёт энергия; волна удара: vf.z ход, vf.w угол). Цвет — vt; add частицы < 1 — тёмные места видны
    'if(vf.x>22.95&&vf.x<23.95){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);vec2 p=vq*2.-1.;float r=length(p);vec3 col=vt;float a=0.;' +
    'if(md<.5){float d;if(vf.w<4.5){float q=mix(.9,.38,vf.y);vec2 a2=abs(p)+1e-4;d=pow(pow(a2.x,q)+pow(a2.y,q),1./q);}else{float an=atan(p.y,p.x);d=r/(.35+.65*pow(abs(cos(an*vf.w*.5)),2.+vf.y*14.));}' +
    'float sh=smoothstep(1.,.95,d);float gw=exp(-max(d-1.,0.)*3.)*.5*(1.-sh)*smoothstep(1.,.7,r);float dk=smoothstep(.42,.05,r)*vf.z;col=mix(vt,vec3(1.),sh*smoothstep(.2,1.,d)*.55);col=mix(col,vt*.08,dk*sh);a=max(sh,gw);}' +
    'else if(md<1.5){float d=abs(p.x)/max(vf.y,.05)+abs(p.y);float sh=smoothstep(1.,.94,d);a=sh+exp(-max(d-1.,0.)*5.)*.3*(1.-sh);col=mix(vt,vec3(1.),sh*(1.-abs(p.x)/max(vf.y,.05))*.6);}' +
    'else if(md<2.5){float th=max(vf.y,.01);float h=exp(-p.y*p.y/(th*th))*exp(-abs(p.x)*2.2);float v=exp(-p.x*p.x/(th*th))*exp(-abs(p.y)*2.2)*vf.z;float co=exp(-r*r*14.);' +
    'a=clamp(h+v+co,0.,1.)*smoothstep(1.,.85,max(abs(p.x),abs(p.y)));col=mix(vt,vec3(1.),clamp(co*1.4+max(h,v)*.35,0.,1.));}' +
    'else if(md<3.5){float d=abs(r-.8);float w=max(vf.y,.005);float sh=smoothstep(w,w*.4,d);a=max(sh,exp(-d/w*1.2)*.45)*smoothstep(1.,.95,r);col=mix(vt,vec3(1.),sh*.5);}' +
    // .4 мультяшная колючая звезда: vf.w — лучей (целая часть) и зерно (дробная), vf.y — острота, vf.z — рваный край (сухая кисть); тёмная обводка
    'else if(md<4.5){float N=floor(vf.w);float sd=fract(vf.w)*91.;float an=atan(p.y,p.x);float id=floor(an/6.2832*N+.5);float sp=pow(abs(cos(an*N*.5)),1.+vf.y*6.);' +
    'float R0=(.38+.62*sp)*(.8-vf.z*.3+(.2+vf.z*.3)*H1(id*7.13+sd));float n=texture2D(nz,p*(1.7+vf.z*2.)+sd).r;R0+=(n-.5)*vf.z*.42;float e=R0-r;float sh=smoothstep(-.012,.012,e);' +
    'float inn=smoothstep(.045,.075,e);col=mix(vt*.32,mix(vt,vec3(1.),smoothstep(R0*.7,0.,r)*.85),inn);a=sh*smoothstep(1.,.96,r);}' +
    'else if(md<5.5){float dc=smoothstep(1.,.9,r);float rim=smoothstep(.62,.92,r)*dc;a=dc*mix(.6+rim*.4,1.,step(.5,vf.y));col=mix(vt,vec3(1.),rim*.35);}' +
    'else if(md<6.5){float w=max(vf.y,.02)*(1.-abs(p.y)*.6);float b=exp(-p.x*p.x/(w*w));a=b*smoothstep(1.,.35,abs(p.y));col=mix(vt,vec3(1.),exp(-p.x*p.x/(w*w*.12))*.8);}' +
    // .8 щит из сот: шестиугольная сетка на сфере (края светятся, соты вспыхивают), край — френель; волна удара как у пузыря
    'else if(md>7.5&&md<8.5){if(r>1.){gl_FragColor=vec4(0.);return;}float z=sqrt(1.-r*r);vec2 q=p/(1.+z)*vf.y+vec2(t*.05,0.);vec2 S=vec2(1.,1.732);' +
    'vec2 g1=mod(q,S)-S*.5;vec2 g2=mod(q-S*.5,S)-S*.5;vec2 g=dot(g1,g1)<dot(g2,g2)?g1:g2;vec2 id=q-g;vec2 ag=abs(g);float hd=max(dot(ag,vec2(.5,.866)),ag.x);float ed=.5-hd;' +
    'float eg=exp(-ed*28.);float fl=step(.82,H2(id+floor(t*2.5)))*(.5+.5*sin(t*9.+id.x*3.));float fr=pow(r,2.6);' +
    'vec2 hp=vec2(cos(vf.w),sin(vf.w))*.92;float rp=exp(-abs(length(p-hp)-vf.z*1.6)*14.)*(1.-vf.z)*step(.001,vf.z);' +
    'a=clamp(eg*(.35+.65*fr)+fl*.22+fr*.55+rp*(.6+eg)+pow(r,14.)*.5,0.,1.)*smoothstep(1.,.97,r);col=mix(vt,vec3(1.),clamp(eg*.35+rp*.6+pow(r,10.)*.6,0.,1.));}' +
    // .9 кольцо-солнце: обод с шипами наружу (vf.w — шипов, vf.y — длина шипа); vf.z > .5 — пунктир вместо шипов (vf.w штрихов, vf.y — скорость вращения)
    'else if(md>8.5){float an=atan(p.y,p.x)/6.2832+.5;float N=max(vf.w,3.);float R1=.62;float sh;' +
    'if(vf.z>.5){float ds=step(.42,fract(an*N+t*vf.y));sh=smoothstep(.035,.015,abs(r-R1))*ds;}else{float s=1.-abs(fract(an*N)-.5)*2.;float Ro=R1+.03+vf.y*.36*pow(s,2.2);' +
    'sh=smoothstep(Ro,Ro-.02,r)*smoothstep(R1-.05,R1-.03,r);}a=max(sh,exp(-abs(r-R1)*14.)*.35)*smoothstep(1.,.95,r);col=mix(vt,vec3(1.),sh*.45);}' +
    'else{if(r>1.){gl_FragColor=vec4(0.);return;}float fr=pow(r,3.2);float ca=cos(t*.6),sa=sin(t*.6);vec2 q=mat2(ca,-sa,sa,ca)*p;' +
    'float n=texture2D(nz,q*.55+vec2(t*.07,-t*.05)).r;float n2=texture2D(nz,q*.9-vec2(t*.04,t*.08)+n*.4).g;float en=pow(1.-abs(n2*2.-1.),9.)*.35;' +
    'vec2 hp=vec2(cos(vf.w),sin(vf.w))*.92;float rp=exp(-abs(length(p-hp)-vf.z*1.6)*16.)*(1.-vf.z)*step(.001,vf.z);' +
    'a=clamp(fr*.95+en*(.25+r*.5)+rp*.9+pow(r,14.)*.6,0.,1.)*smoothstep(1.,.97,r);col=mix(vt,vec3(1.),clamp(pow(r,10.)*.7+rp*.6+en*.3,0.,1.));}' +
    'a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  /* ── по референсам League of Legends (realtimevfx.com: попадания, щиты, круги действия) ──
     Попадание = взмах (шлейф по дуге) → кадр удара 2–3 кадра (самое яркое, стоп-кадр, тряска) → печать/вспышка → линии скорости и осколки → долгое
     затухание (звёздочки, угольки). Цвет — пресетом (pal: [ядро, основной, тёмный]). */
  const SHP = (md, y, z, w) => [23 + md / 10, y, z, w];
  const HITPAL = { fire: [[1, .95, .8], [1, .45, .12], [.6, .05, .02]], arcane: [[.95, .9, 1], [.6, .35, 1], [.2, .05, .45]],
    toxic: [[.95, 1, .85], [.45, 1, .3], [.05, .35, .1]], frost: [[1, 1, 1], [.45, .8, 1], [.05, .2, .45]], gold: [[1, 1, .85], [1, .78, .25], [.5, .25, .02]] };
  const hitPresets = Object.fromEntries(Object.entries(HITPAL).map(([k, v]) => [k, { s: { pal: v } }]));

  // удар с печатью (Hecarim): взмах-полумесяц → вспышка → 4-лучевая печать с тёмным ядром крутится и сжимается → линии скорости, ромбы, звёздочки
  DEF.hitsigil = { atlas: 'aura', period: 1.3, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.fire }),
    update(s, dt, at){ const P = s.pal, T = .2;
      if (!s.hit && s.cycle >= T){ s.hit = true; s.shake = 9; s.freeze = .05;
        for (let i = 0; i < 18; i++){ const a = R(0, 6.28), v = R(500, 900);   // линии скорости — тонкие лучи от центра
          spawn(s.p, { x: 180 + Math.cos(a) * 40, y: 180 + Math.sin(a) * 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(10, 16), stretch: 1, speedStretch: .012, orient: true, drag: 5,
            life: R(.25, .4), cells: [at.map['glow:W0']], add: 1, tint: P[0], fadeIn: .01, fadeOut: .5, pul: 0 }); }
        for (let i = 0; i < 9; i++){ const a = R(0, 6.28), v = R(260, 520);   // ромбы-осколки по ходу полёта
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, rot: a + PI / 2, size: R(16, 30), stretch: 2.4, drag: 3.5, grav: 300, life: R(.35, .6),
            cells: [0], mode: 23.1, ero: [[0, .38]], add: .6, tint: P[1], fadeIn: .01, fadeOut: .4, pul: 0 }); }
        for (let i = 0; i < 8; i++) spawn(s.p, { x: 180 + R(-60, 60), y: 180 + R(-30, 40), vx: R(-20, 20), vy: R(30, 90), size: R(14, 24), life: R(.6, 1), drag: 1, grav: 60,   // звёздочки оседают
          cells: [at.map['twinkle:W0']], add: 1, tint: P[0], fadeIn: .05, fadeOut: .5, pul: .3, pf: 14 });
      }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, P = s.pal, T = .2;
      if (t < T + .1){ const k = Math.min(1, t / T), h = -2.7 + 2.5 * easeOut(k); arcBand(c, 150, 230, 200, 130, -.3, h - 1.9, h, 95, t < T ? 1 : 1 - (t - T) / .1, 1, P[1], .8); }
      if (t >= T){ const k = (t - T) / .9, e = easeOut(Math.min(1, k * 5));
        if (k < .35) sprite(c, 180, 180, 260 + 260 * e, 0, (1 - k / .35) ** 2, 1, at.map['sglow:W0'], 1, P[1]);   // большой мягкий отсвет
        if (k < .08) sprite(c, 180, 180, 150, 0, 1 - k / .08, 1, at.map['glow:W0'], 1, P[0]);                       // белый кадр удара
        if (k < 1){ const sz = 230 * (1.15 - .45 * easeOut(k)) * (k < .06 ? .6 + k / .06 * .4 : 1);
          sprite(c, 180, 180, sz * 1.25, k * .9 + .4, (1 - k) * .55, 1, 0, 1, P[2], 0, SHP(0, .7, 0, 4));          // тень печати — больше и темнее
          sprite(c, 180, 180, sz, k * .9 + .4, Math.min(1, (1 - k) * 1.6), .35, 0, 1, P[1], 0, SHP(0, .75, .9, 4)); // печать с тёмным ядром
          sprite(c, 180, 180, sz * .55, -k * 1.4, (1 - k) * .9, 1, 0, 1, P[0], 0, SHP(0, .5, 0, 4)); } }
      draw(c, s.p); } };

  // крестовая вспышка (Kayle): серп по земле → крест-вспышка с отсветом → столбы света вверх → угольки всплывают
  DEF.hitflare = { atlas: 'aura', period: 1.2, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.gold }),
    update(s, dt, at){ const P = s.pal, T = .16;
      if (!s.hit && s.cycle >= T){ s.hit = true; s.shake = 6; s.freeze = .04;
        for (let i = 0; i < 5; i++) spawn(s.p, { x: 180 + R(-18, 18), y: 180, vy: -R(600, 900), size: R(14, 26), stretch: 9, life: R(.25, .45), drag: 3, cells: [0], mode: 23.6, ero: [[0, .25]],   // столбы света
          add: 1, tint: P[0], fadeIn: .02, fadeOut: .6, pul: 0, sc: [[0, .6], [.3, 1], [1, .7]] });
        for (let i = 0; i < 16; i++){ const a = -PI / 2 + R(-1.2, 1.2), v = R(80, 260);
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(6, 11), life: R(.6, 1.1), drag: 2, grav: -80, sway: 14, cells: [at.map['glow:W0']], add: 1,
            tc: [[0, P[0]], [.5, P[1]], [1, P[2]]], fadeIn: .02, fadeOut: .4, pul: .25, pf: 10 }); } }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, P = s.pal, T = .16;
      if (t < T + .1){ const k = Math.min(1, t / T); arcBand(c, 180, 200, 170, 55, 0, PI * .95 - PI * 1.1 * easeOut(k) + 1.5, PI * .95 - PI * 1.1 * easeOut(k), 46, t < T ? 1 : 1 - (t - T) / .1, 1, P[1], .6); }
      if (t >= T){ const k = (t - T) / .7;
        if (k < 1){ sprite(c, 180, 180, 360 * (1 + .4 * k), 0, (1 - k) ** 2 * .5, 1, at.map['sglow:W0'], 1, P[1]);
          sprite(c, 180, 180, 520 * (1 - .3 * k), 0, (1 - k) ** 1.5 * .9, 1, 0, 1, P[1], 0, SHP(2, .04 * (1 - k * .5), .8, 0));   // крест: длинная горизонталь, вертикаль чуть короче
          sprite(c, 180, 180, 70 * (1 - .5 * k), 0, (1 - k) ** 2, 1, at.map['glow:W0'], 1, [1, 1, 1]); } }
      draw(c, s.p); } };

  // всплеск боке (Vladimir): снаряд со шлейфом → белая вспышка → круги-боке разлетаются, тают; брызги-запятые
  DEF.hitsplash = { atlas: 'aura', period: 1.15, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.toxic }),
    update(s, dt, at){ const P = s.pal, T = .22;
      if (!s.hit && s.cycle >= T){ s.hit = true; s.shake = 4;
        for (let i = 0; i < 16; i++){ const a = R(0, 6.28), v = R(60, 260) * (i < 5 ? .4 : 1);
          spawn(s.p, { x: 180 + R(-10, 10), y: 180 + R(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, size: R(12, 40) * (i < 5 ? 1.5 : 1), life: R(.45, .8), drag: 3, grav: -20,
            cells: [0], mode: 23.5, add: .5, alpha: R(.55, .9), tint: Math.random() < .5 ? P[0] : P[1], sc: [[0, .3], [.2, 1.05], [1, .8]], fadeIn: .02, fadeOut: .45, pul: 0 }); }
        for (let i = 0; i < 6; i++){ const a = R(0, 6.28), v = R(250, 420);   // брызги: короткие ленты-запятые
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4, grav: 400, trail: 6, size: R(7, 11), life: R(.3, .5), cells: [at.map['glow:W0']], add: .8, tint: P[1], fadeIn: .01, fadeOut: .5, pul: 0 }); }
        for (let i = 0; i < 10; i++){ const a = R(0, 6.28), v = R(200, 500);
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(6, 10), speedStretch: .01, orient: true, drag: 5, life: R(.2, .35), cells: [at.map['glow:W0']], add: 1, tint: P[0], fadeIn: .01, fadeOut: .5, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, P = s.pal, T = .22;
      if (t < T){ const k = t / T, x = -30 + 210 * k * k;   // снаряд: голова и шлейф по прямой
        for (let i = 0; i < 8; i++){ BX[i * 2] = x - (7 - i) * 22 * Math.min(1, k * 3); BX[i * 2 + 1] = 180 + Math.sin(i * .9 + t * 30) * 3; BW[i] = 8 + 26 * i / 7; }
        band(c, BX, BW, 8, 1, 1, P[1], .8, 1); sprite(c, x, 180, 70, 0, 1, 1, at.map['glow:W0'], 1, P[0]); }
      else { const k = (t - T) / .35; if (k < 1){ sprite(c, 180, 180, 240 * (.6 + .6 * easeOut(k)), 0, (1 - k) ** 2, 1, at.map['sglow:W0'], 1, P[0]); sprite(c, 180, 180, 120, 0, (1 - k) ** 3, 1, at.map['glow:W0'], 1, [1, 1, 1]); } }
      draw(c, s.p); } };

  // щит (Rakan): пузырь появляется с перелётом, край светится (френель), внутри течёт энергия, удары — волна по поверхности
  // в точке удара; в конце сжимается и гаснет. Зацикленный: hits — сам бьёт раз в 0.7–1.3 с (витрина), Forge…set('hitAt', угол) — удар снаружи
  DEF.shield = { atlas: 'aura', presets: { fire: { s: { tint: [1, .55, .25] } }, arcane: { s: { tint: [.65, .45, 1] } }, frost: { s: { tint: [.45, .85, 1] } }, toxic: { s: { tint: [.45, 1, .4] } } },
    init: s => Object.assign(s, { tint: [1, .55, .3], rp: [], next: .8 }),
    update(s, dt){ s.next -= dt; if (s.hitAt != null || (s.o.hits !== false && s.next <= 0)){ s.rp.push({ a: s.hitAt ?? R(0, 6.28), t: 0 }); s.hitAt = null; s.next = R(.7, 1.3); s.shake = 3; }
      for (const r of s.rp) r.t += dt * 1.6; s.rp = s.rp.filter(r => r.t < 1); },
    render(s, c){ const t = s.t, pop = t < .45 ? 1 + .18 * Math.sin(Math.min(1, t / .45) * PI) * (1 - t / .45) : 1, sz = 300 * Math.min(1, easeOut(t / .25)) * pop;
      const r = s.rp[0]; sprite(c, 180, 180, sz, 0, Math.min(1, t / .15), .85, 0, 1, s.tint, 0, SHP(7, 0, r ? r.t : 0, r ? r.a : 0));
      for (let i = 1; i < s.rp.length; i++) sprite(c, 180, 180, sz, 0, .5, 1, 0, 1, s.tint, 0, SHP(7, 0, s.rp[i].t, s.rp[i].a)); } };

  // круг действия (AOE): по земле (сплюснутый) — рамка наполняется по кругу за wind с, внутри крутятся лучи-руны, в конце — удар по всей площади
  DEF.aoe = { atlas: 'aura', period: 1.9, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.arcane }),
    update(s, dt, at){ const P = s.pal, W = 1.2;
      if (!s.hit && s.cycle >= W){ s.hit = true; s.shake = 7;
        for (let i = 0; i < 28; i++){ const a = R(0, 6.28), r = R(20, 150);
          spawn(s.p, { x: 180 + Math.cos(a) * r, y: 200 + Math.sin(a) * r * .38, vy: -R(250, 520), size: R(8, 14), stretch: 4, life: R(.3, .55), drag: 2.5, cells: [0], mode: 23.6, ero: [[0, .3]], add: 1, tint: P[0], fadeIn: .02, fadeOut: .5, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, P = s.pal, W = 1.2;
      if (t < W){ const k = t / W, on = Math.min(1, t / .15);
        sprite(c, 180, 200, 320, 0, .55 * on, 1, 0, .38, P[1], 0, SHP(3, .025, 0, 0));                                   // рамка
        arcBand(c, 180, 200, 128, 49, 0, -PI / 2, -PI / 2 + 6.28 * k, 14, .9 * on, 1, P[0], .8);                          // наполнение по кругу
        sprite(c, 180, 200, 300 * k, 0, .25 * on, 1, at.map['sglow:W0'], .38, P[1]);                                       // заливка растёт
        for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + t * 1.6; sprite(c, 180 + Math.cos(a) * 95, 200 + Math.sin(a) * 36, 26, 0, .8 * on, 1, 0, 1, P[0], 0, SHP(0, .6, 0, 4)); } }
      else { const k = (t - W) / .7; if (k < 1){ sprite(c, 180, 200, 330 + 120 * easeOut(k), 0, (1 - k) ** 2, 1, at.map['sglow:W0'], .38, P[1]);
        sprite(c, 180, 200, 300 + 160 * easeOut(k), 0, (1 - k) * .9, 1, 0, .38, P[0], 0, SHP(3, .04 * (1 - k), 0, 0)); sprite(c, 180, 190, 200, 0, (1 - k) ** 3, 1, 0, 1, P[0], 0, SHP(2, .06, .5, 0)); } }
      draw(c, s.p); } };

  // удар по картинке (кадр удара из аниме и LoL): белая вспышка → 3 кадра силуэта (заливка тёмным) со стоп-кадром и тряской → картинка вздрагивает,
  // вокруг светится контур и гаснет. Для выигрыша/попадания по NFT
  DEF.hitimg = { atlas: 'aura', img: true, period: 1, presets: hitPresets,
    init: s => Object.assign(s, { pal: HITPAL.fire, hit: false }),
    update(s){ if (!s.hit && s.cycle > .05){ s.hit = true; s.shake = 10; s.freeze = .06; } },
    render(s, c){ const t = s.cycle, P = s.pal, W = s.W, H = s.H, sq = t < .3 ? 1 + .08 * Math.sin(t / .3 * PI * 2) * (1 - t / .3) : 1;
      if (t >= .05 && t < .45){ const k = (t - .05) / .4; sprite(c, 180, 180, Math.max(W, H) * (1.9 + .6 * easeOut(k)), 0, (1 - k) ** 1.5, 1, c.at.map['sglow:W0'], 1, P[1]); sprite(c, 180, 180, Math.max(W, H) * 1.2, 0, (1 - k) ** 2, 1, c.at.map['glow:W0'], 1, P[0]); }   // отсвет — под картинкой
      if (t < .05) pic(c, 180, 180, W, H, [24.2, t / .05, 0, 0], .02);
      else if (t < .14) pic(c, 180, 180, W * 1.06, H * 1.06, [24, 1, 0, 0], .02, 1, 0, P[2].map(v => v * .3));   // кадр удара: тёмный силуэт на ярком
      else { const k = (t - .14) / .86; pic(c, 180, 180, W * sq, H / sq, [24.1, 1 - k * .4, (1 - k) * 2.2, 0], .1, 1, 0, P[1]); } } };

  // приёмы картинки витриной: контур, сдвиг цвета, сгорание, голограмма
  DEF.outline = { atlas: 'aura', img: true, presets: { gold: { s: { tint: [1, .8, .3] } }, ice: { s: { tint: [.45, .85, 1] } }, toxic: { s: { tint: [.45, 1, .4] } } },
    init: s => { s.tint = [.4, .85, 1]; }, update(){},
    render(s, c){ pic(c, 180, 180, s.W, s.H, [24.1, 1 + .2 * Math.sin(s.t * 3), 1.6, 0], .1, 1, 0, s.tint); } };
  DEF.hue = { atlas: 'aura', img: true, init(){}, update(){}, render(s, c){ pic(c, 180, 180, s.W, s.H, [24.3, s.t * .25 % 1, 0, 0]); } };
  DEF.burn = { atlas: 'aura', img: true, period: 1.6, presets: { ember: {}, arcane: { s: { tint: [.7, .4, 1] } }, toxic: { s: { tint: [.5, 1, .3] } } },
    init: s => { s.tint = [1, .55, .15]; }, update(){},
    render(s, c){ const k = Math.min(1, s.cycle / 1.5); pic(c, 180, 180, s.W, s.H, [24.4, 0, s.o.dir === 'in' ? 1 - k : k, 0], 0, 1, 0, s.tint); } };
  DEF.holo = { atlas: 'aura', img: true, presets: { soft: { power: .5 }, strong: { power: 1 } },
    init(){}, update(){}, render(s, c){ pic(c, 180, 180, s.W, s.H, [24.5, s.o.power ?? .8, 0, 0]); } };

  Object.assign(k, { SHP, HITPAL, hitPresets });
});
