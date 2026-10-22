/* Горн — пакет «glass»: стекло над картинкой — жидкое стекло, грани кристалла, лупа, дождь на стекле, протереть изморозь, призма; появление стеклянной карточки.
   Режим шейдера 25 (семья 16): картинка эффекта (img) смотрится через стекло. Подключается после ядра (пакет image не нужен). В приложение не входит. */
Forge.pack('glass', k => {
  const { R, PI, easeOut, quad, sprite, DEF } = k;
  // 25 — стекло: .0 грани кристалла (vf.y — граней на сторону, vf.z — где свет) · .1 жидкое стекло (vf.y — сила, vf.w — фаза блика) ·
  // .2 лупа (vf.y — радиус, vf.z/vf.w — центр) · .3 дождь на стекле (vf.y — сила) · .4 протереть изморозь (vf.y — ширина следа, vf.z — ход) · .5 призма (vf.y — сила)
  k.chunk(16,
    'if(vf.x>24.95&&vf.x<25.95){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);vec2 u=vq;float k=vf.y;vec4 c;vec3 ad=vec3(0.);' +
    // грани: ячейки Вороного, у каждой свой наклон — картинка в ней сдвинута и освещена по-своему, рёбра светятся
    'if(md<.5){vec2 q=u*vf.y;vec2 ip=floor(q);vec2 fp=fract(q);float d1=9.,d2=9.;vec2 mc=vec2(0.);' +
    'for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 h=vec2(H2(ip+o),H2(ip+o+17.3));vec2 d=o+h-fp;float dd=dot(d,d);if(dd<d1){d2=d1;d1=dd;mc=ip+o;}else if(dd<d2)d2=dd;}' +
    'float ed=sqrt(d2)-sqrt(d1);vec2 nr=vec2(H2(mc+3.1),H2(mc+7.7))-.5;vec2 su=u+nr*.07;c=IM(su);c.r=IM(su+nr*.012).r;c.b=IM(su-nr*.012).b;' +
    'float an=t*.7+vf.z;float lt=dot(normalize(vec3(nr*1.6,1.)),normalize(vec3(cos(an),sin(an),1.3)));c.rgb*=.78+.4*lt;float A0=max(c.a,IM(u).a);' +
    'ad=(vec3(smoothstep(.07,0.,ed))*.6+vec3(pow(max(lt,0.),20.))*.45)*A0;c.a=A0;}' +
    // жидкое стекло: скруглённая линза — в центре чуть увеличивает и размывает, к краю сильнее преломляет с радугой; сверху блик-кромка, снизу тень, по стеклу бежит отсвет
    'else if(md<1.5){vec2 p=u-.5;vec2 q=abs(p)-.5+.18;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.18;float ins=step(d,0.);float e=smoothstep(-.16,0.,d);vec2 nr=normalize(p+1e-4);' +
    'vec2 su=.5+p*(.92-.3*e*e*k);float r=.005*k;c=(IM(su)*2.+IM(su+vec2(r,0.))+IM(su-vec2(r,0.))+IM(su+vec2(0.,r))+IM(su-vec2(0.,r)))/6.;' +
    'c.r=IM(su+nr*e*e*.025*k).r;c.b=IM(su-nr*e*e*.025*k).b;c.rgb=mix(c.rgb,vt,.07);c.rgb*=1.-.22*smoothstep(0.,.45,p.y)*e;' +
    'float sp=smoothstep(.022,0.,abs(d+.028))*smoothstep(.15,-.35,p.y+p.x*.3);float sw=exp(-pow((p.x-p.y*.6)-(fract(t*.14+vf.w)*2.6-1.3),2.)*55.)*.22;' +
    'float rim=smoothstep(.012,0.,abs(d))*.55;ad=vec3(sp*.85+sw+rim)*ins;c.a=max(c.a,ins*.16);c*=ins;}' +
    // лупа: круг в точке (vf.z, vf.w) увеличивает с бочкой и радугой по краю, кромка светится, на стекле блик
    'else if(md<2.5){vec2 cp=vec2(vf.z,vf.w);vec2 d=u-cp;float r=length(d)/vf.y;c=IM(u);' +
    'if(r<1.){float z=1.-.42*(1.-r*r);vec2 su=cp+d*z;c=IM(su);c.r=IM(su+d*.05).r;c.b=IM(su-d*.05).b;float rm=smoothstep(.8,1.,r);' +
    'ad=vec3(rm*.35+pow(max(0.,dot(normalize(d+1e-4),vec2(-.6,-.8))),6.)*rm*.7);c.a=max(c.a,.22);}ad+=vec3(exp(-abs(r-1.)*45.)*.7);}' +
    // дождь на стекле: картинка за стеклом размыта и темнее, капли (два слоя, сползают) показывают её резкой и перевёрнутой, у капель светлая кромка
    'else if(md<3.5){float r=.012*k;vec4 bl=(IM(u+vec2(r,r))+IM(u-vec2(r,r))+IM(u+vec2(r,-r))+IM(u-vec2(r,-r)))*.25;c=bl;c.rgb*=.82;float dm=0.;' +
    'for(int L=0;L<2;L++){float sc=L==0?1.:1.9;vec2 g=u*vec2(7.,4.)*sc+float(L)*3.7;vec2 id=floor(g);vec2 f=fract(g)-.5;float h=H2(id);float sp=.04+.1*H2(id+5.);' +
    'f.y+=fract(t*sp+h)*1.4-.7;f.x-=(h-.5)*.5;float d=length(f*vec2(1.,1.35));float dr=smoothstep(.15,.12,d)*step(.25,H2(id+9.));' +
    'if(dr>dm){dm=dr;c=mix(c,IM(u-f*.16/sc),dr);ad=vec3((smoothstep(.15,.13,d)-smoothstep(.12,.09,d))*.4+smoothstep(.06,0.,length(f-vec2(-.04,-.05)))*.6)*dr*IM(u).a;}}' +
    'c.rgb=mix(c.rgb,vec3(.75,.85,.95)*c.a,.1*k);}' +
    // протереть изморозь: стекло в инее, палец проводит волной — след чистый, край следа рваный и с каплями
    'else if(md<4.5){float r=.03;vec4 fr=IM(u);for(int i=0;i<6;i++){float b=float(i)*1.047+H2(floor(u*90.))*.6;fr+=IM(u+vec2(cos(b),sin(b))*r);}fr/=7.;fr.rgb=mix(fr.rgb,vec3(.88,.94,1.)*fr.a,.32);' +
    'float dm=9.;for(int i=0;i<14;i++){float s=float(i)/13.*vf.z;vec2 pp=vec2(-.1+s*1.2,.5+.28*sin(s*8.5));dm=min(dm,length(u-pp));}' +
    'float n=texture2D(nz,u*3.).r;float cl=smoothstep(vf.y+.02,vf.y-.02,dm+(n-.5)*.05);c=mix(fr,IM(u),cl);ad=vec3(smoothstep(.02,0.,abs(dm+(n-.5)*.05-vf.y))*.45)*IM(u).a;}' +
    // призма: по стеклу ползут радужные полосы (дисперсия), в полосе цвета чуть разъезжаются
    'else{float x=u.x*.7+u.y*.5+(texture2D(nz,u*1.2+t*.02).r-.5)*.15-t*.12;float b=pow(abs(sin(x*6.2832*1.6)),14.);vec3 rb=.5+.5*cos(6.2832*(x*2.2+vec3(0.,.33,.67)));' +
    'c=IM(u);c.r=IM(u+vec2(b*.012*k,0.)).r;c.b=IM(u-vec2(b*.012*k,0.)).b;ad=rb*b*.5*k*c.a;}' +
    'float A=c.a*va.x;gl_FragColor=vec4(c.rgb*A+ad*va.x,max(A,0.)*(1.-va.y));return;}' +
    '');
  // картинка квадратом (как pic в пакете image, но свой, чтобы стекло не зависело от него)
  const PR = [0, 0, 1, 1];
  const glass = (c, s, md, y, z, w, m) => { const cell = c.at.cell; PR[0] = PR[1] = -(m || 0); PR[2] = PR[3] = 1 + (m || 0);
    quad(c, 0, s.W / cell, 0, 0, s.H / cell * (s.sq || 1), 180, 180, s.a ?? 1, 0, s.tint || null, 0, [25 + md / 10, y, z, w], PR); };
  const tints = { clear: { s: { tint: [1, 1, 1] } }, ice: { s: { tint: [.75, .9, 1] } }, rose: { s: { tint: [1, .8, .9] } }, amber: { s: { tint: [1, .88, .65] } } };

  DEF.liquidglass = { atlas: 'aura', img: true, presets: { ...tints, strong: { power: 1.8 } },
    init: s => { s.tint = s.tint || [.9, .95, 1]; }, update(){}, render(s, c){ glass(c, s, 1, s.o.power ?? 1, 0, 0); } };
  DEF.facets = { atlas: 'aura', img: true, presets: { fine: { cells: 9 }, coarse: { cells: 4 } },
    init(){}, update(){}, render(s, c){ glass(c, s, 0, s.o.cells || 6, 0, 0); } };
  // лупа гуляет по картинке восьмёркой
  DEF.magnifier = { atlas: 'aura', img: true, presets: { small: { r: .16 }, big: { r: .3 } },
    init(){}, update(){}, render(s, c){ const t = s.t * .6; glass(c, s, 2, s.o.r || .22, .5 + Math.sin(t) * .26, .5 + Math.sin(t * 2) * .18); } };
  DEF.rainglass = { atlas: 'aura', img: true, presets: { light: { power: .5 }, heavy: { power: 1.4 } },
    init(){}, update(){}, render(s, c){ glass(c, s, 3, s.o.power ?? 1, 0, 0); } };
  DEF.frostwipe = { atlas: 'aura', img: true, period: 1.8, presets: { thin: { w: .09 }, wide: { w: .18 } },
    init(){}, update(){}, render(s, c){ glass(c, s, 4, s.o.w || .13, easeOut(Math.min(1, s.cycle / 1.4)) * 1.05, 0); } };
  DEF.prism = { atlas: 'aura', img: true, presets: { soft: { power: .5 }, strong: { power: 1.5 } },
    init(){}, update(){}, render(s, c){ glass(c, s, 5, s.o.power ?? 1, 0, 0); } };
  // стеклянная карточка появляется: жидкое стекло выскакивает с перелётом, по нему проходит отсвет, вокруг — мягкое свечение
  DEF.glasspop = { atlas: 'aura', img: true, period: 1.2, presets: tints,
    init: s => { s.tint = s.tint || [.9, .95, 1]; }, update(){},
    render(s, c){ const t = s.cycle, k = Math.min(1, t / .35), sc = k < 1 ? easeOut(k) * (1 + .12 * Math.sin(k * PI)) : 1;
      if (t < .6) sprite(c, 180, 180, Math.max(s.W, s.H) * 1.5, 0, (1 - t / .6) ** 2 * .5, 1, c.at.map['sglow:W0'], 1, s.tint);
      const W = s.W, H = s.H; s.W = W * sc; s.H = H * sc; s.a = Math.min(1, t / .15); glass(c, s, 1, 1.2 - .4 * k, 0, -t * .9 + .3); s.W = W; s.H = H; } };
});
