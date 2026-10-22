/* Горн — пакет «matter»: объёмные частицы-предметы, нарисованные формулой (без картинок): перо, монета, лепесток, уголёк, самоцвет, сердце, пепел.
   Кувыркаются в 3D (поля частицы f3, t3x/t3y, w3x/w3y — ядро сжимает их по осям и передаёт, какой стороной к нам), умеют сгорать с края
   (ero частицы: 0 — целая, 1 — сгорела; на кромке огонь, за ней обугленное). Эффекты: золотой взрыв, сгорающие перья, дождь монет, сакура,
   россыпь самоцветов, сердечки, угли, пепел, золотая аура. Нужен пакет hits (формы-вспышки 23). В приложение не входит. */
Forge.pack('matter', k => {
  const { R, PI, easeOut, spawn, step, draw, sprite, DEF, SHP } = k;
  // 26 — предметы: .0 перо · .1 монета · .2 лепесток · .3 уголёк · .4 самоцвет · .5 сердце · .6 бумажка · .7 клуб дыма · .9 пепел. vf.y — сгорание, vf.z — какой стороной к нам (−1…1), vf.w — зерно
  const SRC = [
    'if(vf.x>25.95&&vf.x<26.95){float md=floor(fract(vf.x+.001)*10.+.5);vec2 p=vq*2.-1.;float sd=vf.w;float fz=vf.z;float r=length(p);vec3 col=vt;float a=0.;',
    'float n=.5;if(md!=1.&&md!=4.&&md!=5.&&md!=6.)n=texture2D(nz,vq*.8+sd).r*.6+texture2D(nz,vq*2.1+sd*1.7).g*.4;',   // шум — только формам, которые его читают
    // перо (мультяшное): ствол — ровная дуга; чистый силуэт с 2–3 вырезами-«зазубринами», 3 ступени цвета (тень на одной половине, свет у ствола),
    // редкие тёмные бороздки наискосок, тёмная обводка по краю, светлый ствол; у основания — 3 пушистых завитка
    'if(md<.5){float y=1.-vq.y;float bd=(fract(sd*.37)-.5)*2.;float bend=(1.05+.4*fract(sd*1.7))*(bd<0.?-1.:1.);float xc=bend*((y-.5)*(y-.5)-.25);float sl=bend*2.*(y-.5);',
    'float dx=(p.x-xc)/sqrt(1.+sl*sl);float side=dx*sign(bend);float yv=clamp((y-.12)/.88,0.,1.);float wv=.44*pow(sin(3.1416*pow(yv,.7)),.6)*(side<0.?.7:1.);',
    'float ax=abs(dx)/max(wv,.001);float qs=.03*(1.-y*.8);float st=(1.-smoothstep(qs*.6,qs,abs(dx)))*step(.0,y)*step(y,.95);',
    'float cy1=.45+.25*fract(sd*3.1),cy2=.3+.3*fract(sd*5.3);float cut=side>0.?max(smoothstep(.05,0.,abs(y-cy1)+(1.-ax)*.18),0.):smoothstep(.045,0.,abs(y-cy2)+(1.-ax)*.2);',
    'float ed=smoothstep(1.,.96,ax+cut*.6)*step(.12,y);float olw=smoothstep(.8,.84,ax+cut*.6);',
    'float gr=step(.86,fract(y*7.-abs(dx)*5.+sd))*smoothstep(.15,.3,ax)*(1.-olw);',
    'float dn=smoothstep(.2,.06,y)*step(.01,y);float lob=smoothstep(.3,.24,length(vec2((abs(dx)-.1)*2.2,(y-.11)*3.4)))+smoothstep(.26,.2,length(vec2(dx*2.4,(y-.05)*3.6)));float down=dn*clamp(lob,0.,1.)*step(.015,y);',
    'a=max(max(ed,down),st);float sh=side*sign(bend)>0.?1.:0.;vec3 base=vt*mix(.92,.72,sh);base=mix(base,vt*1.08+.06,step(ax,.35)*(1.-sh)*.8);',
    'col=mix(base,vt*.5,gr*.7);col=mix(col,vt*.42,olw*ed);col=mix(col,vec3(1.)*.96,st);col=mix(col,vt*1.05+.05,down*(1.-ed));}',
    // монета — цилиндр (псевдо-3D, как «Объём»): лицо-эллипс и видимое ребро между лицами; vf.y — доля ребра со знаком (с какой стороны).
    // Ребро — металл с насечкой, свет по цилиндру; лицо — обод, выпуклая звезда, блик скользит при повороте. Зерно ≥ 100 — лицо из своей картинки (im)
    'else if(md<1.5){float e=abs(vf.y);float sg=vf.y<0.?-1.:1.;float ry=max(1.-e,.001);float yc=-sg*e;vec2 fp=vec2(p.x,(p.y-yc)/ry);float fr=length(fp);',
    'float hx=sqrt(max(0.,1.-p.x*p.x))*ry;float dy=abs(p.y-clamp(p.y,-e,e));float ha=smoothstep(hx+.02,hx-.01,dy)*smoothstep(1.,.97,abs(p.x));float fa=smoothstep(1.,.96,fr);',
    'if(ha<.003){gl_FragColor=vec4(0.);return;}float cyl=.5+.45*(-p.x*.7+.3);vec3 ec=vt*(.35+.4*cyl)*(.82+.18*sin(asin(clamp(p.x,-1.,1.))*44.))+vec3(1.,.95,.8)*pow(max(0.,1.-abs(p.x+.35)*3.),3.)*.35;',
    'vec3 fc;if(sd>99.){vec4 ic=IM(fp*.5+.5);float rim=smoothstep(.86,.9,fr);fc=mix(vt*(.7+.3*cyl),ic.rgb,ic.a*(1.-rim));}',
    'else{float rim=smoothstep(.78,.83,fr);float an=atan(fp.y,fp.x);float st=smoothstep(.02,-.02,fr-(.28+.16*pow(abs(cos(an*2.5)),4.)));float lv=.62+.38*(-fp.y*.7+fp.x*.25);',
    'fc=vt*(lv*(1.-rim*.18)+st*.22)+vt*rim*(.25-fp.y*.35);}float sw=exp(-pow(fp.x*.7-fp.y*.7-fz*1.8,2.)*4.);fc+=vec3(1.,.96,.84)*sw*.32*fa;fc*=.6+.4*abs(fz);fc+=vec3(1.)*pow(abs(fz),40.)*.12;',
    'col=mix(ec,fc,fa);a=max(fa,ha);}',
    // лепесток: капля с выемкой на кончике, светлеет к краю, тонкая прожилка
    'else if(md<2.5){float y=vq.y;float w=.6*pow(sin(3.1416*pow(clamp(y,0.,1.),.75)),.9);float nt=smoothstep(.08,0.,abs(p.x))*smoothstep(.12,0.,y);',
    'a=smoothstep(w,w-.08,abs(p.x))*step(.01,y)*(1.-nt);float vn=(1.-smoothstep(0.,.03,abs(p.x)))*.25;col=vt*(.78+.3*abs(p.x)/max(w,.01)+.12*y)-vn*.3;col*=.75+.25*abs(fz);}',
    // уголёк: рваный светящийся кусочек, горячее ядро
    'else if(md<3.5){float d=r+(n-.5)*.55;a=smoothstep(.78,.55,d);col=mix(vt,vec3(1.,.95,.75),smoothstep(.55,.05,d));}',
    // самоцвет: ромб с гранями — каждая своего света, блик при повороте
    'else if(md<4.5){float d=abs(p.x)/.72+abs(p.y);a=smoothstep(1.,.95,d);float tb=step(p.y,-.32);float f=(p.x>0.?.12:-.1)+(p.y<0.?.16:-.08)+tb*.18-step(.62,d)*.12;',
    'col=vt*(.62+f+.32*(1.-d))+vec3(1.)*pow(abs(fz),18.)*.45*(1.-d);col*=.65+.35*abs(fz);}',
    // сердце: сглаженная формула, свет сверху, блик-точка
    'else if(md<5.5){vec2 q=vec2(p.x*1.18,-p.y*1.18+.12);float u=dot(q,q)-1.;float f=u*u*u-q.x*q.x*q.y*q.y*q.y;a=smoothstep(.03,-.03,f);float sp=smoothstep(.2,0.,length(p-vec2(-.35,-.3)));',
    'col=vt*(.75+.3*(-p.y))+vec3(1.)*sp*.5;col*=.75+.25*abs(fz);}',
    // бумажка конфетти: прямоугольник, свет по наклону, блик
    'else if(md<6.5){float e=max(abs(p.x)/.95,abs(p.y)/.6);a=smoothstep(1.,.92,e);col=vt*(.78+.22*p.x)*(.6+.4*abs(fz))+vec3(1.)*pow(abs(fz),30.)*.3;}' +
    // клуб дыма: рваный шар, светлый верх, тёмный низ, внутри шум
    'else if(md<7.5){float d=r+(n-.5)*.5;a=smoothstep(.9,.4,d)*(.75+.25*n);col=vt*(.5+.5*(.5-p.y*.5)+(n-.5)*.35);}' +
    // пепел: тёмный рваный хлопок
    'else{float d=r+(n-.5)*.7;a=smoothstep(.8,.6,d)*(.7+.3*n);col=vec3(.17,.14,.13)*(.8+.4*n)*vt;}',
    // сгорание (перо, лепесток, пепел): горит с краёв по шуму, кромка — огонь, за ней обуглено
    'float b=vf.y;if(b>.001&&md!=1.&&md!=3.&&md!=4.&&md!=6.&&md!=7.){float g=n*.62+(1.-r)*.45;float th=b*1.15-.08;float kp=smoothstep(th-.012,th+.012,g);float rb=smoothstep(th+.07,th,g)*kp;',
    'float ch=smoothstep(th+.26,th+.05,g)*kp;col=mix(col,vec3(.11,.07,.05),ch*.9);col+=vec3(1.,.48,.1)*rb*1.8+vec3(1.,.9,.5)*rb*rb*.8;a*=kp;}',
    'a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}',
  ];
  k.chunk(17, SRC.join(''));

  const G = at => at.map['glow:W0'], SG = at => at.map['sglow:W0'];
  const shade = (c, m) => [c[0] * m, c[1] * m, c[2] * m];   // светлее/темнее одним множителем — оттенок не плывёт
  const M = { feather: 26, coin: 26.1, petal: 26.2, ember: 26.3, gem: 26.4, heart: 26.5, paper: 26.6, puff: 26.7, ash: 26.9 };
  // объёмный предмет: кувыркается, свой оттенок; o — поля частицы поверх
  // монета — цилиндр с ребром: кувыркается вокруг одной оси (иначе ребро не туда), видна поштучно — не прореживается; img: true — лицо из своей картинки
  const COIN = { th3: .17, t3y: 0, w3y: 0, keep: true };
  const bit = (L, kind, o) => spawn(L, Object.assign({ cells: [0], mode: M[kind], f3: true, t3x: R(0, 6.28), t3y: R(0, 6.28), w3x: R(-6, 6), w3y: R(-6, 6), rot: R(0, 6.28), vr: R(-2, 2),
    add: 0, ph: Math.random() * 9, fadeIn: .03, fadeOut: .25, pul: 0, heat: [[0, 1]] }, o, kind === 'coin' ? COIN : null, o.img ? { ph: 100 + Math.random() * 9 } : null));
  const glint = (L, x, y, s = 1, tint = [1, .97, .85]) => spawn(L, { x, y, size: R(22, 38) * s, life: .45, cells: [0], mode: 23, ero: [[0, .85]], heat: [[0, 0]], ph: 4, rot: R(-.3, .3), add: 1, tint, fadeIn: .25, fadeOut: .5, pul: 0, sc: [[0, .2], [.3, 1.1], [1, .2]] });
  const pop = (k, pk = .12) => k < pk ? easeOut(k / pk) * 1.15 : 1.15 - .15 * Math.min(1, (k - pk) / .15) - .35 * Math.max(0, (k - .45) / .55);
  const GOLD = [1, .78, .3], GOLD_HI = [1, .95, .7];

  // ── золотой взрыв: золото стягивается воронкой → вспышка, крест, колючая звезда, две волны → монеты кувыркаются, падают и отскакивают,
  //    блестят; золотая пыль остывает в оранжевое, искры, столбы света; угольки поднимаются
  DEF.goldboom = { atlas: 'aura', imgOpt: true,   // img — своя монетка (лицо монеты из картинки)
    period: 2.8,
    presets: { rose: { s: { gold: [1, .62, .7], hi: [1, .9, .92] } }, silver: { s: { gold: [.82, .86, .95], hi: [1, 1, 1] } } },
    init: s => Object.assign(s, { p: [], c: [], hit: false, gold: GOLD, hi: GOLD_HI }),
    update(s, dt, at){ const T = .38, t = s.cycle, Gd = s.gold, Hi = s.hi;
      if (t < T){ s.shake = 1.5 + t * 6;   // ожидание: золотая пыль затягивается к центру
        k.emit(s.acc, 1, 70, dt, () => { const a = R(0, 6.28), r = R(120, 170); spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, ax: 180, ay: 180, pull: 1400, swirl: 300, kr: 14, drag: 2,
          size: R(5, 9), life: .6, cells: [G(at)], add: 1, tint: Hi, fadeIn: .1, fadeOut: .2, pul: 0, trail: 5 }); }); }
      else if (!s.hit){ s.hit = true; s.shake = 13; s.freeze = .06;
        for (let i = 0; i < 34; i++){ const a = -PI / 2 + R(-1.6, 1.6), v = R(300, 720);   // монеты
          bit(s.c, 'coin', { img: !!s.o.img, x: 180 + R(-8, 8), y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, drag: .9, grav: 1300, floor: 318, bounce: R(.3, .45), size: R(24, 38), life: R(2, 2.4),
            w3x: R(8, 16) * (Math.random() < .5 ? -1 : 1), w3y: R(-3, 3), vr: R(-4, 4), tint: shade(Gd, R(.92, 1.05)), fadeOut: .2 }); }
        for (let i = 0; i < 60; i++){ const a = R(0, 6.28), v = R(200, 800);   // золотая пыль-искры
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(6, 11), speedStretch: .01, orient: true, drag: 2.2, grav: 420, life: R(.5, 1.1), cells: [G(at)], add: 1,
            tc: [[0, [1, 1, .95]], [.2, Hi], [.6, Gd], [1, [.6, .2, .03]]], fadeIn: .01, fadeOut: .4, pul: 0 }); }
        for (let i = 0; i < 6; i++) spawn(s.p, { x: 180 + R(-40, 40), y: 190, vy: -R(700, 1000), size: R(16, 30), stretch: 10, life: R(.3, .5), drag: 3, cells: [0], mode: 23.6, ero: [[0, .25]], add: 1, tint: Hi, fadeIn: .02, fadeOut: .6, pul: 0, sc: [[0, .6], [.3, 1], [1, .7]] });
        for (let i = 0; i < 28; i++){ const a = -PI / 2 + R(-1.3, 1.3), v = R(50, 200);   // угольки
          spawn(s.p, { x: 180 + R(-30, 30), y: 190, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: R(1.4, 2.2), drag: 1.5, grav: -60, sway: 16, size: R(9, 15), cells: [0], mode: 26.3, add: 1,
            tint: Gd, fadeIn: .05, fadeOut: .5, pul: .3, pf: 8 }); } }
      // монеты блестят, когда смотрят на нас
      for (const c of s.c) if (Math.random() < dt * 3 && Math.abs(Math.cos(c.t3x) * Math.cos(c.t3y)) > .9) glint(s.p, c.x, c.y, .9, Hi);
      step(s.p, dt); step(s.c, dt); },
    render(s, c){ const at = c.at, t = s.cycle, T = .38, Gd = s.gold, Hi = s.hi;
      if (t < T){ const q = t / T; sprite(c, 180, 180, 60 + 140 * q, 0, .3 + q * .6, 1, SG(at), 1, Gd); sprite(c, 180, 180, 300 * (1 - q) + 40, q * 3, q * .8, 1, 0, 1, Hi, 0, SHP(3, .02, 0, 0)); }
      else { const q = (t - T) / 1.6, e = easeOut(Math.min(1, q * 4));
        if (q < 1){ sprite(c, 180, 180, 440 * (1 + .2 * q), 0, (1 - q) ** 2.4 * .9, 1, SG(at), 1, Gd);
          if (q < .08) sprite(c, 180, 180, 260, 0, 1 - q / .08, 1, G(at), 1, [1, 1, 1]);
          if (q < .5) sprite(c, 180, 180, 520 * (1 - .35 * q), 0, (1 - q / .5) ** 1.6, 1, 0, 1, Hi, 0, SHP(2, .03, .85, 0));
          const qs = Math.min(1, q * 1.8); if (qs < 1){ sprite(c, 180, 180, 300 * pop(qs, .12), .2 + q * .6, Math.min(1, (1 - qs) * 2.4), .2, 0, 1, Gd, 0, SHP(4, .85, .18, 12.41));
          sprite(c, 180, 180, 150 * pop(qs, .12), -.2 - q, Math.min(1, (1 - qs) * 2.4), .6, 0, 1, Hi, 0, SHP(4, .7, 0, 8.17)); }
          if (q < .45){ const w = q / .45; sprite(c, 180, 180, 80 + 380 * easeOut(w), 0, (1 - w) ** 1.5, 1, 0, 1, Hi, 0, SHP(3, .03, 0, 0)); }
          if (q > .05 && q < .6){ const w = (q - .05) / .55; sprite(c, 180, 180, 60 + 320 * easeOut(w), 0, (1 - w) ** 2 * .7, 1, 0, 1, Gd, 0, SHP(3, .05, 0, 0)); } } }
      draw(c, s.c); draw(c, s.p); } };

  // ── сгорающие перья: хлопок — облачко пуха; перья разлетаются, кувыркаются и планируют (скользят вбок по наклону),
  //    каждое загорается в своё время: огонь бежит с края, перо обугливается и рассыпается угольками, тянется дымок
  DEF.feathers = { atlas: 'aura', period: 3.4,
    presets: { white: {}, gold: { s: { tint: [1, .85, .45] } }, black: { s: { tint: [.3, .28, .32] } }, noburn: { s: { burn: false } } },
    init: s => Object.assign(s, { p: [], f: [], hit: false, tint: [1, .97, .9], burn: true }),
    update(s, dt, at){
      if (!s.hit){ s.hit = true; s.shake = 6;
        for (let i = 0; i < 15; i++){ const a = -PI / 2 + R(-2.4, 2.4), v = R(160, 430), life = R(2.6, 3.3), d = R(.28, .55);
          bit(s.f, 'feather', { x: 180 + R(-10, 10), y: 180 + R(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, drag: 2.6, grav: 150, sway: R(25, 55), size: R(40, 60), stretch: R(1.6, 1.85),
            life, w3x: R(1.5, 4) * (Math.random() < .5 ? -1 : 1), w3y: R(2, 6) * (Math.random() < .5 ? -1 : 1), vr: R(-2.2, 2.2), tint: shade(s.tint, R(.93, 1.02)),
            ero: s.burn ? [[0, 0], [d, 0], [Math.min(.97, d + R(.35, .5)), 1.05], [1, 1.05]] : [[0, 0]], fadeOut: s.burn ? .05 : .3 }); }
        for (let i = 0; i < 7; i++){ const a = R(0, 6.28), v = R(60, 220);   // пух — мелкие пёрышки, тормозят и парят дольше
          bit(s.p, 'feather', { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.5, grav: 60, sway: R(15, 30), size: R(14, 22), stretch: 1.3, life: R(1.4, 2.2), w3x: R(2, 5), w3y: R(2, 6), tint: s.tint, alpha: .85, fadeOut: .4 }); }
      }
      for (const f of s.f){ f.vx += Math.sin(f.t3x) * Math.cos(f.t3y) * 90 * dt;   // планирует: наклон уводит вбок
        if (!s.burn) continue; const q = f.age / f.life, b = k.crv(f.ero, q);
        if (b > .05 && b < 1){ if (Math.random() < dt * 9) spawn(s.p, { x: f.x + R(-14, 14), y: f.y + R(-20, 20), vx: R(-30, 30) + f.vx * .3, vy: R(-90, -30), size: R(5, 9), life: R(.5, 1), drag: 1.5, grav: -80, sway: 12,
            cells: [0], mode: 26.3, add: 1, tint: [1, .55, .15], fadeIn: .02, fadeOut: .5, pul: .3, pf: 12 });
          if (Math.random() < dt * 5) spawn(s.p, { x: f.x, y: f.y - 10, vx: R(-10, 10), vy: R(-50, -25), size: R(34, 56), grow: 1.4, life: R(1, 1.6), drag: 1, cells: [SG(at)], add: 0, alpha: .3, tint: [.32, .29, .28], fadeIn: .2, fadeOut: .6, pul: 0, sway: 10 }); }
        if (b >= 1 && !f.ash){ f.ash = true; for (let i = 0; i < 4; i++) bit(s.p, 'ash', { x: f.x + R(-12, 12), y: f.y + R(-16, 16), vx: R(-30, 30), vy: R(-20, 30), drag: 2, grav: 60, sway: 20, size: R(8, 14), life: R(.8, 1.3), w3x: R(-5, 5), w3y: R(-5, 5), fadeOut: .5 }); } }
      step(s.f, dt); step(s.p, dt); },
    render(s, c){ const t = s.cycle; if (t < .35){ const q = t / .35; sprite(c, 180, 180, 120 + 260 * easeOut(q), 0, (1 - q) ** 2 * .7, 1, SG(c.at), 1, [1, .98, .92]); }
      draw(c, s.f); draw(c, s.p); } };

  // ── дождь монет (цикл): монеты падают кувыркаясь, блестят, внизу отскакивают и тают
  DEF.coinrain = { atlas: 'aura', imgOpt: true,   // img — своя монетка (лицо монеты из картинки)
    presets: { silver: { s: { tint: [.82, .86, .95] } }, rose: { s: { tint: [1, .62, .7] } } },
    init: s => Object.assign(s, { p: [], c: [], tint: GOLD }),
    update(s, dt){ k.emit(s.acc, 1, 9, dt, () => bit(s.c, 'coin', { img: !!s.o.img, x: R(30, 330), y: -20, vx: R(-20, 20), vy: R(120, 260), grav: 600, drag: .3, floor: 330, bounce: .35, size: R(22, 36), life: R(1.6, 2.2),
        w3x: R(6, 13) * (Math.random() < .5 ? -1 : 1), w3y: R(-3, 3), vr: R(-2, 2), tint: shade(s.tint, R(.92, 1.05)), fadeOut: .2 }));
      for (const c of s.c) if (Math.random() < dt * 2 && Math.abs(Math.cos(c.t3x) * Math.cos(c.t3y)) > .9) glint(s.p, c.x, c.y, .8);
      step(s.c, dt); step(s.p, dt); },
    render(s, c){ draw(c, s.c); draw(c, s.p); } };

  // ── сакура (цикл): лепестки падают, порхают и кувыркаются; пресеты — осенние листья цвета, лепестки роз
  DEF.petals = { atlas: 'aura', presets: { rose: { s: { tints: [[.85, .1, .2], [.95, .25, .3], [.7, .05, .15]] } }, autumn: { s: { tints: [[1, .55, .1], [.9, .3, .05], [1, .78, .2]] } }, snow: { s: { tints: [[.92, .96, 1], [1, 1, 1]] } } },
    init: s => Object.assign(s, { p: [], tints: [[1, .78, .86], [1, .86, .92], [.98, .66, .78]] }),
    update(s, dt){ k.emit(s.acc, 1, 7, dt, () => bit(s.p, 'petal', { x: R(-20, 380), y: -20, vx: R(20, 60), vy: R(40, 90), drag: .8, grav: 30, sway: R(30, 60), size: R(16, 26), stretch: 1.25, life: R(4, 6),
        w3x: R(1.5, 4), w3y: R(2, 5), vr: R(-1.5, 1.5), tint: s.tints[(Math.random() * s.tints.length) | 0], fadeIn: .05, fadeOut: .15 }));
      for (const f of s.p) f.vx += Math.sin(f.t3x) * 40 * dt; step(s.p, dt); },
    render(s, c){ draw(c, s.p); } };

  // ── россыпь самоцветов: камни вылетают из центра, кувыркаются, бликуют гранями, падают; вспышка цветом
  const GEMS = [[.3, .65, 1], [.85, .25, .9], [.25, .95, .55], [1, .3, .35], [1, .8, .25]];
  DEF.gems = { atlas: 'aura', period: 2.2,
    init: s => Object.assign(s, { p: [], g: [], hit: false }),
    update(s, dt){ if (!s.hit){ s.hit = true; s.shake = 6;
        for (let i = 0; i < 18; i++){ const a = -PI / 2 + R(-1.4, 1.4), v = R(280, 620), col = GEMS[i % GEMS.length];
          bit(s.g, 'gem', { x: 180, y: 190, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, drag: 1, grav: 1100, floor: 318, bounce: .3, size: R(26, 42), stretch: 1.25, life: R(1.7, 2.1), w3x: R(-8, 8), w3y: R(6, 12), vr: R(-3, 3), tint: col }); } }
      for (const g of s.g) if (Math.random() < dt * 3 && Math.abs(Math.cos(g.t3x) * Math.cos(g.t3y)) > .85) glint(s.p, g.x, g.y, .8, [1, 1, 1]);
      step(s.g, dt); step(s.p, dt); },
    render(s, c){ const q = s.cycle / .5; if (q < 1){ sprite(c, 180, 190, 200 + 300 * easeOut(q), 0, (1 - q) ** 2, 1, SG(c.at), 1, [.7, .6, 1]); sprite(c, 180, 190, 80 + 400 * easeOut(q), 0, (1 - q) ** 1.5, 1, 0, 1, [1, 1, 1], 0, SHP(3, .03, 0, 0)); }
      draw(c, s.g); draw(c, s.p); } };

  // ── сердечки (цикл): поднимаются, покачиваются и поворачиваются, у края гаснут; иногда лопаются искрами
  DEF.hearts = { atlas: 'aura', presets: { gold: { s: { tints: [[1, .8, .3], [1, .9, .5]] } }, violet: { s: { tints: [[.7, .4, 1], [.9, .55, 1]] } } },
    init: s => Object.assign(s, { p: [], tints: [[1, .3, .45], [1, .45, .6], [.95, .2, .35]] }),
    update(s, dt, at){ k.emit(s.acc, 1, 4, dt, () => bit(s.p, 'heart', { x: R(60, 300), y: 340, vx: R(-15, 15), vy: -R(70, 130), drag: .4, sway: R(20, 40), size: R(22, 40), life: R(2.4, 3.4),
        t3x: 0, w3x: 0, t3y: R(-.6, .6), w3y: R(-1.5, 1.5), rot: R(-.3, .3), vr: R(-.4, .4), tint: s.tints[(Math.random() * s.tints.length) | 0], fadeIn: .1, fadeOut: .3,
        onDie: Math.random() < .35 ? (q, L) => { for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28; spawn(L, { x: q.x, y: q.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, drag: 3, size: 6, life: .35, cells: [G(at)], add: 1, tint: q.tint, fadeIn: .01, fadeOut: .6, pul: 0 }); } } : null }));
      step(s.p, dt); },
    render(s, c){ draw(c, s.p); } };

  // ── угли (аура, цикл): снизу поднимается жар — угольки кружат вверх, мерцают, остывают; мягкий отсвет дышит
  DEF.embers = { atlas: 'aura', presets: { blue: { s: { tint: [.35, .7, 1] } }, toxic: { s: { tint: [.5, 1, .3] } }, violet: { s: { tint: [.75, .4, 1] } } },
    init: s => Object.assign(s, { p: [], tint: [1, .5, .12] }),
    update(s, dt){ const T = s.tint; k.emit(s.acc, 1, 24, dt, () => spawn(s.p, { x: 180 + R(-120, 120), y: 330 + R(-10, 10), vx: R(-20, 20), vy: -R(60, 160), flow: 70, fz: 1.6, grav: -70, size: R(6, 13), life: R(1.6, 2.8),
        cells: [0], mode: 26.3, add: 1, tc: [[0, [1, .95, .75].map((v, i) => (v + T[i]) / 2)], [.45, T], [1, T.map(v => v * .35)]], fadeIn: .1, fadeOut: .4, pul: .35, pf: R(8, 14), ph: Math.random() * 9 }));
      step(s.p, dt); },
    render(s, c){ const w = .5 + .5 * Math.sin(s.t * 2.2) * Math.sin(s.t * 3.7 + 1); sprite(c, 180, 320, 420, 0, .22 + .12 * w, 1, SG(c.at), .45, s.tint); draw(c, s.p); } };

  // ── пепел (цикл): хлопья падают и кувыркаются, часть ещё тлеет по краю
  DEF.ashfall = { atlas: 'aura',
    init: s => Object.assign(s, { p: [] }),
    update(s, dt){ k.emit(s.acc, 1, 10, dt, () => { const hot = Math.random() < .35; bit(s.p, hot ? 'feather' : 'ash', hot ? { x: R(0, 360), y: -20, vx: R(-10, 30), vy: R(30, 70), drag: .6, sway: R(20, 40), size: R(12, 20), stretch: 1.4, life: R(3, 4.5),
          w3x: R(1, 3), w3y: R(1.5, 4), tint: [.3, .27, .26], ero: [[0, .45], [1, .75]] } : { x: R(0, 360), y: -20, vx: R(-10, 30), vy: R(30, 70), drag: .6, sway: R(20, 40), size: R(8, 16), life: R(3, 4.5), w3x: R(1, 4), w3y: R(1, 4) }); });
      step(s.p, dt); },
    render(s, c){ draw(c, s.p); } };

  // ── золотая аура (цикл): золотая пыль поднимается вихрем, вспыхивают блики, мягкий свет дышит, редкие монетки проплывают
  DEF.goldaura = { atlas: 'aura', imgOpt: true,   // img — своя монетка (лицо монеты из картинки)
    presets: { rose: { s: { gold: [1, .62, .7] } }, silver: { s: { gold: [.82, .86, .95] } } },
    init: s => Object.assign(s, { p: [], gold: GOLD }),
    update(s, dt, at){ const Gd = s.gold;
      k.emit(s.acc, 1, 30, dt, () => { const a = R(0, 6.28), r = R(40, 140); spawn(s.p, { x: 180 + Math.cos(a) * r, y: 200 + Math.sin(a) * r * .5, vy: -R(30, 80), flow: 55, fz: 1.3, grav: -40, size: R(4, 8), life: R(1.4, 2.4),
        cells: [G(at)], add: 1, tc: [[0, GOLD_HI], [.6, Gd], [1, Gd.map(v => v * .5)]], fadeIn: .2, fadeOut: .4, pul: .3, pf: 10, trail: 6 }); });
      k.emit(s.acc, 2, 2.5, dt, () => glint(s.p, 180 + R(-120, 120), 180 + R(-110, 90), R(.7, 1.2), GOLD_HI));
      k.emit(s.acc, 3, .8, dt, () => bit(s.p, 'coin', { img: !!s.o.img, x: 180 + R(-100, 100), y: 300, vy: -R(40, 80), drag: .2, sway: 14, size: R(18, 26), life: R(2.4, 3.2), w3x: R(3, 6), w3y: R(-1, 1), tint: Gd, fadeIn: .2, fadeOut: .3 }));
      step(s.p, dt); },
    render(s, c){ const w = .5 + .5 * Math.sin(s.t * 1.6); sprite(c, 180, 190, 380 + 40 * w, 0, .3 + .1 * w, 1, SG(c.at), 1, s.gold); draw(c, s.p); } };
  Object.assign(k, { bit, glint, M });   // для пакетов дальше (remaster)
});
