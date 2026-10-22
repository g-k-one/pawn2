/* Горн — пакет «classic»: классика — огонь, взрывы, порталы, молнии, ауры, раскрытия (атласы, режимы шейдера 2–18).
   Подключается после src/app/16e-forge.js: <script src="src/forge/classic.js">. В приложение не входит — только то, что нужно игре, живёт в ядре. */
Forge.pack('classic', k => {
  const { P0, R, PI, easeOut, spawn, step, fade, emit, seq, crv, quad, ribbon, wob, draw, BX, trail, seg, branch, zig, sprite, RAMP_ROW, DEF } = k;
  k.chunk(2,
    // 2 — туманность, 3 — нити: рисуются целиком из шума, без маски атласа (круглое мягкое пятно, цвет — из градиента)
    'if(vf.x>1.9){vec2 cc=vq*2.-1.;float rr=length(cc);float mk=smoothstep(1.,.45,rr);float t=tm*gp.z;' +
    'float n1=texture2D(nz,vq*.9+vec2(vf.w,0.)+vec2(t*.03,t*.02)).r;float n2=texture2D(nz,vq*1.6+vec2(0.,vf.w)-vec2(t*.025,-t*.035)).g;' +
    'vec2 w=vec2(n1,n2)-.5;float v;' +
    'if(vf.x<2.5){float n3=texture2D(nz,vq*1.3+w*.7+vec2(t*.02,-t*.015)).b;v=smoothstep(.3,.8,n3*.75+n1*.45-.12);float rd=1.-abs(n2*2.-1.);v+=pow(rd,7.)*.7;}' +
    'else{float n3=texture2D(nz,vq*1.15+w*.55+vec2(-t*.03,t*.02)).b;float rd=1.-abs(n3*2.-1.);v=pow(rd,20.)*1.2+pow(rd,4.)*.1;}' +
    'v*=mk*vf.z;float a=clamp(v,0.,1.)*va.x;vec3 col=texture2D(rp,vec2(clamp(v,0.,1.),RW)).rgb;gl_FragColor=vec4(col*vt*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(3,
    // 4 — лучи света веером (шум по углу), 5 — радужный обод (форма из атласа, цвет по углу и времени),
    // 6 — серп-взмах (дуга с утончёнными концами и белым ядром), 7 — поток внутри скруглённой кнопки (бегущие прожилки + блик)
    'if(vf.x>3.9){vec2 cc=vq*2.-1.;float r=length(cc);float an=atan(cc.y,cc.x);float t=tm*gp.z;vec3 col=vt;float a=0.;' +
    'if(vf.x<4.5){float n=texture2D(nz,vec2(an/6.2832*vf.y+t*.03+vf.w,.37)).r;float n2=texture2D(nz,vec2(an/6.2832*vf.y*2.-t*.05+vf.w,.71)).g;' +
    'a=pow(clamp(n*.6+n2*.5,0.,1.),3.)*2.2*(1.-smoothstep(.15,1.,r))*smoothstep(0.,.12,r)*vf.z;}' +
    'else if(vf.x<5.5){float m=texture2D(tx,vu).a;float h=fract(an/6.2832+t*.15+vf.w);col=mix(.5+.5*cos(6.2832*(h+vec3(0.,.33,.67))),vec3(1.),.3)*vt;a=m*vf.z;}' +
    'else if(vf.x<6.5){float f=max(vf.y,.01);float u=(an/(3.1416*f)+1.)*.5;float inA=step(0.,u)*step(u,1.);float th=vf.z*pow(max(sin(u*3.1416),0.),.8);' +
    'float d=abs(r-.72);float core=1.-smoothstep(th-.015,th+.005,d);float gl=exp(-max(d-th,0.)/.05)*.55*sin(clamp(u,0.,1.)*3.1416);a=max(core,gl)*inA;col=mix(vt,vec3(1.),core*smoothstep(th,0.,d)*.7);}' +
    'else if(vf.x<7.5){vec2 pp=(vq-.5)*vec2(vf.y,1.);vec2 hs=vec2(vf.y*.5,.5)-.42;float sd=length(max(abs(pp)-hs,0.))-.42;float mk=smoothstep(.01,-.02,sd);' +
    'float w1=texture2D(nz,vec2(vq.x*vf.y*.25-t*.12,vq.y*.3+.2)).r;float ln=pow(1.-abs(sin((vq.y+w1*.45)*7.+t*1.2)),9.)*.7;' +
    'float sw=exp(-pow((pp.x+pp.y*.6-(fract(t*.25+vf.w)*2.-1.)*(vf.y*.5+1.))*3.5,2.));a=(ln*.55+sw*.6)*mk*vf.z;col=mix(vt,vec3(1.),sw*.7+ln*.3);}' +
    // 8 — мультяшная форма: жёсткий край по порогу (растворение по шуму), 3 ступени цвета, тёмная обводка по краю
    'else if(vf.x<8.5){vec4 tc=texture2D(tx,vu);float m=tc.r*clamp(tc.a*4.,0.,1.);if(m<.004){gl_FragColor=vec4(0.);return;}float n=texture2D(nz,vq*.8+vec2(vf.w,t*.25)).b;float v=m+(n-.5)*.22;' +
    'float e=max(vf.y,.05);a=smoothstep(e,e+.02,v);float ol=1.-smoothstep(e+.05,e+.07,v);float x=clamp(v*vf.z,0.,1.);x=floor(x*3.+.5)/3.;' +
    'vec4 t2=texture2D(tx,clamp(vu+vec2(-.03,.06)*vc.zw,vc.xy,vc.xy+vc.zw));float sh=smoothstep(.04,.14,t2.r*clamp(t2.a*4.,0.,1.)-m);' +
    'col=texture2D(rp,vec2(x,RW)).rgb;col=mix(col,texture2D(rp,vec2(.15,RW)).rgb*.8,sh*.85);col=mix(col,texture2D(rp,vec2(0.,RW)).rgb*.6,ol)*vt;}' +
    // 9 — спираль-фон (два рукава, яркий центр), градиент — строка vf.w
    'else if(vf.x<9.5){float lr=log(max(r,.02));float sp=sin(an*vf.y+lr*4.5-t*2.);float x=clamp(1.15-r*.85+sp*.13,0.,1.);col=texture2D(rp,vec2(x,vf.w)).rgb;a=vf.z;}' +
    // 10 — хвост из точек (полутон): точки растут к голове (+x) и к оси хвоста; сетка vf.y × vf.w
    'else if(vf.x<10.5){vec2 gr=vec2(vf.y,vf.w);vec2 g=vq*gr;vec2 f=fract(g)-.5;vec2 id=(floor(g)+.5)/gr;float it=pow(id.x,1.6)*(1.-pow(abs(id.y*2.-1.),2.));' +
    'float rd=.48*it;float dt=smoothstep(rd,rd-.12,length(f));float gw=pow(vq.x,2.)*(1.-pow(abs(vq.y*2.-1.),1.5))*.45;a=max(dt*vf.z,gw);col=mix(vt,vec3(1.),dt*it*.5);}' +
    // 11 — правильный многоугольник: vf.y сторон, vf.z толщина (0 — залитый), vf.w поворот
    'else if(vf.x<12.5){float R=.62;float rr=r/R;float n=texture2D(nz,vec2(an/6.2832*2.+t*.04+vf.w,rr*.5-t*.12)).r;' +
    'float ln=pow(1.-abs(sin(rr*6.+n*7.-t*1.3)),5.)*smoothstep(1.,.35,rr);float fr=pow(clamp(rr,0.,1.),5.);' +
    'vec3 c1=mix(vt,vt*.4,ln*.85);c1=mix(c1,min(vt*1.2+.25,1.),step(.45,fr));c1=mix(c1,vec3(1.,.92,.78),step(.78,fr));' +
    'float ins=smoothstep(R+.008,R-.008,r);float gw=exp(-max(r-R,0.)/.05);a=max(ins,gw*.85);col=mix(mix(vt,vec3(1.,.85,.7),.6),c1,ins);}' +
    'else{float sg=6.2832/vf.y;float aa=mod(an+vf.w+sg*.5,sg)-sg*.5;float d=r*cos(aa)-.7;float cr;float gd;' +
    'if(vf.z<.001){cr=smoothstep(.015,-.015,d);gd=max(d,0.);}else{cr=smoothstep(vf.z,vf.z-.03,abs(d));gd=max(abs(d)-vf.z,0.);}a=max(cr,exp(-gd/.07)*.5);col=mix(vt,vec3(1.),cr*.6);}' +
    'a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(4,
    // 13 — лента хвоста: внутри бежит полоса (строка vf.y текстуры полос), к голове ярче и шире, белое ядро по оси
    'if(vf.x>12.9&&vf.x<13.5){float t=tm*gp.z;float ac=abs(vq.y*2.-1.);float tp=vq.x;float n=texture2D(nz,vec2(vc.x*.2-t*.3,vq.y*.5)).r;' +
    'vec2 su=vec2(vc.x*.32+t*vf.w,(vf.y+.08+clamp(vq.y+(n-.5)*.25*(1.-tp),0.,1.)*.84)/8.);float st=texture2D(sp,su).r;' +
    'float ed=smoothstep(1.,.5,ac);float core=exp(-ac*ac*14.)*pow(tp,1.6);float body=ed*pow(tp,1.1)*.45;float a=(st*ed*pow(tp,.45)*1.6+core*.75+body)*vf.z;' +
    'vec3 col=mix(vt,vec3(1.),clamp(core*1.1+st*st*.3,0.,1.));a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(5,
    // 14 — маска × бегущая полоса: силуэт стоит, внутри течёт рисунок (огонь вверх); vf.y — растворение, vf.z — жар, vf.w — строка полос
    'if(vf.x>13.9&&vf.x<14.5){float t=tm*gp.z;vec4 tc=texture2D(tx,vu);float m=tc.r*clamp(tc.a*4.,0.,1.);if(m<.004){gl_FragColor=vec4(0.);return;}' +
    'float n=texture2D(nz,vq*.7+vec2(vf.w*.37,t*.4)).g;float st=texture2D(sp,vec2(vq.y*.55+t*.55+vf.w*.21,(floor(vf.w)+.1+fract(vq.x+(n-.5)*.3)*.8)/8.)).r;' +
    'float v=m*(.62+st*.6)+(n-.5)*.12;float e=vf.y;float a=smoothstep(e,e+.05,v);float x=clamp(pow(v,.75)*vf.z,0.,1.);if(gp.x>0.){x=floor(x*gp.x+.5)/gp.x;}' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(6,
    // 15 — объёмное пламя из шума (принцип симуляций): одно сплошное тело, шум течёт вверх с искажением (domain warp),
    // к верху шума больше — пламя рвётся на языки; цвет — по «температуре» = яркость, которая падает с высотой.
    // vq.y=1 — низ. vf.y — ветер (изгиб к верху), vf.z — жар, vf.w — зерно
    'if(vf.x>14.9&&vf.x<15.5){float t=tm*gp.z;float h=1.-vq.y;float sd=vf.w;' +
    // за пределами возможного тела — сразу пусто, без чтения шума
    'if(abs(vq.x-.5-vf.y*h*h)>mix(.34,.08,pow(h,.75))+.22){gl_FragColor=vec4(0.);return;}' +
    // плазма внутри: шум q искажает шум w, w искажает основной — пламя течёт и закручивается, как жидкость (на экономе — одно искажение)
    'vec2 q=vec2(texture2D(nz,vec2(vq.x*.5+sd,vq.y*.4+t*.18)).g,texture2D(nz,vec2(vq.x*.5+sd+.31,vq.y*.4+t*.15)).b)-.5;if(lq>.5)q*=0.;' +
    'vec2 w=(vec2(texture2D(nz,vec2(vq.x*.7+sd,vq.y*.55+t*.3)+q*1.3).r,texture2D(nz,vec2(vq.x*.7+sd+.5,vq.y*.55+t*.26)+q*1.3).g)-.5)*2.;' +
    'float n=texture2D(nz,vec2(vq.x*1.3+sd,vq.y*1.1+t*.75)+w*.22).b*.55+texture2D(nz,vec2(vq.x*2.6+sd*1.7,vq.y*2.2+t*1.4)+w*.14).r*.3;' +
    // мелкая октава — только на полном качестве
    'n+=lq>.5?.075:texture2D(nz,vec2(vq.x*5.+sd*2.3,vq.y*4.4+t*2.4)).g*.15;' +
    'n=clamp((n-.5)*2.6,-1.,1.);' +
    'float md=floor(fract(vf.x+.001)*10.+.5);' +
    'float px=vq.x-.5+vf.y*h*h+w.x*.2*(.3+h);float wd=mix(.34,.06,pow(h,.85));' +
    'float shp=(1.-smoothstep(wd*.15,wd,abs(px)))*smoothstep(0.,md>1.5&&md<2.5?.4:.06,h)*(1.-smoothstep(.75,1.,h))*(1.-smoothstep(.4,.5,abs(vq.x-.5)));' +
    'float rg=1.-abs(n);float i=shp*(1.05-h*.4-n*(.3+h*1.25))+shp*rg*rg*h*.25-h*.06;i*=vf.z;' +
    'float a=md>2.5?smoothstep(.4,.8,i):smoothstep(.0,.24,i);' +
    // прожилки плазмы внутри тела: искажённый шум светлит/темнит пламя волнами, которые текут вверх и закручиваются
    'float pv=lq>.5?.5:texture2D(nz,vec2(vq.x*.9+sd*1.3,vq.y*.8+t*.42)+w*.55+q*1.2).r;float x=clamp(i*(.5+pv*.8),0.,1.);if(gp.x>0.){x=mix(x,floor(x*gp.x+.5)/gp.x,.55);}' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(7,
    // 16 — фрактал Жюлиа: z → z² + c, c медленно ходит по кругу (узор дышит и закручивается); цвет — по «скорости убегания»
    // и ловушке орбиты (как близко точка подходила к кругу) — даёт светящиеся нити. На экономном качестве — вдвое меньше шагов
    'if(vf.x>15.9&&vf.x<16.5){float t=tm*gp.z;vec2 p=(vq-.5)*2.;float rr=length(p);if(rr>1.){gl_FragColor=vec4(0.);return;}' +
    'float an=t*.21+vf.w;vec2 cc=vec2(-.745,.115)+.06*vec2(cos(an),sin(an*1.3));float ca=cos(t*.05),sa=sin(t*.05);vec2 z=mat2(ca,-sa,sa,ca)*p*1.25*vf.y;' +
    'float it=0.;float trap=9.;float N=lq>.5?14.:28.;for(int i=0;i<28;i++){if(float(i)>=N)break;z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+cc;trap=min(trap,abs(length(z)-.55));if(dot(z,z)>16.)break;it+=1.;}' +
    'float sm=it/N;float esc=step(it,N-.5);float gl=exp(-trap*22.);float v=clamp(esc*pow(sm,.7)*1.1+gl*.75,0.,1.);' +
    'float a=smoothstep(.08,.5,v)*smoothstep(1.,.6,rr)*vf.z;vec3 col=texture2D(rp,vec2(clamp(v*.95,0.,1.),RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(8,
    // 17 — плазма: шум, искажённый шумом, искажённым шумом (f(p + f(p + f(p)))) — течёт как жидкость; круглая маска
    'if(vf.x>16.9&&vf.x<17.5){float t=tm*gp.z;vec2 p=vq*1.4+vf.w;float rr=length(vq*2.-1.);if(rr>1.){gl_FragColor=vec4(0.);return;}' +
    'vec2 q=vec2(texture2D(nz,p*.5+vec2(t*.02,0.)).r,texture2D(nz,p*.5+vec2(.37,.11)-vec2(0.,t*.025)).g);' +
    'vec2 w=vec2(texture2D(nz,p*.5+q*.9+vec2(.17,.92)+t*.015).b,texture2D(nz,p*.5+q*.9+vec2(.83,.28)).r);' +
    'float f=texture2D(nz,p*.5+w*1.1+vec2(t*.01)).g;if(lq<.5){f=f*.75+texture2D(nz,p*1.3+w*.6).b*.25;}' +
    'float v=clamp((f*f*1.6+length(q)*.25+w.x*.35)*.72,0.,1.);float a=smoothstep(1.,.55,rr)*vf.z*(.45+v*.55);' +
    'vec3 col=mix(texture2D(rp,vec2(v,RW)).rgb,vt,clamp(length(w)*.6-.2,0.,.6));a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
  k.chunk(9,
    // 18 — плазма в форме: внутри маски (или круга) течёт шум, искажённый шумом, искажённым шумом; воронка — закручивает к центру
    // (быстрее у центра). vf.y — растворение (края рвутся по плазме), vf.z — жар, vf.w — зерно; цвет — градиент частицы
    'if(vf.x>17.9&&vf.x<18.6){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);float m;' +
    'if(md>3.5){m=smoothstep(1.,.62,length(vq*2.-1.));}else{vec4 tc=texture2D(tx,vu);m=tc.r*clamp(tc.a*4.,0.,1.);}' +
    'if(m<.004){gl_FragColor=vec4(0.);return;}' +
    'vec2 u=vq;vec2 fl=vec2(0.,t*.09);if(md>1.5&&md<2.5||md>4.5){vec2 c=vq-.5;float r=length(c);float an=atan(c.y,c.x)+t*.5+.55/(r+.12);u=vec2(cos(an),sin(an))*r+.5;fl=vec2(0.);}' +
    'vec2 pp=u*1.5+vf.w;' +
    'vec2 q=vec2(texture2D(nz,pp*.5+fl+vec2(t*.015,0.)).r,texture2D(nz,pp*.5+fl+vec2(.37,.11)-vec2(0.,t*.02)).g);' +
    'vec2 w=lq>.5?q:vec2(texture2D(nz,pp*.5+q*1.1+fl*1.3+vec2(.17,.92)).b,texture2D(nz,pp*.5+q*1.1+fl*1.3+vec2(.83,.28)).r);' +
    'float f=texture2D(nz,pp*.55+w*1.2+fl*1.6).g;float v=clamp((f*f*1.6+length(q)*.25+w.x*.35)*.8,0.,1.);' +
    'float e=vf.y;float a=smoothstep(e,e+.16,m*(.5+v*.75));float x=clamp(m*vf.z*(.4+v*.9),0.,1.);' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '');
const PL = (row, ero, heat, seed, md) => [18 + (md || 0), ero, heat, seed, RAMP_ROW[row]];   // плазма для sprite()
  // Костёр по приёмам стилизованного огня (LoL / Overwatch / мобильные): серые маски красит шейдер по температуре,
  // два слоя цвета — внешняя оболочка (красно-оранжевая) и ядро (жёлто-кремовое) теми же силуэтами поменьше;
  // язык рождается приплюснутым, вытягивается и сужается, гнётся по ветру скосом (основание стоит),
  // кончик колышет шум, к концу жизни язык рвётся по шуму (растворение) и остывает — краснеет.
  const FIRE_W = [[0, 1.3], [.3, 1], [.75, .8], [1, .6]], FIRE_H = [[0, .5], [.22, 1.05], [.7, 1.15], [1, 1.05]];
  DEF.portal = { atlas: 'portal',
    init: s => Object.assign(s, { wisps: [], tun: [], inP: [] }),
    update(s, dt, at){
      const CX = 180, CY = 180;
      emit(s.acc, 1, 2.6, dt, () => spawn(s.tun, { x: CX, y: CY, size: 300, grow: -.7, life: 1.5, rot: R(0, 6.28), vr: .6, cells: seq(at, 'sring', 'M3', 'M2', 'M1'), add: 1, alpha: .32, fadeIn: .35, fadeOut: .3 }));
      emit(s.acc, 2, 3, dt, () => s.wisps.push({ a: R(0, 6.28), r: 150, age: 0, life: R(1.1, 1.5), cell: at.map[Math.random() < .5 ? 'sswirl:M1' : 'sswirl:M2'] }));
      emit(s.acc, 3, 40, dt, () => { const a = R(0, 6.28);
        spawn(s.inP, { x: CX + Math.cos(a) * 160, y: CY + Math.sin(a) * 160, vx: -Math.sin(a) * 240 - Math.cos(a) * 40, vy: Math.cos(a) * 240 - Math.sin(a) * 40, size: R(18, 28), life: .9,
          cells: seq(at, 'spark', 'M3', 'M2', 'M1', 'M0'), add: 1, alpha: .9, orient: true, speedStretch: .0015, fadeIn: .2, fadeOut: .3 }); });
      // притяжение искр к центру (ближе — сильнее); у центра исчезают
      for (const p of s.inP){ const dx = CX - p.x, dy = CY - p.y, d = Math.max(Math.hypot(dx, dy), 8), g = 48000 / d;
        p.vx += dx / d * g * dt; p.vy += dy / d * g * dt; if (d < 30) p.age = Math.max(p.age, p.life * .75); }
      // завитки: угловая скорость растёт при сужении орбиты (как вода в воронке)
      s.wisps = s.wisps.filter(w => { w.age += dt; if (w.age >= w.life) return false; w.r = 150 * (1 - w.age / w.life) ** 1.3 + 20; w.a += (1.2 + 160 / w.r) * dt; return true; });
      step(s.tun, dt); step(s.inP, dt);
    },
    render(s, c){
      const at = c.at, CX = 180, CY = 180, t = s.t, pulse = 1 + .05 * Math.sin(t * 5);
      sprite(c, CX, CY, 380, 0, .5, 1, at.map['sglow:M2']);
      sprite(c, CX, CY, 330, t * .25, .5, 1, at.map['rune:M1']);
      // тёмное окно: свечение, перекрашенное почти в чёрный, обычным смешиванием
      sprite(c, CX, CY, 240 * pulse, 0, .95, 0, at.map['sglow:M2'], 1, [.16, .08, .3]);
      // плазменная воронка: жидкий фиолетовый вихрь закручивается к центру
      sprite(c, CX, CY, 250 * pulse, 0, 1, .25, 0, 1, null, 0, PL('portal', .05, .62, .4, .5));
      draw(c, s.tun);
      sprite(c, CX, CY, 250 * pulse, 0, .7, 1, at.map['sring:M1']);
      for (const w of s.wisps){ const k = w.age / w.life, al = Math.min(1, k / .2) * Math.min(1, (1 - k) / .35);
        sprite(c, CX + Math.cos(w.a) * w.r, CY + Math.sin(w.a) * w.r, 80 * (.5 + .5 * w.r / 170), w.a + 3.6, .8 * al, 1, w.cell); }
      draw(c, s.inP);
      sprite(c, CX, CY, 90 * pulse, 0, .35, 1, at.map['sglow:M0']);
      sprite(c, CX, CY, 60 * pulse, 0, .5, 1, at.map['sglow:M3']);
      for (let k = 0; k < 8; k++){ const ph = (t * .6 + k * .37) % 1, tw = Math.max(0, Math.sin(ph * PI)) ** 2, a = k * .785 + .3;
        if (tw > .02) sprite(c, CX + Math.cos(a) * (140 + k * 4), CY + Math.sin(a) * (140 + k * 4), 44 * tw, t, tw, 1, at.map['twinkle:M0']); }
    } };

  DEF.bolt = { atlas: 'bolt', period: 1.8,
    init: s => Object.assign(s, { fired: false, dust: [], sparks: [], jit: [] }),
    update(s, dt, at){
      const GX = 180, GY = 318;
      if (s.cycle >= 1.8){ s.cycle -= 1.8; s.fired = false; }
      if (!s.fired && s.cycle > .4){ s.fired = true;
        for (let i = 1; i <= 12; i++){ const side = i % 2 ? -1 : 1;
          spawn(s.dust, { x: GX + side * R(10, 30), y: GY - R(0, 12), vx: side * R(80, 220), vy: R(-60, -20), rot: R(0, 6.28), vr: R(-1, 1), size: R(50, 80), grow: .9, life: R(.8, 1.2),
            cells: seq(at, 'dust', 'D0', 'D1'), add: 0, alpha: .75, drag: 2.6, grav: -20, fadeIn: .05, fadeOut: .6 }); }
        for (let i = 0; i < 22; i++){ const a = -PI / 2 + R(-1.2, 1.2), sp = R(250, 520);
          spawn(s.sparks, { x: GX, y: GY - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(16, 26), life: R(.4, .7), cells: seq(at, 'spark', 'E0', 'E1'), add: 1, drag: 1.2, grav: 900, orient: true, speedStretch: .002, fadeIn: .02, fadeOut: .5 }); }
      }
      // дуги вокруг молнии — новые раз в кадр анимации (20 к/с), а не каждый кадр экрана
      const f = Math.floor((s.cycle - .4) / .05);
      if (f !== s.jf){ s.jf = f; s.jit = [0, 1, 2].map(() => [R(-40, 40), R(80, 280), R(70, 110), R(0, 6.28)]); s.cr = [R(-10, 10), R(0, 6.28)]; }
      step(s.dust, dt); step(s.sparks, dt);
    },
    render(s, c){
      const at = c.at, GX = 180, GY = 318, cy = s.cycle, pre = Math.min(1, cy / .4), after = Math.min(1, Math.max(0, 1 - (cy - .4) / 1));
      const back = [], top = [];
      back.push([GX, 20, 300, 0, .25 + .45 * pre * pre * (cy > .4 ? after : 1), 1, at.map['sglow:E2'], .6]);
      const t = cy - .4;
      if (t >= 0){
        const frame = Math.floor(t / .05), live = t < .32 && (frame < 4 || frame % 2 === 0);
        if (live){ const sx = frame % 3 === 1 ? -1 : 1, dx = (frame % 3 - 1) * 10;
          back.push([GX, GY / 2, 600, 0, .55, 1, at.map['sglow:E1'], 1.2]);
          top.push([GX + dx, GY / 2 + 10, 300 * sx, .1 * sx, .85, 1, at.map['bolt:E1'], 2 / sx]);
          top.push([GX + dx, GY / 2 + 10, 230 * sx, .1 * sx, 1, 1, at.map['bolt:E0'], 2.6 / sx]);
          s.jit.forEach((j, k) => top.push([GX + j[0], j[1], j[2], j[3], .8, 1, at.map[k % 2 ? 'arc:E1' : 'arc:E0']])); }
        if (t < .6){ const k = t / .6;
          back.push([GX, GY, 80 + 340 * easeOut(k), 0, (1 - k) * .9, 1, at.map['sring:E1'], .32]);
          back.push([GX, GY - 4, 220, 0, (1 - k) * .8, 1, at.map['ground:E1'], .6]);
          top.push([GX, GY - 20, 140 + 120 * k, 0, (1 - k) ** 2, 1, at.map['burst:E0']]);
          if (frame % 2 === 0) top.push([GX + s.cr[0], GY - 10, 110, s.cr[1], 1 - k, 1, at.map['crackle:E0']]); }
        if (t < .12) top.push([180, 180, 900, 0, .35 * (1 - t / .12), 1, at.map['sglow:E1']]);
      }
      back.forEach(a => sprite(c, ...a)); draw(c, s.dust); top.forEach(a => sprite(c, ...a)); draw(c, s.sparks);
    } };

  DEF.comets = { atlas: 'comets',
    launch: () => ({ x: R(-60, 120), y: R(-60, 20), vx: R(170, 260), vy: R(120, 200), hue: Math.random() < .6 ? 0 : 1 }),
    init(s){ Object.assign(s, { kom: [], trail: [], bits: [], hits: [] }); for (let i = 1; i <= 3; i++){ const k = this.launch(); k.x += i * 70; k.y += i * 40; s.kom.push(k); } },
    update(s, dt, at){
      const GROUND = 330;
      s.kom.forEach((k, i) => {
        k.vy += 160 * dt; const px = k.x, py = k.y; k.x += k.vx * dt; k.y += k.vy * dt;
        const glow = at.map[k.hue ? 'sglow:M2' : 'sglow:E1'];
        // штампы хвоста: по 3 на кадр вдоль пройденного отрезка — хвост не рвётся на любой скорости
        for (let j = 1; j <= 3; j++) spawn(s.trail, { x: px + (k.x - px) * j / 3, y: py + (k.y - py) * j / 3, size: 34, grow: -.8, life: .5, cells: [glow], add: 1, alpha: .45, fadeIn: .01, fadeOut: .9 });
        if (Math.random() < dt * 22) spawn(s.bits, { x: k.x + R(-6, 6), y: k.y + R(-6, 6), vx: -k.vx * .15 + R(-30, 30), vy: -k.vy * .15 + R(-30, 30), size: R(10, 18), life: R(.5, .8), vr: 3,
          cells: [at.map[Math.random() < .5 ? 'twinkle:W0' : 'dust:E2']], add: 1, alpha: .8, fadeIn: .1, fadeOut: .6 });
        if (k.y > GROUND - 6){ spawn(s.hits, { x: k.x, y: GROUND - 6, size: 70, grow: 1.6, life: .4, cells: [glow], add: 1, stretch: .45, fadeIn: .02, fadeOut: .8 }); s.kom[i] = this.launch(); }
      });
      for (const L of [s.trail, s.bits, s.hits]) step(L, dt);
    },
    render(s, c){
      const at = c.at;
      for (const L of [s.trail, s.bits, s.hits]) draw(c, L);
      for (const k of s.kom){
        sprite(c, k.x, k.y, 70, 0, .7, 1, at.map[k.hue ? 'sglow:M2' : 'sglow:E1']);
        sprite(c, k.x, k.y, 26, 0, 1, 1, at.map['sglow:E1']);
        draw(c, [Object.assign({}, P0, { x: k.x, y: k.y, vx: k.vx, vy: k.vy, size: 46, stretch: 1.3, age: .5, life: 1, cells: [at.map[k.hue ? 'spark:M2' : 'spark:E0']], fadeIn: 1e-4, fadeOut: 1e-4, orient: true })]);
      }
    } };

  /* ── ауры по видео-референсам (циклы для фона редкого предмета) ──
     белые маски атласа aura красим цветом частицы (tint), серые — шейдером по градиенту; туманность и нити — целиком из шума */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // 5. нити: светящиеся прожилки (гребни шума) двумя слоями навстречу — переплетаются, как плазма
  DEF.threads = { atlas: 'aura', gfx: { speed: .5, ramp: 'violet' },
    init(){}, update(){},
    render(s, c){
      const at = c.at, t = s.t;
      sprite(c, 180, 180, 320, 0, .35, 1, at.map['sglow:W0'], 1, [.2, .06, .5]);
      sprite(c, 180, 180, 310, t * .05, .8, 1, 0, 1, null, 0, [3, 0, .62, .3]);
      sprite(c, 180, 180, 270, -t * .07, .6, 1, 0, 1, null, 0, [3, 0, .55, 2.1]);
    } };

  // 6. туманность: облака шума с тёмными провалами и прожилками, поверх — звёздная пыль, всё медленно вращается
  DEF.nebula = { atlas: 'aura', gfx: { speed: .4, ramp: 'violet' },
    init(s){ s.dust = Array.from({ length: 140 }, () => ({ a: R(0, 6.28), d: Math.sqrt(Math.random()) * 130, s: R(2.5, 7), ph: R(0, 6.28), sp: R(1, 3) })); },
    update(){},
    render(s, c){
      const at = c.at, t = s.t;
      sprite(c, 180, 180, 360, t * .03, .85, .8, 0, 1, null, 0, [2, 0, .62, .7]);
      sprite(c, 180, 180, 300, -t * .05, .5, 1, 0, 1, null, 0, [2, 0, .5, 3.3]);
      for (const p of s.dust){ const a = p.a + t * .04;
        sprite(c, 180 + Math.cos(a) * p.d, 180 + Math.sin(a) * p.d, p.s * 2.4, 0, .35 + .35 * Math.sin(t * p.sp + p.ph), 1, at.map['glow:W0'], 1, [.6, .5, 1]); }
    } };

  /* ── по GIF-примерам (Clash Royale / Kitchen Masters / Misfitz): фазы и тайминг важнее числа частиц ── */
  // кнопка (как Kitchen Masters): внутри скруглённой кнопки бегут прожилки и проходит блик, мигают звёздочки;
  // квадрат 300×100 в центре — ставится поверх кнопки
  DEF.button = { atlas: 'aura', gfx: { speed: 1 },
    init: s => Object.assign(s, { tw: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 6, dt, () => spawn(s.tw, { x: 180 + R(-120, 120), y: 180 + R(-30, 30), size: R(10, 22), sc: [[0, 0], [.5, 1], [1, 0]], life: R(.5, .9), rot: R(0, 1),
        cells: [at.map['twinkle:W0']], add: 1, tint: [1, 1, .85], fadeIn: .01, fadeOut: .01 }));
      step(s.tw, dt);
    },
    render(s, c){ sprite(c, 180, 180, 300, 0, 1, 1, 0, 1 / 3, [.75, 1, .75], 0, [7, 3, 1, 0]); draw(c, s.tw); } };

  /* ── по второй пачке GIF (Misfitz, Bubble Busters, Clash, Squad Busters) ── */
  // спираль-фон (подбор соперника, Squad Busters): двухрукавная спираль из градиента крутится, палитра меняется раз в 3 с,
  // из центра летят на камеру предметы (растут и разгоняются — перспектива)
  const SW = ['sw_purple', 'sw_blue', 'sw_green', 'sw_yellow'];
  /* ── по Unity/Unreal-роликам: уровень «как в движке», но всё — несколько вызовов отрисовки ── */
  // гриб-взрыв (video-1-front): появляется за 2 кадра целиком — ножка и шапка из мультяшных клубов,
  // свет снизу (верхние края темнее), клубы медленно кипят; через ~1.6 с растворяется по шуму на клочья
  DEF.mushroom = { atlas: 'aura', period: 3.2, gfx: { speed: 1, ramp: 'boom' },
    init: s => Object.assign(s, { lobes: [], spk: [], emb: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 3.2){ s.cycle -= 3.2; s.fired = false; }
      if (!s.fired && s.cycle > .1){ s.fired = true;
        const L = [];
        for (let i = 0; i < 6; i++) L.push([R(-55, 55), 300 - R(0, 20), R(70, 95), 1.15]);          // подушка у земли
        for (let i = 0; i < 5; i++) L.push([R(-25, 25), 270 - i * 22, R(70, 90), 1.25]);           // ножка
        for (let i = 0; i < 9; i++) L.push([R(-80, 80), R(95, 165), R(85, 120), 1.05]);            // шапка
        L.forEach(([dx, y, sz, heat], i) => spawn(s.lobes, { x: 180 + dx, y, vx: dx * .1, vy: -R(8, 22), rot: R(-.5, .5), vr: R(-.4, .4), size: sz * 1.3,
          sc: [[0, .3], [.06, 1.05], [.6, 1.1], [1, 1.15]], life: R(2.1, 2.5), cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'puff:L'])]], mode: 8, add: 0, ph: i * .37,
          ero: [[0, .07], [.6, .1], [.8, .35], [1, .95]], heat: [[0, heat * 1.3], [.5, heat], [1, heat * .8]], fadeIn: .005, fadeOut: .02 }));
        for (let i = 0; i < 6; i++){ const a = -PI / 2 + (i < 3 ? -1 : 1) * R(.9, 1.4), sp = R(500, 800);
          spawn(s.spk, { x: 180, y: 290, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(40, 60), life: .3, drag: 6, orient: true, stretch: 2.5, cells: [at.map['shard:W0']], add: 1, tint: [1, .95, .6], fadeIn: .01, fadeOut: .5 }); }
      }
      if (s.cycle > .2 && s.cycle < 2) emit(s.acc, 1, 18, dt, () => spawn(s.emb, { x: 180 + R(-90, 90), y: R(150, 300), vx: R(-60, 60), vy: R(-140, -60), size: R(5, 9), life: R(.5, 1),
        cells: [at.map['glow:W0']], add: 1, tint: [1, .7, .3], fadeIn: .1, fadeOut: .5 }));
      for (const L of [s.lobes, s.spk, s.emb]) step(L, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle - .1;
      if (t > 0 && t < 2.2){ const k = Math.min(1, t / 2.2); sprite(c, 180, 305, 300 + 60 * k, 0, (1 - k) * .9, 1, at.map['sglow:W0'], .28, [1, .45, .15]); }
      if (t > 0 && t < .4){ const k = t / .4; sprite(c, 180, 300, 120 + 300 * easeOut(k), 0, 1 - k, 1, at.map['sring:W0'], .3, [1, .7, .3]); }
      draw(c, s.lobes); draw(c, s.spk); draw(c, s.emb);
    } };

  // извержение (kuny-az, Unreal): искры стягиваются по кругу на земле, загорается знак → по кольцу встают лучи света →
  // огненный выброс на весь кадр → смена цвета: бирюзовый столп, искры и обломки летят, по земле — светящиеся трещины,
  // бирюзовое кольцо-след и пыль медленно гаснут
  DEF.eruption = { atlas: 'aura', period: 3.8, gfx: { speed: 1.2, ramp: 'fire' },
    init: s => Object.assign(s, { inS: [], fire: [], tq: [], spk: [], deb: [], cracks: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 3.8){ s.cycle -= 3.8; s.fired = false; s.cracks = []; }
      const c = s.cycle, GX = 180, GY = 285;
      if (c < .9) emit(s.acc, 1, 30 + 60 * c, dt, () => { const a = R(0, 6.28);
        spawn(s.inS, { x: GX + Math.cos(a) * 130, y: GY + Math.sin(a) * 36, vx: -Math.cos(a) * 180, vy: -Math.sin(a) * 50, size: R(8, 16), life: .7, orient: true, stretch: 1.6,
          cells: [at.map['shard:W0']], add: 1, tint: [1, .65, .25], fadeIn: .2, fadeOut: .3 }); });
      if (!s.fired && c >= 1){ s.fired = true;
        for (let i = 0; i < 22; i++) spawn(s.fire, { x: GX + R(-60, 60), y: GY - R(0, 40), vx: R(-80, 80), vy: R(-650, -380), rot: R(-.3, .3), size: R(110, 160), life: R(.35, .55), drag: 2,
          cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'puff:L'])]], mode: 1.3, add: .45, stretch: 1.5, heat: [[0, 1.15], [1, .75]], ero: [[0, .02], [.6, .15], [1, .7]], fadeIn: .02, fadeOut: .3 });
        for (let i = 0; i < 16; i++) spawn(s.tq, { x: GX + R(-50, 50), y: GY - R(0, 30), vx: R(-40, 40), vy: R(-260, -140), rot: R(-.4, .4), vr: R(-.5, .5), size: R(110, 170), grow: .6, life: R(1, 1.6), age: -R(.15, .3),
          cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'swirl:L'])]], add: .9, alpha: .55, stretch: 1.3, tint: [.15, .85, .7], drag: 1.5, fadeIn: .15, fadeOut: .5 });
        for (let i = 0; i < 70; i++){ const a = -PI / 2 + R(-1.4, 1.4), sp = R(250, 700), teal = i % 3 === 0;
          spawn(s.spk, { x: GX + R(-20, 20), y: GY - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 20), life: R(.6, 1.4), drag: 1.2, grav: 700, orient: true, speedStretch: .003,
            cells: [at.map['shard:W0']], add: 1, tint: teal ? [.3, 1, .85] : [1, .7, .3], fadeIn: .02, fadeOut: .4 }); }
        for (let i = 0; i < 14; i++){ const a = -PI / 2 + R(-1.2, 1.2), sp = R(200, 450);
          spawn(s.deb, { x: GX, y: GY - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: R(0, 6), vr: R(-8, 8), size: R(8, 16), life: R(1, 1.6), grav: 900,
            cells: [at.map['shard:W0']], add: 0, alpha: .9, tint: [.18, .2, .2], fadeIn: .02, fadeOut: .2 }); }
        for (let i = 0; i < 7; i++){ const a = i / 7 * 6.28 + R(-.3, .3), L = R(80, 140);
          s.cracks.push(zig(GX, GY, GX + Math.cos(a) * L, GY + Math.sin(a) * L * .3, .5, 3)); }
      }
      for (const L of [s.inS, s.fire, s.tq, s.spk, s.deb]) step(L, dt);
      // обломки отскакивают от земли
      for (const p of s.deb) if (p.y > GY + 30 && p.vy > 0){ p.vy *= -.35; p.vx *= .6; p.vr *= .5; }
    },
    render(s, c){ const at = c.at, t = s.cycle, GX = 180, GY = 285, pre = Math.min(1, t / 1), post = t - 1;
      if (t < 1){
        sprite(c, GX, GY, 120 + 100 * pre, 0, .3 + .6 * pre, 1, at.map['sglow:W0'], .35, [1, .5, .2]);
        sprite(c, GX, GY, 100 + 80 * pre, 0, pre * pre, 1, at.map['star:W0'], .35, [1, .75, .4]);
        if (t > .45){ const k = (t - .45) / .55;
          sprite(c, GX, GY, 270, 0, k, 1, at.map['sring:W0'], .3, [1, .55, .2]);
          for (let i = 0; i < 10; i++){ const a = i / 10 * 6.28 + .3, bx = GX + Math.cos(a) * 125, by = GY + Math.sin(a) * 34, h = 260 * Math.min(1, k * 1.5 - i * .04);
            if (h > 0) seg(c, bx, by, bx, by - h, 34, .75 * k, 1, at.map['sglow:W0'], [1, .6, .25]); } }
      } else {
        const k = Math.min(1, post / 2.6);
        if (post < .25) sprite(c, GX, GY - 80, 700, 0, .6 * (1 - post / .25), 1, at.map['sglow:W0'], 1, [1, .75, .4]);
        sprite(c, GX, GY, 280 + 40 * k, 0, (1 - k) * .9, 1, at.map['sring:W0'], .3, [.2, 1, .8]);
        sprite(c, GX, GY, 200, 0, (1 - k) * .6, 0, at.map['sglow:W0'], .3, [.05, .12, .12]);
        const ca = Math.max(0, 1 - post / 1.6);
        if (ca > 0) for (const p of s.cracks) for (let i = 1; i < p.length; i++){
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 10, .5 * ca, 1, at.map['sglow:W0'], [.2, 1, .8]);
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 2, ca, 1, at.map['solid:W0'], [.7, 1, .95]); }
      }
      draw(c, s.inS); draw(c, s.tq); draw(c, s.fire); draw(c, s.deb); draw(c, s.spk);
    } };

  /* ── мультяшные маски с нарисованными ступенями света (fx-toon) ── */
  const TM = at => n => at.map[n + ':L'];
  // костёр: силуэт — рисованная раскадровка (4 кадра, 10 к/с), внутри течёт огненная полоса; вокруг языки живут
  // своей жизнью (растут, гнутся по ветру, остывают и рвутся по шуму), отрываются капли, летят угольки, сверху — дым
  DEF.firetoon = { atlas: 'toon', gfx: { bands: 4, dist: .12, speed: 1, ramp: 'fire' },
    init: s => Object.assign(s, { wind: 0, tg: [], dr: [], emb: [], sm: [], tw: [] }),
    update(s, dt, at){
      const m = TM(at), BX = 180, BY = 300, t = s.t, NEST = [-38, -14, 12, 36];
      s.wind = wob(t * .6, 1) * .6;
      const w = s.wind;
      emit(s.acc, 1, 7, dt, () => { const nx = NEST[Math.floor(Math.random() * 4)], cen = 1 - Math.abs(nx) / 60, size = R(110, 150) * (.7 + .4 * cen);
        spawn(s.tg, { bx: BX + nx + R(-6, 6), by: BY - 6, vy: R(-60, -35), size, life: R(.7, 1), cells: [m('ft' + (1 + Math.floor(Math.random() * 4)))], mode: 14, ph: 1 + Math.random() * .9,
          add: .3, sc: [[0, .25], [.2, 1], [.7, 1.05], [1, .8]], heat: [[0, 1.15], [.5, .95], [1, .7]], ero: [[0, .05], [.55, .1], [.85, .35], [1, .8]], fadeIn: .05, fadeOut: .1, pul: 0 }); });
      emit(s.acc, 2, 3.5, dt, () => spawn(s.dr, { x: BX + R(-30, 30) + w * 30, y: BY - R(120, 160), vx: R(-20, 20) + w * 40, vy: R(-120, -80), rot: R(-.3, .3), size: R(26, 42),
        sc: [[0, .5], [.2, 1], [1, .4]], life: R(.5, .8), cells: [m('fdrop')], mode: 1, add: .4, heat: [[0, 1.2], [1, .65]], ero: [[0, .05], [.6, .1], [1, .7]], fadeIn: .05, fadeOut: .2 }));
      emit(s.acc, 3, 6, dt, () => { const vx = R(-40, 40) + w * 50;
        spawn(s.emb, { x: BX + R(-40, 40), y: BY - R(30, 80), vx, vy: R(-220, -140), size: R(14, 22), life: R(.8, 1.4), cells: [m('fember')], mode: 1, add: .8, heat: [[0, 1.4], [1, .9]],
          orient: true, drag: .7, sway: 50, fadeIn: .05, fadeOut: .5 }); });
      emit(s.acc, 4, 1.4, dt, () => spawn(s.sm, { x: BX + R(-12, 12), y: BY - 205, vx: w * 25, vy: R(-45, -30), rot: R(-.3, .3), vr: R(-.3, .3), size: R(60, 80), grow: .8, life: 2.4,
        cells: [m(Math.random() < .5 ? 'fcurl' : 'tp' + (1 + Math.floor(Math.random() * 4)))], mode: 1.4, ramp: 'smoke', add: 0, alpha: .45, heat: [[0, .9], [1, .6]],
        ero: [[0, .3], [.3, .15], [.8, .35], [1, .9]], sway: 10, fadeIn: .3, fadeOut: .3 }));
      emit(s.acc, 5, 4, dt, () => spawn(s.tw, { x: BX + R(-60, 60), y: BY - R(60, 180), vx: R(-10, 10), vy: R(-50, -20), size: R(8, 14), sc: [[0, 0], [.5, 1], [1, 0]], life: R(.4, .7),
        cells: [at.map['twinkle:W0']], add: 1, tint: [1, .85, .5], fadeIn: .01, fadeOut: .01 }));
      for (const p of s.tg){ const k = Math.min(1, Math.max(0, p.age / p.life));
        p.by += p.vy * dt; p.bx += w * 60 * k * dt;
        p.x = p.bx; p.y = p.by - p.size * .36 * crv(p.sc, k); p.shear = -(w * .5 * (.3 + k) + wob(p.age * 2, p.ph * 7) * .12); p.rot = w * .05; }
      for (let i = s.tg.length; i--;){ const p = s.tg[i]; p.age += dt; if (p.age >= p.life){ s.tg[i] = s.tg[s.tg.length - 1]; s.tg.pop(); } }
      for (const L of [s.dr, s.emb, s.sm, s.tw]) step(L, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), BX = 180, BY = 300, t = s.t, w = s.wind;
      const fl = 1 + wob(t * 6, 2) * .06, fr = Math.floor(t * 10) % 4, fr2 = (fr + 2) % 4;
      sprite(c, BX + w * 14, BY - 100, 480 * fl, 0, .38, 1, at.map['sglow:W0'], 1.05, [1, .45, .15]);
      sprite(c, BX, BY + 6, 330 * fl, 0, .7, 1, at.map['sglow:W0'], .28, [1, .55, .2]);
      sprite(c, BX, BY - 4, 220 * (1 + wob(t * 4, 5) * .04), 0, 1, .6, m('fpool'), .55, null, 0, [1, 0, .9 + wob(t * 7, 3) * .12, 0]);
      draw(c, s.sm);
      // тело костра: раскадровка × бегущая полоса огня, два слоя (сзади — крупнее и холоднее)
      sprite(c, BX - 4 + w * 8, BY - 98, 270 * fl, w * .05, 1, .25, m('ff' + (fr2 + 1)), 1.1, null, 0, [14, .06, .72, 1.2]);
      for (const p of s.tg) if (p.size > 120) draw(c, [p]);
      sprite(c, BX + 3 + w * 10, BY - 82, 220 * fl, w * .07, 1, .35, m('ff' + (fr + 1)), 1.05, null, 0, [14, .08, .98, 1.55]);
      for (const p of s.tg) if (p.size <= 120) draw(c, [p]);
      draw(c, s.dr);
      sprite(c, BX, BY - 40, 150 * fl, 0, .35 + wob(t * 9, 4) * .08, 1, at.map['sglow:W0'], .7, [1, .85, .5]);
      draw(c, s.emb); draw(c, s.tw);
    } };

  // костёр по принципам симуляций: тело — три вложенных объёма пламени из шума (сзади крупный и холодный, спереди
  // маленький и горячий), шум течёт вверх, к макушке пламя рвётся на языки; цвет — по высоте и жару.
  // Живость: мерцание из трёх ритмов, порывы ветра гнут макушку, от верха отрываются языки, угольки — мягкие светящиеся
  // шарики с ореолом, сверху — тёмный дым, на земле дышит отсвет
  DEF.fire = { atlas: 'toon', gfx: { bands: 0, speed: .9, ramp: 'flame' },
    init: s => Object.assign(s, { wind: 0, gust: 0, wisps: [], emb: [], sm: [] }),
    update(s, dt, at){
      const BX = 180, BY = 312, t = s.t;
      s.wind = wob(t * .45, 1) * .16 + wob(t * 1.3, 6) * .04; s.gust = Math.max(0, wob(t * .7, 4));
      const w = s.wind;
      emit(s.acc, 2, 5, dt, () => { const big = Math.random() < .2;
        spawn(s.emb, { x: BX + R(-45, 45), y: BY - R(20, 140), vx: R(-25, 25) + w * 150, vy: R(-150, -60), size: big ? R(12, 18) : R(5, 10), life: R(1, 2.2), sway: R(15, 40),
          cells: [at.map['glow:W0']], add: 1, tint: Math.random() < .5 ? [1, .62, .25] : [1, .82, .45], fadeIn: .15, fadeOut: .5, pul: .25, pf: R(6, 14) }); });
      if (0) emit(s.acc, 3, 1.6, dt, () => spawn(s.sm, { x: BX + R(-15, 15) + w * 200, y: BY - 240, vx: w * 120, vy: R(-45, -30), size: R(80, 120), grow: 1.2, life: 2.6,
        cells: [at.map['sglow:W0']], add: 0, alpha: .32, tint: [.16, .08, .07], sway: 10, fadeIn: .4, fadeOut: .5, pul: 0 }));
      for (const p of s.emb) p.vx += w * 40 * dt;
      for (const L of [s.emb, s.sm]) step(L, dt);
    },
    render(s, c){
      const at = c.at, BX = 180, BY = 312, t = s.t, w = s.wind, g = s.gust;
      const fl = 1 + wob(t * 7, 2) * .05 + wob(t * 15, 3) * .03;
      sprite(c, BX + w * 40, BY - 130, 480 * fl, 0, .3, 1, at.map['sglow:W0'], 1.15, [1, .4, .12]);
      sprite(c, BX, BY + 4, 360 * fl, 0, .75, 1, at.map['sglow:W0'], .26, [1, .45, .14]);
      draw(c, s.sm);
      // объём пламени: квадрат size, растянут по высоте на sy, низ стоит на земле
      const vol = (S, sy, bend, heat, seed, add, dx, md) => sprite(c, BX + (dx || 0), BY + 6 - S * sy / 2, S, w * .25, 1, add, 0, sy, null, 0, [md || 15, bend, heat, seed]);
      vol(250, 1.15 + g * .12, w * 1.3, .95 * fl, .57, .55, 0);
      vol(150, 1 + g * .08, w * .8, 1.05 * fl, .91, .7, 0, 15.3);
      sprite(c, BX, BY - 22, 140 * fl, 0, .4, 1, at.map['sglow:W0'], .55, [1, .8, .45]);
      // угольки с ореолом
      for (const p of s.emb){ const k = p.age / p.life, a = Math.min(1, k / .15) * Math.min(1, (1 - k) / .5);
        sprite(c, p.x, p.y, p.size * 4, 0, .3 * a, 1, at.map['sglow:W0'], 1, p.tint); }
      draw(c, s.emb);
    } };

  // мультяшный взрыв: ожидание (ядро пульсирует всё чаще, плюётся искрами, дрожит) → кадр-звезда, тряска →
  // огненный шар из рисованных клубов с перелётом размера, вокруг с задержкой «хлопают» малые клубы;
  // цвет по остыванию: белый → жёлтый → оранжевый → красный, края рвутся по шуму → тёмный дым поднимается и тает;
  // ударное кольцо из клубов, серпы-обломки, угольки по баллистике, отсвет на земле
  DEF.toonboom = { atlas: 'toon', period: 2.9, gfx: { bands: 4, dist: .06, speed: 1, ramp: 'boom' },
    init: s => Object.assign(s, { pre: [], ball: [], sm: [], deb: [], emb: [], ring: [], fired: false }),
    update(s, dt, at){
      const m = TM(at), GX = 180, GY = 185, T = .9;
      if (s.cycle >= 2.9){ s.cycle -= 2.9; s.fired = false; }
      const c = s.cycle;
      if (c < T){ const k = c / T; s.shake = 1 + k * k * 4;
        emit(s.acc, 1, 6 + 26 * k, dt, () => { const a = R(0, 6.28), sp = R(80, 200);
          spawn(s.pre, { x: GX + Math.cos(a) * 14, y: GY + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, size: R(16, 26), life: R(.25, .45), grav: 300,
            cells: [m('fember')], mode: 1, add: .8, heat: [[0, 1.5], [1, 1]], orient: true, fadeIn: .05, fadeOut: .4 }); }); }
      if (!s.fired && c >= T){ s.fired = true; s.shake = 16;
        const ball = (x, y, size, delay, life, cell, vx, vy) => spawn(s.ball, { x, y, vx, vy, rot: R(-.4, .4), vr: R(-.5, .5), size, age: -delay, life, drag: 3.5, cells: [m(cell)], mode: 1, add: .15,
          sc: [[0, .3], [.07, 1.15], [.18, 1], [1, 1.1]], heat: [[0, 2.1], [.12, 1.6], [.35, 1.15], [.6, .95], [1, .8]], ero: [[0, 0], [.45, .05], [.65, .2], [.85, .5], [1, .95]], fadeIn: .01, fadeOut: .03, pul: .03, pf: 7 });
        ball(GX, GY, 300, 0, 1.15, 'tb' + (1 + Math.floor(Math.random() * 4)), 0, -10);
        for (let i = 0; i < 7; i++){ const a = i / 7 * 6.28 + R(-.3, .3), d = R(70, 110);
          ball(GX + Math.cos(a) * d * .6, GY + Math.sin(a) * d * .5, R(110, 160), R(.03, .16), R(.8, 1), 'tp' + (1 + i % 4), Math.cos(a) * 120, Math.sin(a) * 90 - 20); }
        for (let i = 0; i < 6; i++){ const a = R(-PI, 0), d = R(20, 70);
          spawn(s.sm, { x: GX + Math.cos(a) * d, y: GY + Math.sin(a) * d * .6, vx: R(-20, 20), vy: R(-70, -40), rot: R(0, 6.28), vr: R(-.4, .4), size: R(140, 200), grow: .4, age: -R(.45, .7), life: R(1.1, 1.5),
            cells: [m('tp' + (1 + i % 4))], mode: 1.3, ramp: 'smoke', add: 0, alpha: .9, heat: [[0, 1], [1, .8]], ero: [[0, .02], [.5, .1], [1, .9]], fadeIn: .15, fadeOut: .05 }); }
        spawn(s.ring, { x: GX, y: GY, size: 160, sc: [[0, .5], [1, 2.6]], life: .45, cells: [m('tring')], mode: 1, add: .5, heat: [[0, 1.6], [1, .9]], ero: [[0, 0], [.4, .1], [1, .8]], fadeIn: .01, fadeOut: .05, pul: 0 });
        for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + R(-.3, .3), sp = R(320, 480);
          spawn(s.deb, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: a + PI / 2, vr: R(-5, 5), size: R(60, 90), life: R(.45, .65), drag: 3.5, cells: [m('tcres')], mode: 1, add: .3,
            heat: [[0, 1.4], [1, .7]], ero: [[0, 0], [.4, .1], [1, .9]], fadeIn: .01, fadeOut: .05 }); }
        for (let i = 0; i < 28; i++){ const a = R(0, 6.28), sp = R(300, 700);
          spawn(s.emb, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, size: R(14, 26), life: R(.5, 1), drag: 1.8, grav: 700, cells: [m('fember')], mode: 1, add: .9,
            heat: [[0, 1.6], [1, .8]], orient: true, speedStretch: .002, fadeIn: .01, fadeOut: .4 }); }
      }
      for (const L of [s.pre, s.ball, s.sm, s.deb, s.emb, s.ring]) step(L, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), GX = 180, GY = 185, T = .9, t = s.cycle, p = t - T;
      if (t < T){ const k = t / T, pl = .5 + .5 * Math.sin(t * (10 + 40 * k));
        sprite(c, GX, GY, 150 + 90 * k, 0, (.3 + .5 * k) * (.6 + .4 * pl), 1, at.map['sglow:W0'], 1, [1, .35, .15]);
        sprite(c, GX, GY, (40 + 30 * k) * (1 + pl * .2), t * 3, .6 + .4 * k, 1, at.map['twinkle:W0'], 1, [1, .9, .6]); }
      if (p >= 0){ const k = Math.min(1, p / 1.6); sprite(c, GX, GY + 110, 380, 0, (1 - k) * .7, 1, at.map['sglow:W0'], .25, [1, .35, .1]); }
      draw(c, s.sm); draw(c, s.ring); draw(c, s.deb); draw(c, s.ball);
      if (p >= 0 && p < .12){ const q = p / .12;
        // кадр удара — тонкие лучи (форма 23.4 пакета hits), а не маски-плашки: те резались краем квадрата
        sprite(c, GX, GY, 420 + 120 * q, .4 * q, 1 - q * .3, 1, 0, 1, [1, .8, .45], 0, [23.4, .85, .2, 16.43]);
        sprite(c, GX, GY, 200, 0, 1 - q, 1, at.map['glow:W0'], 1, [1, .97, .9]); }
      if (p >= 0 && p < .2) sprite(c, 180, 180, 760, 0, .55 * (1 - p / .2), 1, at.map['sglow:W0'], 1, [1, .85, .6]);
      draw(c, s.emb); draw(c, s.pre);
    } };

  // снаряд (Bubble Busters): голова — горячее ядро, вокруг крутятся два серпа («зацикленный узор»), дышит свечение;
  // хвост — лента по следу полёта: внутри бегут полутоновые точки и световые штрихи, к голове шире и ярче;
  // раз в 1.6 с попадание: белый диск → звезда-шипы, кольцо-серп проворачивается, разлёт точек
  DEF.bubble = { atlas: 'toon', gfx: { speed: 1 },
    init: s => Object.assign(s, { trail: [], hits: [], sh: [], hp: 1.2, bx: 180, by: 180 }),
    update(s, dt, at){
      const t = s.t;
      s.bx = 180 + Math.sin(t * 1.25) * 125 + Math.sin(t * 3.1) * 8; s.by = 180 + Math.sin(t * 2.5) * 80;
      const l = s.trail[s.trail.length - 1];
      if (!l || Math.hypot(l[0] - s.bx, l[1] - s.by) > 7){ s.trail.push([s.bx, s.by]); if (s.trail.length > 40) s.trail.shift(); }
      emit(s.acc, 1, 16, dt, () => spawn(s.sh, { x: s.bx + R(-10, 10), y: s.by + R(-10, 10), vx: R(-30, 30), vy: R(-30, 30), size: R(8, 16), sc: [[0, 0], [.4, 1], [1, 0]], life: R(.3, .6),
        cells: [at.map[Math.random() < .5 ? 'twinkle:W0' : 'glow:W0']], add: 1, tint: [1, .9, .55], fadeIn: .01, fadeOut: .01 }));
      s.hp -= dt; if (s.hp <= 0){ s.hp = 1.6; s.shake = 6; spawn(s.hits, { x: s.bx, y: s.by, life: .6, size: 1, cells: [0], pul: 0 });
        for (let i = 0; i < 10; i++){ const a = R(0, 6.28), sp = R(150, 320);
          spawn(s.sh, { x: s.bx, y: s.by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 18), life: R(.35, .6), drag: 4, cells: [at.map['glow:W0']], add: 1, tint: [1, .85, .4], fadeIn: .01, fadeOut: .5 }); } }
      step(s.hits, dt); step(s.sh, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), t = s.t, pts = s.trail.concat([[s.bx, s.by]]), pl = 1 + wob(t * 5, 1) * .1;
      ribbon(c, pts, 30, 84, 1, .55, 1.6, [1, .45, .12], 1, .8);
      ribbon(c, pts, 26, 66, 2, 1.4, 1.2, [1, .72, .2], 1, .9);
      ribbon(c, pts, 6, 30, 0, 1, 2.4, [1, .92, .65], 1, 1);
      sprite(c, s.bx, s.by, 130 * pl, 0, .75, 1, at.map['sglow:W0'], 1, [1, .7, .2]);
      sprite(c, s.bx, s.by, 52, t * 9, .8, .8, 0, 1, [1, .85, .45], 0, [6, .5, .04, 0]);
      sprite(c, s.bx, s.by, 52, t * 9 + PI, .8, .8, 0, 1, [1, .85, .45], 0, [6, .5, .04, 0]);
      sprite(c, s.bx, s.by, 46 * pl, 0, 1, 1, at.map['glow:W0'], 1, [1, .97, .8]);
      draw(c, s.sh);
      for (const h of s.hits){ const k = h.age / h.life;
        if (k < .18) sprite(c, h.x, h.y, 70 + 140 * k / .18, 0, 1, 1, at.map['glow:W0'], 1, [1, 1, .9]);
        if (k < .4){ const q = k / .4; sprite(c, h.x, h.y, 90 + 90 * q, q, .8 * (1 - q), 1, m('tspikes'), 1, [1, .9, .4], 0, [1, 0, 1.4, 0]); }
        sprite(c, h.x, h.y, 100 + 110 * easeOut(k), k * 5, 1 - k, 1, 0, 1, [1, .85, .3], 0, [6, .8, .05 * (1 - k) + .01, 0]);
        sprite(c, h.x, h.y, 200 * (1 - k * .3), 0, (1 - k) * .5, 1, at.map['sglow:W0'], 1, [1, .7, .2]); }
    } };

  /* ── рамки аватара (Discord): эффект обнимает предмет, простой и зацикленный ── */
  // огненное кольцо: две ленты огня бегут по кругу навстречу (огонь течёт вдоль), языки срываются наружу по касательной,
  // по кругу летают два «спутника» (здесь гемы) с огненным хвостом, вокруг — тёплое свечение
  DEF.firering = { atlas: 'toon', gfx: { speed: 1, ramp: 'flame', bands: 4 },
    init: s => Object.assign(s, { emb: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 14, dt, () => { const a = R(0, 6.28), rr = R(112, 128);
        spawn(s.emb, { x: 180 + Math.cos(a) * rr, y: 180 + Math.sin(a) * rr, vx: -Math.sin(a) * 60 + Math.cos(a) * 30, vy: Math.cos(a) * 60 + Math.sin(a) * 30 - 20, size: R(4, 8), life: R(.4, .9),
          cells: [at.map['glow:W0']], add: 1, tint: [1, .7, .3], fadeIn: .1, fadeOut: .5, pul: .3, pf: 12 }); });
      step(s.emb, dt);
    },
    render(s, c){ const at = c.at, t = s.t, R0 = 120;
      sprite(c, 180, 180, 400, 0, .22, 1, at.map['sring:W0'], 1, [1, .4, .1]);
      const arc = (a0, len, w0, w1, row, sp, tint, al) => { const pts = []; for (let i = 0; i <= 24; i++){ const a = a0 + len * i / 24, rr = R0 + wob(t * 3 + i * .4, a0) * 5; pts.push([180 + Math.cos(a) * rr, 180 + Math.sin(a) * rr]); }
        ribbon(c, pts, w0, w1, row, 1, sp, tint, al, .8); };
      for (let k = 0; k < 2; k++){ const a0 = t * 1.6 + k * PI;
        arc(a0 - 2.9, 2.9, 10, 78, 1, 1.6, [1, .42, .1], 1);
        arc(a0 - 2.2, 2.2, 8, 48, 1, 2.2, [1, .7, .25], 1);
        arc(a0 - 1.4, 1.4, 4, 24, 0, 2.8, [1, .92, .6], .9); }
      for (let k = 0; k < 2; k++){ const a = t * 1.6 + k * PI, x = 180 + Math.cos(a) * R0, y = 180 + Math.sin(a) * R0;
        sprite(c, x, y, 90, 0, .7, 1, at.map['sglow:W0'], 1, [1, .5, .15]);
        sprite(c, x, y, 110 * (1 + wob(t * 4, k) * .06), Math.sin(t * 3 + k) * .3, 1, 0, at.map['gemP']); }
      draw(c, s.emb);
    } };

  /* ── фракталы: природная сложность из формулы (ветвление, самоподобие), почти без картинок ── */
  // ветвящаяся молния: нарастание (искры трещат у цели, небо светлеет) → удар (ствол + ветви, перерисовка 15 раз в секунду,
  // 3 вспышки-«перескока») → затухание (ветви гаснут раньше ствола, у земли кольцо и искры). Фокус — ствол, ветви вторичны
  DEF.fbolt = { atlas: 'aura', period: 2,
    init: s => Object.assign(s, { tree: [], jt: 0, sp: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 2){ s.cycle -= 2; s.fired = false; }
      const c = s.cycle, T = .45, GX = 180 + Math.sin(s.t * .7) * 30, GY = 320;
      s.jt -= dt;
      if (c > T && c < T + .55 && s.jt <= 0){ s.jt = 1 / 15; s.tree = branch(180 + R(-30, 30), -10, GX, GY, .42, 5, 3, 7, []); }
      if (c >= T + .55) s.tree = [];
      if (c < T) emit(s.acc, 1, 30, dt, () => { const a = R(-PI, 0), sp = R(40, 120);
        spawn(s.sp, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(6, 12), life: R(.15, .3), cells: [at.map['shard:W0']], add: 1, orient: true, stretch: 1.8, tint: [.7, .85, 1], fadeIn: .05, fadeOut: .5 }); });
      if (!s.fired && c >= T){ s.fired = true; s.shake = 8; s.gx = GX;
        for (let i = 0; i < 26; i++){ const a = -PI / 2 + R(-1.3, 1.3), sp = R(200, 480);
          spawn(s.sp, { x: GX, y: GY - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 18), life: R(.4, .7), drag: 1.2, grav: 900, cells: [at.map['shard:W0']], add: 1, orient: true, speedStretch: .002, tint: [.75, .9, 1], fadeIn: .02, fadeOut: .5 }); } }
      step(s.sp, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle, T = .45, p = t - T, GY = 320;
      sprite(c, 180, 0, 420, 0, .2 + .5 * Math.min(1, t / T) * (p < 0 ? 1 : Math.max(0, 1 - p)), 1, at.map['sglow:W0'], .5, [.35, .45, 1]);
      if (p >= 0 && p < .55){
        const fl = p < .06 || (p > .14 && p < .2) || (p > .28 && p < .32) ? 1 : .7;   // три «перескока» яркости
        const fade = Math.max(0, 1 - p / .55);
        for (const [pts, w, b] of s.tree){ const a = fl * (b > .9 ? Math.min(1, fade * 1.6) : fade * fade) * b;
          for (let i = 1; i < pts.length; i++){
            seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * 5, .45 * a, 1, at.map['sglow:W0'], [.45, .6, 1]);
            seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * .55 + .8, a, 1, at.map['solid:W0'], [.92, .96, 1]); } }
        if (p < .1) sprite(c, 180, 180, 760, 0, .45 * (1 - p / .1), 1, at.map['sglow:W0'], 1, [.7, .8, 1]);
        sprite(c, s.gx, GY, 160 + 200 * easeOut(p / .55), 0, fade, 1, at.map['ring:W0'], .3, [.6, .8, 1]);
        sprite(c, s.gx, GY - 6, 150, 0, fade, 1, at.map['sglow:W0'], .6, [.6, .75, 1]);
      }
      draw(c, s.sp);
    } };

  // аура Жюлиа: фрактал за предметом медленно закручивается и дышит (c ходит по кругу), светящиеся нити — ловушка орбиты;
  // сверху — мягкое ядро и редкие звёздочки по краю. Для Ультра/Джекпота: «бесконечная» глубина
  DEF.julia = { atlas: 'aura', gfx: { speed: 1, ramp: 'julia' },
    init: s => Object.assign(s, { st: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 5, dt, () => { const a = R(0, 6.28), d = R(100, 150);
        spawn(s.st, { x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d, size: R(14, 30), sc: [[0, 0], [.4, 1], [1, 0]], life: R(.5, .9), rot: R(0, 1), cells: [at.map['twinkle:W0']], add: 1, tint: [.75, .9, 1], fadeIn: .01, fadeOut: .01 }); });
      step(s.st, dt);
    },
    render(s, c){ const at = c.at, t = s.t, pl = 1 + wob(t * 1.3, 2) * .03;
      sprite(c, 180, 180, 380, 0, .45, 1, at.map['sglow:W0'], 1, [.25, .15, .7]);
      sprite(c, 180, 180, 340 * pl, 0, 1, .85, 0, 1, null, 0, [16, 1, 1, 0]);
      sprite(c, 180, 180, 120 * pl, 0, .5, 1, at.map['sglow:W0'], 1, [.6, .8, 1]);
      draw(c, s.st); } };

  // кристалл: из центра растёт снежинка-фрактал — 6 лучей, от каждого ветки под 60°, от веток — веточки (рисуем осколками);
  // рост по кривой с замедлением, по граням бежит блик, после роста кристалл дышит и мерцает; цикл — рост, жизнь, рассыпание
  DEF.crystal = { atlas: 'aura', period: 4,
    init(s){ s.sh = []; s.arm = []; const add = (x, y, a, len, d, t0) => { const n = 3; s.arm = s.arm || []; s.arm.push({ x, y, x1: x + Math.cos(a) * len, y1: y + Math.sin(a) * len, w: 2 + d * 2.5, t: t0, dur: .35 * (1 + (2 - d) * .3) });
        for (let i = 1; i <= n; i++){ const k = i / n, px = x + Math.cos(a) * len * k, py = y + Math.sin(a) * len * k;
        if (i === n || d === 0) s.sh.push({ x: px, y: py, a, size: len * .45 * (d ? .8 : 1.2), t: t0 + k * .35 * (1 + (2 - d) * .3), d });
        if (d > 0 && i > 1 && i < n) for (const sg of [-1, 1]) add(px, py, a + sg * 1.05, len * .42, d - 1, t0 + k * .35); } };
      for (let i = 0; i < 6; i++) add(180, 180, i / 6 * 6.28 - PI / 2, 120, 2, 0); s.burst = []; s.fired = false; },
    update(s, dt, at){ if (s.cycle >= 4){ s.cycle -= 4; s.fired = false; }
      if (!s.fired && s.cycle > 3.3){ s.fired = true; for (const p of s.sh) if (Math.random() < .6) spawn(s.burst, { x: p.x, y: p.y, vx: (p.x - 180) * R(.8, 1.6), vy: (p.y - 180) * R(.8, 1.6) + 30, rot: p.a, vr: R(-6, 6), size: p.size * .7, life: R(.4, .7), drag: 1.5, grav: 300, cells: [at.map['shard:W0']], add: .8, tint: [.6, .9, 1], fadeIn: .01, fadeOut: .5 }); }
      step(s.burst, dt); },
    render(s, c){ const at = c.at, t = s.cycle, out = t > 3.3 ? Math.max(0, 1 - (t - 3.3) / .2) : 1;
      sprite(c, 180, 180, 340, 0, .35 * out, 1, at.map['sglow:W0'], 1, [.3, .6, 1]);
      for (const a of s.arm){ const k = easeOut(Math.min(1, Math.max(0, (t - a.t) / a.dur))); if (k <= 0) continue; const x1 = a.x + (a.x1 - a.x) * k, y1 = a.y + (a.y1 - a.y) * k;
        const gl = Math.max(0, 1 - Math.abs(((t * .6) % 1.6) - Math.hypot(a.x - 180, a.y - 180) / 150) * 4);
        seg(c, a.x, a.y, x1, y1, a.w * 5, .35 * out, 1, at.map['sglow:W0'], [.35, .7, 1]);
        seg(c, a.x, a.y, x1, y1, a.w, out, 1, at.map['solid:W0'], [.6 + gl * .4, .9 + gl * .1, 1]); }
      for (const p of s.sh){ const k = easeOut(Math.min(1, Math.max(0, (t - p.t) / .3))); if (k <= 0) continue;
        const gl = Math.max(0, 1 - Math.abs(((t * .6) % 1.6) - Math.hypot(p.x - 180, p.y - 180) / 150) * 4);   // блик бежит от центра
        const tw = 1 + wob(s.t * 3, p.x * .1) * .1;
        sprite(c, p.x, p.y, p.size * k * 2.2, 0, .25 * out, 1, at.map['sglow:W0'], 1, [.4, .75, 1]);
        sprite(c, p.x, p.y, p.size * k * tw, p.a + PI / 2, out * (.75 + gl * .25), .9, at.map['shard:W0'], .45, [.55 + gl * .45, .85 + gl * .15, 1]); }
      sprite(c, 180, 180, 60 * (1 + wob(s.t * 2, 1) * .08), 0, out, 1, at.map['glow:W0'], 1, [.8, .95, 1]);
      draw(c, s.burst); } };

  // трещины от удара: из точки по земле растут ветвящиеся светящиеся трещины (фрактал), свет течёт по ним от центра,
  // из трещин бьют лучи и пыль, потом трещины остывают — тускнеют и краснеют
  DEF.cracks = { atlas: 'aura', period: 2.4,
    init: s => Object.assign(s, { tr: [], fired: false, dust: [] }),
    update(s, dt, at){ if (s.cycle >= 2.4){ s.cycle -= 2.4; s.fired = false; }
      if (!s.fired && s.cycle > .15){ s.fired = true; s.shake = 10; s.tr = [];
        for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + R(-.3, .3), L = R(110, 160); branch(180, 260, 180 + Math.cos(a) * L, 260 + Math.sin(a) * L * .38, .55, 4, 2, 5, s.tr); }
        for (let i = 0; i < 14; i++){ const a = R(0, 6.28), sp = R(80, 200);
          spawn(s.dust, { x: 180, y: 260, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .35 - 20, rot: R(0, 6), vr: R(-1, 1), size: R(50, 80), grow: .8, life: R(.8, 1.2), drag: 2.5, cells: [at.map['sglow:W0']], add: 0, alpha: .5, tint: [.5, .4, .35], fadeIn: .05, fadeOut: .6 }); } }
      step(s.dust, dt); },
    render(s, c){ const at = c.at, p = s.cycle - .15; if (p < 0) return;
      const grow = easeOut(Math.min(1, p / .35)), cool = Math.min(1, Math.max(0, (p - .5) / 1.5));
      const col = [1, .85 - cool * .5, .45 - cool * .35], a = 1 - Math.max(0, (p - 1.6) / .6);
      if (p < .3) sprite(c, 180, 255, 260 + 200 * p, 0, (1 - p / .3), 1, at.map['sglow:W0'], .45, [1, .8, .4]);
      draw(c, s.dust);
      for (const [pts, w, b] of s.tr){ const n = Math.max(1, Math.floor((pts.length - 1) * grow));
        for (let i = 1; i <= n; i++){
          seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * 4, .4 * a * b, 1, at.map['sglow:W0'], col);
          seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * .6 + .6, a * b, 1, at.map['solid:W0'], [1, .95 - cool * .4, .8 - cool * .6]); } }
      if (p < .6) for (let i = 0; i < 5; i++){ const x = 180 + Math.cos(i * 1.26) * 70 * grow, k = p / .6; seg(c, x, 260 + Math.sin(i * 1.26) * 25 * grow, x, 260 - 140 * k, 26, (1 - k) * .45, 1, at.map['sglow:W0'], [1, .8, .4]); }
    } };

  // плазма-сфера: жидкий узор из шума, искажённого шумом (тройное искажение) — переливается, как магма/туманность,
  // мягкий обод и свечение. Фон для наград
  DEF.plasma = { atlas: 'aura', gfx: { speed: 1, ramp: 'plasma' },
    init(){}, update(){},
    render(s, c){ const at = c.at, pl = 1 + wob(s.t * 1.1, 3) * .03;
      sprite(c, 180, 180, 400, 0, .45, 1, at.map['sglow:W0'], 1, [.6, .15, .5]);
      sprite(c, 180, 180, 300 * pl, 0, 1, .3, 0, 1, null, 0, [17, 0, 1, .3]);
      sprite(c, 180, 180, 300 * pl, 0, .8, 1, at.map['ring:W0'], 1, [1, .55, .7]);
      } };

  /* ── арена PvP: лёгкий туман и пыль по краю арены. Холст больше арены в 1.5 раза (край трибун — радиус ≈120 из 360):
     мягкие клубы дыма медленно плывут по кругу у трибун и за ними, рвутся по шуму и тают; в воздухе висит тёплая пыль.
     s.hot = 1 — последние 5 секунд: туман чуть гуще и теплее, плывёт быстрее; s.dense — множитель плотности (tab2 — гуще) */
  DEF.arena = { atlas: 'aura', gfx: { speed: .5, ramp: 'smoke' },
    puff(s, at, age){ const a = R(0, 6.28), r = R(128, 185);
      spawn(s.fog, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, a, r, rot: R(0, 6.28), vr: R(-.15, .15), size: R(110, 180), grow: .4, life: R(5, 8), age,
        cells: [0], mode: 18.4, ramp: 'haze', add: .12, alpha: R(.22, .38) * (s.dense || 1), heat: [[0, .9], [1, .75]], ero: [[0, .3], [.5, .18], [1, .4]], ph: R(0, 9), fadeIn: .3, fadeOut: .35, pul: 0 }); },
    init(s, at){ Object.assign(s, { fog: [], dust: [], hotK: 0 }); for (let i = 0; i < 16; i++) this.puff(s, at, R(0, 5)); },
    update(s, dt, at){
      s.hotK += ((s.hot ? 1 : 0) - s.hotK) * Math.min(1, dt * 2);
      emit(s.acc, 1, 2.2 + s.hotK * 1.5, dt, () => this.puff(s, at, 0));
      emit(s.acc, 2, 6, dt, () => { const a = R(0, 6.28), r = R(60, 175);
        spawn(s.dust, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: R(-6, 6), vy: R(-10, -2), size: R(3, 6), life: R(2, 4), sway: 4,
          cells: [at.map['glow:W0']], add: 1, alpha: R(.25, .55), tint: [1, .8, .55], fadeIn: .3, fadeOut: .4, pul: .2, pf: R(2, 5) }); });
      // клубы плывут по кругу (медленнее у края), чуть дышат по радиусу
      const w = (.05 + s.hotK * .06) * dt;
      for (const p of s.fog){ p.a += w * (150 / p.r); const rr = p.r + Math.sin(s.t * .3 + p.ph) * 4; p.x = 180 + Math.cos(p.a) * rr; p.y = 180 + Math.sin(p.a) * rr; p.age += dt; }
      for (let i = s.fog.length; i--;) if (s.fog[i].age >= s.fog[i].life){ s.fog[i] = s.fog[s.fog.length - 1]; s.fog.pop(); }
      step(s.dust, dt);
    },
    render(s, c){
      for (const p of s.fog) p.tint = [1, 1 - s.hotK * .15, 1 - s.hotK * .3]; draw(c, s.fog); draw(c, s.dust); } };

});
