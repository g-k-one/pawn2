/* Горн — пакет «image»: слой картинки — глитч, помехи, стекло, изморозь, деформации, пиксели, желе, осколки (режимы 22, 24).
   Подключается после src/app/16e-forge.js: <script src="src/forge/image.js">. В приложение не входит — только то, что нужно игре, живёт в ядре. */
Forge.pack('image', k => {
  const { R, PI, easeOut, quad, quad4, seg, branch, sprite, DEF } = k;
  k.chunk(13,
    // 22 — картинка и что с ней делать (дробная часть — вариант): .0 как есть · .1 глитч · .2 помехи · .3 стекло · .4 изморозь · .5 волна ·
    // .6 воронка · .7 линза · .8 марево · .9 пиксели. vq — место в картинке (0…1, за краями пусто), vf.y — сила, vf.z — ход (0…1), vf.w — частота/фаза
    'if(vf.x>21.9&&vf.x<22.95){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);vec2 u=vq;float k=vf.y;vec4 c;vec3 ad=vec3(0.);' +
    'if(md<.5){c=IM(u);}' +
    // глитч: полосы рвутся вбок рывками (смена раз в 1/vf.w с), каналы цвета разъезжаются, строки темнее, в сорванных полосах — шум
    'else if(md<1.5){float st=floor(t*vf.w);float row=floor(u.y*(14.+H1(st)*20.));float h=H1(row*12.99+st*78.23);float bk=step(1.-k*.5,h);' +
    'u.x+=(H1(row*3.1+st*9.7)-.5)*.3*k*bk+(H1(st)-.5)*.02*k;float sp=k*.022*(1.+bk*2.5);vec4 r=IM(u+vec2(sp,0.)),g=IM(u),b=IM(u-vec2(sp,0.));' +
    'c=vec4(r.r,g.g,b.b,max(g.a,max(r.a,b.a)));c.rgb*=mix(1.,.82+.18*sin(gl_FragCoord.y*2.1),k);float n=H2(floor(gl_FragCoord.xy*.33)+st);c.rgb=mix(c.rgb,vec3(n),bk*k*.35);}' +
    // помехи: зерно 30 раз/с, бегущая полоса, строки дрожат, цвет выцветает
    'else if(md<2.5){float st=floor(t*30.);float row=floor(u.y*90.);u.x+=(H1(row+st*7.)-.5)*.012*k;c=IM(u);float n=H2(floor(gl_FragCoord.xy*.5)+st*1.37);' +
    'float bar=smoothstep(.06,0.,abs(fract(u.y*.7-t*.35)-.5)-.38);float gr=dot(c.rgb,vec3(.3,.59,.11));c.rgb=mix(c.rgb,vec3(gr),k*.6);' +
    'c.rgb=mix(c.rgb,vec3(n),k*(.35+bar*.3))*(1.-k*.15*sin(gl_FragCoord.y*3.));c.rgb+=bar*k*.12;}' +
    // стекло: по краю скруглённого стекла картинка преломляется к центру, каналы — с разным сдвигом (радуга), по стеклу бежит блик, кромка светится
    'else if(md<3.5){vec2 p=u-.5;vec2 q=abs(p)-.5+.12;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.12;float e=1.-smoothstep(0.,.16,-d);vec2 nr=normalize(p+1e-4)*e*e;' +
    'float s=.06*k;c=IM(u-nr*s);c.r=IM(u-nr*s*.75).r;c.b=IM(u-nr*s*1.3).b;float gl=exp(-pow((p.x+p.y)*1.2-(fract(t*.18+vf.w)*3.-1.5),2.)*30.)*.32;' +
    'float rim=(1.-smoothstep(0.,.025,abs(d)))*.55+e*e*.12;ad=vec3(gl+rim)*step(d,0.);c.a=max(c.a,step(d,0.)*.12);}' +
    // изморозь: размытие по 8 точкам с поворотом от шума (иней), светлее и холоднее; vf.y — сколько инея
    'else if(md<4.5){float a=H2(floor(gl_FragCoord.xy))*6.2832;vec4 s=IM(u);float r=k*.035;for(int i=0;i<8;i++){float b=a+float(i)*2.3998;float rr=r*sqrt((float(i)+.5)/8.);s+=IM(u+vec2(cos(b),sin(b))*rr);}' +
    'c=s/9.;c.rgb=mix(c.rgb,vec3(.86,.93,1.),k*.28);ad=vec3(H2(floor(gl_FragCoord.xy*.5))*k*.06);}' +
    // волна от центра: фронт на радиусе vf.z, картинка сдвигается по радиусу, гребень светлее
    'else if(md<5.5){vec2 p=u-.5;float r=length(p);float w=sin((r-vf.z*.75)*48.)*exp(-abs(r-vf.z*.75)*14.);u+=p/(r+1e-3)*w*k*.025;c=IM(u);ad=vec3(max(w,0.)*k*.22);}' +
    // воронка: закрутка к центру (сильнее у центра) и втягивание по ходу vf.z
    'else if(md<6.5){vec2 p=u-.5;float r=length(p);float a=k*pow(max(0.,1.-r*1.6),2.)*7.;float cs=cos(a),sn=sin(a);p=mat2(cs,-sn,sn,cs)*p*(1.+vf.z*vf.z*5.);c=IM(p+.5);}' +
    // линза: выпуклость (k > 0) или вдавленность (k < 0)
    'else if(md<7.5){vec2 p=u-.5;float r=length(p)*2.;float f=pow(clamp(r,1e-3,1.),k);c=IM(p*f+.5);}' +
    // марево (жар над огнём): шум течёт вверх, сильнее внизу
    'else if(md<8.5){vec2 n=texture2D(nz,u*vec2(1.6,1.1)+vec2(0.,-t*.5)).rg-.5;u+=n*k*.05*(.35+u.y);c=IM(u);}' +
    // пиксели: блоки растут с силой
    'else{float n=mix(96.,5.,k);c=IM((floor(u*n)+.5)/n);}' +
    'float A=c.a*va.x;gl_FragColor=vec4((c.rgb*vt+ad)*A,A*(1.-va.y));return;}' +
    '');
  k.chunk(15,
    // 24 — ещё приёмы для картинки: .0 силуэт (кадр удара: картинка заливается цветом vt на vf.y) · .1 светящийся контур (vf.y толщина, vf.z сила) ·
    // .2 белая вспышка (vf.y) · .3 сдвиг цвета (vf.y оборотов) · .4 сгорание с кромкой (vf.z ход, кромка — vt) · .5 голограмма (vf.y сила)
    'if(vf.x>23.9&&vf.x<24.95){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);vec2 u=vq;float k=vf.y;vec4 c=IM(u);vec3 ad=vec3(0.);float ex=0.;' +
    'if(md<.5){c.rgb=mix(c.rgb,vt,k);}' +
    'else if(md<1.5){float o=0.;for(int i=0;i<12;i++){float b=float(i)*.5236;o=max(o,IM(u+vec2(cos(b),sin(b))*k*.035).a);o=max(o,IM(u+vec2(cos(b),sin(b))*k*.017).a);}' +
    'ex=clamp((o-c.a)*vf.z,0.,1.)*(.85+.15*sin(t*6.));ad=vt*ex;}' +
    'else if(md<2.5){c.rgb=mix(c.rgb,vec3(1.),k);}' +
    'else if(md<3.5){float a=k*6.2832;vec3 y=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312)*c.rgb;float h=atan(y.z,y.y)+a;float ch=length(y.yz);y.yz=vec2(cos(h),sin(h))*ch;' +
    'c.rgb=clamp(mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703)*y,0.,1.);}' +
    'else if(md<4.5){float n=texture2D(nz,u*1.4).r*.7+texture2D(nz,u*3.1).g*.3;float th=vf.z*1.15-.08;float e=smoothstep(th+.07,th,n);c.a*=smoothstep(th-.01,th+.025,n);ex=e*step(th,n+.0)*IM(u).a;ad=vt*ex*1.6;}' +
    // .7 смена обликов (глитч из моушн-дизайна): картинка в одном из 11 обликов; vf.w < 1 — линия раздела: выше облик vf.y, ниже vf.z,
    // нижняя часть сдвинута вбок. Облики: 0 как есть · 1 градиент бирюза → розовый · 2 неоновый зелёный с прожилками и свечением края ·
    // 3 синий верх / жёлтый низ · 4 наклейка: белая заливка, тёмная обводка, красная подложка с рваным краем · 5 розовый полутон · 6 мазки кисти за буквами · 7 тьма с прожилками и щупальцами · 8 молния · 9 мишень · 10 маркер-каракуля
    'else if(md>6.5){float sp=vf.w;float lo=step(sp,u.y);float S=mix(vf.y,vf.z,lo);vec2 w=u+vec2(lo*step(sp,.999)*(H1(floor(sp*97.))-.5)*.06,0.);c=IM(w);' +
    'float lm=dot(c.rgb,vec3(.3,.59,.11));float dl=0.;for(int i=0;i<8;i++){float b=float(i)*.785;dl=max(dl,IM(w+vec2(cos(b),sin(b))*.022).a);}float ol=clamp(dl-c.a,0.,1.);' +
    // 20+ — облик из своей картинки: клетка листа 4×2 (несколько картинок, imgs)
    'if(S>19.5){float ci=S-20.;vec2 cl=clamp(w,.004,.996);c=texture2D(im,(vec2(mod(ci,4.),floor(ci/4.))+cl)/vec2(4.,2.))*step(0.,w.x)*step(w.x,1.)*step(0.,w.y)*step(w.y,1.);dl=c.a;}' +
    'else if(S<.5){}else if(S<1.5){vec3 g=mix(vec3(.25,1.,.95),vec3(1.,.3,.85),smoothstep(.3,.75,w.y));c.rgb=g*(.55+.6*lm);ad=vec3(.9,1.,1.)*ol*.9;c.a=max(c.a,ol);}' +
    'else if(S<2.5){float vn=texture2D(nz,w*3.).r;float vein=pow(1.-abs(vn*2.-1.),8.);c.rgb=vec3(.08,.75,.55)*(.35+.7*lm)+vec3(.4,1.,.8)*vein*.6*c.a;ad=vec3(.2,1.,.7)*ol;c.a=max(c.a,ol*.9);}' +
    'else if(S<3.5){vec3 g=w.y<.52?mix(vec3(.15,.35,1.),vec3(.45,.75,1.),w.y/.52):vec3(1.,.95,.1);c.rgb=g*(.6+.55*lm);ad=vec3(1.)*ol*.5;c.a=max(c.a,ol);}' +
    'else if(S<4.5){float d2=0.;for(int i=0;i<8;i++){float b=float(i)*.785+.39;d2=max(d2,IM(w+vec2(cos(b),sin(b))*.07).a);}float rn=texture2D(nz,w*2.5).g;float pap=smoothstep(.45,.55,d2+(rn-.5)*.5);' +
    'vec3 fill=vec3(.96)*(.85+.15*lm);c.rgb=mix(vec3(.85,.33,.3)*(.8+.2*rn),vec3(.08),clamp(ol*1.5,0.,1.));c.rgb=mix(c.rgb,fill,c.a);c.a=max(max(c.a,ol),pap*.95);}' +
    'else if(S<5.5){vec2 g=fract(gl_FragCoord.xy/5.)-.5;float dt=step(length(g),.25+.3*lm);c.rgb=mix(vec3(.55,.1,.45),vec3(1.,.5,.9),dt)*(.6+.5*lm);ad=vec3(1.,.6,.95)*ol*.7;c.a=max(c.a,ol);}' +
    // 6 мазки: розовые буквы, за ними цветные мазки кисти веером (красный, зелёный, оранжевый, синий) и тёмная обводка
    'else if(S<6.5){float d2=0.;for(int i=0;i<8;i++){float b=float(i)*.785+.2;d2=max(d2,IM(w+vec2(cos(b),sin(b))*.17).a);}float kn=texture2D(nz,vec2(w.x*.7+w.y*1.4,w.y*.35)).r;' +
    'float bs=(w.x+w.y*.55)*5.+kn*2.2;float lane=floor(bs);float stk=step(.3,fract(bs))*smoothstep(.3,.55,d2+(kn-.5)*.7)*step(.2,H1(lane*7.3));' +
    'vec3 pal=H1(lane*3.1)<.25?vec3(.9,.2,.25):H1(lane*3.1)<.5?vec3(.25,.75,.4):H1(lane*3.1)<.75?vec3(1.,.55,.15):vec3(.3,.45,.95);' +
    'vec3 fill=vec3(1.,.42,.82)*(.65+.45*lm);c.rgb=mix(pal*(.75+.25*kn),vec3(.08),clamp(ol*1.4,0.,1.));c.rgb=mix(c.rgb,fill,c.a);c.a=max(max(c.a,ol),stk*.95);}' +
    // 7 тьма: тёмно-бирюзовые буквы, внутри светящиеся прожилки-трещины, вокруг тёмные щупальца-дымка
    'else if(S<7.5){float vn=texture2D(nz,w*2.6+vec2(t*.03,0.)).r;float vein=pow(1.-abs(vn*2.-1.),14.);float d2=0.;for(int i=0;i<8;i++){float b=float(i)*.785;d2=max(d2,IM(w+vec2(cos(b),sin(b))*.05).a);}' +
    'float tn=texture2D(nz,w*4.+vec2(0.,t*.08)).g;float ten=smoothstep(.55,.75,d2*tn*1.6)*(1.-c.a);c.rgb=vec3(.03,.13,.14)*(.6+.6*lm)+vec3(.3,1.,.95)*vein*1.1*c.a;' +
    'c.rgb=mix(c.rgb,vec3(.02,.05,.07),ten);ad=vec3(.2,.9,.85)*ol*.6;c.a=max(max(c.a,ol*.8),ten*.85);}' +
    // 8 молния: синий верх, жёлтый низ, наискосок через буквы — яркая молния (дрожит), вокруг голубое свечение
    'else if(S<8.5){vec3 g=w.y<.52?mix(vec3(.15,.3,1.),vec3(.4,.7,1.),w.y/.52):vec3(1.,.95,.08);c.rgb=g*(.6+.55*lm);float jt=(texture2D(nz,vec2(w.x*3.,floor(t*20.)*.13)).r-.5)*.06;' +
    'float ly=.2+w.x*.45+jt;float dd=abs(w.y-ly);float bolt=exp(-dd*140.)*step(-.05,w.x)*step(w.x,1.05);float bg=exp(-dd*22.)*.5;' +
    'ad=vec3(1.,1.,.75)*bolt*1.6+vec3(.45,.75,1.)*(bg*.6+ol*.9);c.a=max(max(c.a,ol*.7),max(bolt,bg*.5));}' +
    // 9 мишень: зелёные буквы, за ними тёмно-красные круги мишени и мелкие крестики
    'else if(S<9.5){vec2 q=w-vec2(.5,.52);float rr=length(q*vec2(1.,1.25));float rg=step(.5,fract(rr*8.))*step(rr,.64);vec2 cl=fract(w*7.)-.5;vec2 ci=floor(w*7.);' +
    'float xm=step(.72,H2(ci+3.))*(1.-smoothstep(.02,.05,min(abs(cl.x-cl.y),abs(cl.x+cl.y))))*step(max(abs(cl.x),abs(cl.y)),.16);' +
    'vec3 fill=vec3(.15,.78,.56)*(.55+.55*lm);c.rgb=mix(vec3(.42,.17,.1),vec3(.2,.9,.65),xm);c.rgb=mix(c.rgb,vec3(.03,.2,.15),clamp(ol*1.4,0.,1.));c.rgb=mix(c.rgb,fill,c.a);' +
    'c.a=max(max(c.a,ol),max(rg*.9,xm));}' +
    // 10 маркер: белые буквы с тонкой чёрной обводкой, поверх — каракуля маркером (зелёный/фиолетовый) и пятно-клякса
    'else{float sq=abs(w.y-(.55+.06*sin(w.x*22.+floor(t*6.))+.03*sin(w.x*61.)));float mk=smoothstep(.016,.008,sq)*step(.2,w.x)*step(w.x,.85);' +
    'float bl=smoothstep(.12,.1,length((w-vec2(.14,.78))*vec2(1.,1.3))+(texture2D(nz,w*5.).r-.5)*.08);vec3 fill=vec3(.97)*(.85+.15*lm);' +
    'c.rgb=mix(vec3(.05),fill,c.a);c.rgb=mix(c.rgb,vec3(.6,.25,.95),mk);c.rgb=mix(c.rgb,vec3(.35,.85,.2),bl);c.a=max(max(c.a,ol),max(mk,bl));}' +
    'ad+=vec3(1.)*smoothstep(.012,0.,abs(u.y-sp))*.7*step(sp,.999)*max(c.a,dl);}' +
    'else if(md>5.5){float N=max(vf.w,6.);float row=floor(u.y*N);float d=H1(row*3.31)*.45;float rt=clamp((vf.z-d)/.55,0.,1.);float sg=H1(row*1.73)<.5?-1.:1.;' +
    'vec2 w=u+vec2(sg*rt*rt*1.3,0.);float sp=rt*.04;c=vec4(IM(w+vec2(sp,0.)).r,IM(w).g,IM(w-vec2(sp,0.)).b,IM(w).a);c.a*=1.-smoothstep(.55,1.,rt);' +
    'float ln=step(fract(u.y*N),.08)*step(.01,rt)*(1.-rt);ad=vec3(ln*.9)*IM(w).a;}' +
    'else if(md>4.5){float sl=.75+.25*sin(u.y*180.-t*9.);float fl=.88+.12*step(.93,fract(sin(floor(t*14.))*437.5));vec3 rb=.5+.5*cos(6.2832*(u.y*.8+t*.15+vec3(0.,.33,.67)));' +
    'c.rgb=mix(c.rgb,c.rgb*.4+rb*.6,k*.7)*sl*fl;c.a*=mix(1.,.72,k);ad=rb*k*.12*c.a;}' +
    'float A=c.a*va.x;gl_FragColor=vec4(c.rgb*A+ad*va.x,max(A,ex*va.x)*(1.-va.y));return;}' +
    '');
  /* ── слой картинки: Горн сам рисует картинку (подарок, карточку) и делает с ней то, чего не умеет CSS: глитч, помехи, стекло,
     изморозь, волна, воронка, линза, марево, пиксели, желе, осколки. Forge.play('glitch', { x, y, size, img, box, … }) — img: адрес или <img>
     (с чужого сервера — только с CORS), box — длинная сторона картинки в ед. эффекта (240). Настоящую картинку на время эффекта прятать:
     разовые эффекты начинаются и кончаются обычной картинкой (кроме «втянуть», «рассыпать» и hold: true — замереть на последнем кадре до stop) */
  const PR = [0, 0, 1, 1], P4 = [[0, 0], [0, 0], [0, 0], [0, 0]], Q4 = [[0, 0], [0, 0], [0, 0], [0, 0]], A4 = [0, 0, 0, 0], F22 = [22, 0, 0, 0];
  // картинка квадратом: fx = [22.вариант, сила, ход, частота]; m — запас за краями (глитч, волна выходят за картинку)
  function pic(c, x, y, w, h, fx, m, alpha, rot, tint){
    const cell = c.at.cell, cs = rot ? Math.cos(rot) : 1, sn = rot ? Math.sin(rot) : 0; m = m || 0; PR[0] = PR[1] = -m; PR[2] = PR[3] = 1 + m;
    quad(c, 0, cs * w / cell, sn * w / cell, -sn * h / cell, cs * h / cell, x, y, alpha == null ? 1 : alpha, 0, tint || null, 0, fx, PR);
  }
  // кусок картинки: треугольник/четырёхугольник по точкам P с местами в картинке Q (желе, осколки)
  const WHITE = [1, 1, 1], piece = (c, alpha) => quad4(c, P4, Q4, A4, alpha, 0, WHITE, F22);
  const IMGFX = (md, k, z, f) => { F22b[0] = 22 + md / 10; F22b[1] = k; F22b[2] = z; F22b[3] = f; return F22b; }, F22b = [22, 0, 0, 0];

  // глитч: в покое лёгкая рябь, раз в 0.5–1.6 с — срыв на 0.12–0.3 с (полосы рвутся, цвета разъезжаются)
  DEF.glitch = { atlas: 'aura', img: true,
    presets: { soft: { power: .35, base: .12 }, hard: { power: 1, base: .3, hz: 18 }, signal: { power: .8, base: .03, hz: 10 } },
    init(s){ const o = s.o; Object.assign(s, { pw: o.power ?? .6, base: o.base ?? .12, hz: o.hz ?? 14, next: .25, spk: 0, amp: 0, k: 0 }); },
    update(s, dt){ s.next -= dt; s.spk -= dt; if (s.next <= 0){ s.spk = R(.12, .3); s.amp = R(.6, 1) * s.pw; s.next = R(.5, 1.6); }
      s.k = s.base * s.pw + (s.spk > 0 ? s.amp : 0); },
    render(s, c){ pic(c, 180, 180, s.W, s.H, IMGFX(1, s.k, 0, s.hz), .14); } };

  // помехи: зерно, бегущая полоса, дрожь строк; сила плавно выходит на power
  DEF.static = { atlas: 'aura', img: true,
    presets: { weak: { power: .35 }, lost: { power: 1 } },
    init(s){ s.pw = s.o.power ?? .6; s.k = 0; },
    update(s, dt){ s.k += (s.pw - s.k) * Math.min(1, dt * 4); },
    render(s, c){ pic(c, 180, 180, s.W, s.H, IMGFX(2, s.k, 0, 0), .02); } };

  // стекло: картинка под скруглённым стеклом — преломление и радуга по краю, бегущий блик
  DEF.glass = { atlas: 'aura', img: true,
    presets: { clear: { power: .45 }, prism: { power: 1.3 } },
    init(s){ s.pw = s.o.power ?? .8; },
    update(){},
    render(s, c){ pic(c, 180, 180, s.W, s.H, IMGFX(3, s.pw, 0, s.o.phase || 0)); } };

  // изморозь: иней тает (thaw, по умолчанию) или нарастает (freeze — с hold, чтобы остаться замёрзшей)
  DEF.frost = { atlas: 'aura', img: true, period: 1.6,
    presets: { thaw: {}, freeze: { dir: 'in', hold: true } },
    init(){}, update(){},
    render(s, c){ const k = Math.min(1, s.cycle / 1.4), v = s.o.dir === 'in' ? easeOut(k) : 1 - easeOut(k); pic(c, 180, 180, s.W, s.H, IMGFX(4, v * (s.o.power ?? 1), 0, 0)); } };

  // волна от центра (тап, удар): фронт расходится, сила затухает
  DEF.ripple = { atlas: 'aura', img: true, period: 1.3,
    presets: { soft: { power: .6 }, strong: { power: 1.7 } },
    init(){}, update(){},
    render(s, c){ const t = s.cycle / 1.3; pic(c, 180, 180, s.W, s.H, IMGFX(5, (s.o.power ?? 1) * (1 - t) ** 1.5, easeOut(Math.min(1, s.cycle / 1.2)) * 1.1, 0), .05); } };

  // воронка: картинку закручивает и втягивает в точку (in) или она раскручивается из точки (out)
  DEF.twirl = { atlas: 'aura', img: true, period: 1.1,
    presets: { in: {}, out: { dir: 'out' } },
    init(){}, update(){},
    render(s, c){ let t = Math.min(1, s.cycle / 1.05); if (s.o.dir === 'out') t = 1 - t; const z = t ** 1.6;
      pic(c, 180, 180, s.W, s.H, IMGFX(6, z * 8, z, 0), 0, 1 - Math.max(0, (t - .75) / .25)); } };

  // линза: картинка вздувается и опадает (пульс выигрыша) или втягивается (pinch)
  DEF.lens = { atlas: 'aura', img: true, period: .7,
    presets: { bulge: {}, pinch: { power: -.5 } },
    init(){}, update(){},
    render(s, c){ const t = s.cycle / .7; pic(c, 180, 180, s.W, s.H, IMGFX(7, Math.sin(PI * Math.min(1, t)) * (s.o.power ?? .55), 0, 0)); } };

  // марево: дрожащий жар над огнём / раскалённым
  DEF.heat = { atlas: 'aura', img: true,
    presets: { soft: { power: .3 }, hot: { power: .8 } },
    init(s){ s.pw = s.o.power ?? .5; }, update(){},
    render(s, c){ pic(c, 180, 180, s.W, s.H, IMGFX(8, s.pw, 0, 0), .03); } };

  // пиксели: картинка распадается на крупные блоки и гаснет (out) или собирается из блоков (in)
  DEF.pixel = { atlas: 'aura', img: true, period: 1,
    presets: { out: {}, in: { dir: 'in' } },
    init(){}, update(){},
    render(s, c){ let t = Math.min(1, s.cycle / .95); if (s.o.dir === 'in') t = 1 - t; pic(c, 180, 180, s.W, s.H, IMGFX(9, t * t, 0, 0), 0, 1 - Math.max(0, (t - .7) / .3)); } };

  // желе: картинка сетью 8×8 приплющивается и пружинит — колебание бежит снизу вверх (верх отстаёт), ширина в противофазе
  DEF.jelly = { atlas: 'aura', img: true, period: 1.4,
    presets: { soft: { power: .6 }, bouncy: { power: 1.4 } },
    init(){}, update(){},
    render(s, c){ const G = 8, W = s.W, H = s.H, bot = 180 + H / 2, t = s.cycle, A = .2 * (s.o.power ?? 1);
      const osc = v => -A * Math.exp(-3.2 * t) * Math.cos(15 * t - (1 - v) * 1.1), X = (u, v) => 180 + (u - .5) * W * (1 - .7 * osc(v)), Y = v => bot - (1 - v) * H * (1 + osc(v));
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++){ const u0 = i / G, u1 = (i + 1) / G, v0 = j / G, v1 = (j + 1) / G, y0 = Y(v0), y1 = Y(v1);
        P4[0][0] = X(u0, v0); P4[0][1] = y0; P4[1][0] = X(u1, v0); P4[1][1] = y0; P4[2][0] = X(u1, v1); P4[2][1] = y1; P4[3][0] = X(u0, v1); P4[3][1] = y1;
        Q4[0][0] = u0; Q4[0][1] = v0; Q4[1][0] = u1; Q4[1][1] = v0; Q4[2][0] = u1; Q4[2][1] = v1; Q4[3][0] = u0; Q4[3][1] = v1; piece(c, 1); } } };

  // разбить стекло: трещины от точки удара (at — доля картинки) 0.18 с → вспышка → осколки-треугольники разлетаются, крутятся и падают
  DEF.shatter = { atlas: 'aura', img: true, period: 1.8,
    presets: { slow: { power: .6 } },
    init(s){ s.sh = null; s.cr = null; },
    update(s, dt){
      if (!s.sh){ const G = 6, at = s.o.at || [.5, .42], J = [], pt = (i, j) => J[j * (G + 1) + i]; s.sh = [];
        for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++){ const e = i === 0 || j === 0 || i === G || j === G; J.push([i / G + (e ? 0 : R(-.3, .3) / G), j / G + (e ? 0 : R(-.3, .3) / G)]); }
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++){ const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1), f = Math.random() < .5;
          for (const T of f ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]){ const cx = (T[0][0] + T[1][0] + T[2][0]) / 3, cy = (T[0][1] + T[1][1] + T[2][1]) / 3, dx = cx - at[0], dy = cy - at[1], l = Math.hypot(dx, dy) + .05;
            const v = R(110, 280) * (s.o.power ?? 1) * (.6 + .6 / (l + .3));
            s.sh.push({ T, cx, cy, x: 0, y: 0, vx: dx / l * v, vy: dy / l * v - R(60, 200), r: 0, vr: R(-7, 7), d: l * .12 }); } }
        s.cr = [.2, 1.3, 2.4, 3.6, 4.7, 5.6].flatMap(a => branch(at[0], at[1], at[0] + Math.cos(a + R(-.2, .2)) * R(.28, .4), at[1] + Math.sin(a + R(-.2, .2)) * R(.28, .4), .3, 3, 1, 1, [])); }
      if (s.cycle > .18) for (const p of s.sh){ const t = s.cycle - .18 - p.d; if (t < 0) continue; p.vy += 1000 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; } },
    render(s, c){ const W = s.W, H = s.H, x0 = 180 - W / 2, y0 = 180 - H / 2, t = s.cycle, G = c.at.map['glow:W0'];
      if (t < .18){ pic(c, 180, 180, W, H, IMGFX(0, 0, 0, 0)); const k = t / .18;
        // трещина: тонкая сплошная линия + мягкое свечение вокруг; растёт от точки удара
        const L = c.at.map['solid:W0'];
        for (const [pts, w, b] of s.cr){ const n = Math.max(2, Math.ceil(pts.length * Math.min(1, k * 1.6)));
          for (let i = 1; i < n; i++){ const ax = x0 + pts[i - 1][0] * W, ay = y0 + pts[i - 1][1] * H, bx = x0 + pts[i][0] * W, by = y0 + pts[i][1] * H;
            seg(c, ax, ay, bx, by, 10 * w, .35 * b, 1, G, [.8, .9, 1]); seg(c, ax, ay, bx, by, 1.6 * w, b, 1, L, [1, 1, 1]); } }
        return; }
      const k = (t - .18) / .3; if (k < 1) sprite(c, 180, 180, Math.max(W, H) * (.6 + k), 0, (1 - k) ** 3 * .45, 1, c.at.map['sglow:W0'], 1, [.85, .95, 1]);
      const fa = 1 - Math.max(0, (t - 1.2) / .6);
      for (const p of s.sh){ const cs = Math.cos(p.r), sn = Math.sin(p.r), cx = x0 + p.cx * W, cy = y0 + p.cy * H;
        for (let i = 0; i < 4; i++){ const v = p.T[Math.min(2, i)], lx = (v[0] - p.cx) * W, ly = (v[1] - p.cy) * H;
          P4[i][0] = cx + p.x + lx * cs - ly * sn; P4[i][1] = cy + p.y + lx * sn + ly * cs; Q4[i][0] = v[0]; Q4[i][1] = v[1]; }
        piece(c, fa); } } };

  Object.assign(k, { pic, piece, IMGFX, PR, P4, Q4, A4, WHITE });

  // смена обликов (по видео «Gauntlet: Glitched»): картинка мигает между обликами 12–15 раз в секунду, иногда держит 2–3 кадра;
  // часть кадров разрезана — верх в одном облике, низ в другом и сдвинут вбок, по линии разреза светлая кромка; на смене чуть подпрыгивает
  DEF.skinswap = { atlas: 'aura', img: true, presets: { calm: { fps: 8, split: .3 }, wild: { fps: 18, split: .7 }, neon: { styles: [1, 2, 5, 8] }, dark: { styles: [2, 7, 9] }, paper: { styles: [0, 4, 6, 10] } },
    // img — одна картинка, облики делает шейдер; imgs — массив картинок (до 8): каждая — свой облик, как в видео (styles тогда не нужны)
    init(s){ const o = s.o, n = Array.isArray(o.img) ? Math.min(8, o.img.length) : 0; Object.assign(s, { fps: o.fps || 13, split: o.split ?? .5, st: n ? Array.from({ length: n }, (_, i) => 20 + i) : o.styles || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], a: 0, b: 1, sp: 2, hold: 0, nx: 0, kick: 0 }); },
    update(s, dt){ s.nx -= dt; s.kick = Math.max(0, s.kick - dt * 8);
      if (s.nx <= 0){ const L = s.st, pick = () => L[(Math.random() * L.length) | 0]; let a = pick(); if (L.length > 1) while (a === s.a) a = pick();
        s.a = a; s.b = pick(); s.sp = Math.random() < s.split ? R(.25, .75) : 2; s.nx = (Math.random() < .25 ? R(2, 3) : 1) / s.fps; s.kick = 1; } },
    render(s, c){ const j = 1 + .035 * s.kick; pic(c, 180 + (Math.random() - .5) * 6 * s.kick, 180, s.W * j, s.H * j, [24.7, s.a, s.b, s.sp], .1); } };
});
