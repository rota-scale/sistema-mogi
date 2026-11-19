import sys,json,math,random,io
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
import cairosvg
from PIL import Image,ImageDraw
from shapely.geometry import LineString,Polygon,MultiPolygon,box
from shapely.ops import unary_union,polygonize
OR='#D9822B'; PC={1:CE,2:LG,3:YL,4:OR,5:RD}
d=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'itamogi-osm.json')))
LAT0,LON0=-21.0785,-47.0436; KX=111320*math.cos(math.radians(LAT0)); KY=110540
def m(lat,lon): return ((lon-LON0)*KX,(lat-LAT0)*KY)
MAIN={'secondary','tertiary','secondary_link','primary','trunk'}
LOC={'residential','unclassified','living_street','pedestrian'}
roads={'main':[],'loc':[],'svc':[]}; parks=[]
for e in d['elements']:
    t=e.get('tags',{}); g=[m(p['lat'],p['lon']) for p in e.get('geometry',[])]
    if len(g)<2: continue
    h=t.get('highway')
    if h in MAIN: roads['main'].append(LineString(g))
    elif h in LOC: roads['loc'].append(LineString(g))
    elif h=='service': roads['svc'].append(LineString(g))
    elif (t.get('leisure') in ('park','recreation_ground','pitch') or t.get('landuse') in('grass','recreation_ground')) and len(g)>3 and g[0]==g[-1]:
        parks.append(Polygon(g))
ROI=box(-1400,-1400,1400,1400)
W={'main':7.5,'loc':5.5,'svc':3}
area={k:unary_union([l.buffer(W[k],cap_style=1,join_style=1) for l in v]).intersection(ROI) for k,v in roads.items()}
allroad=unary_union(list(area.values()))
blocks=[]
random.seed(3)
for p in polygonize(unary_union(roads['main']+roads['loc']+roads['svc'])):
    if p.area>60000: continue
    q=p.buffer(-9).buffer(-4).buffer(4)
    for g in (q.geoms if isinstance(q,MultiPolygon) else [q]):
        if g.area>150 and ROI.contains(g):
            # split big blocks into 2-4 houses via grid
            b=g.bounds; s=random.choice([28,34,40])
            xs=range(int(b[0]),int(b[2])+1,s)
            for x in xs:
                for y in range(int(b[1]),int(b[3])+1,s):
                    c=g.intersection(box(x+2.5,y+2.5,x+s-2.5,y+s-2.5))
                    for cc in (c.geoms if hasattr(c,'geoms') else [c]):
                        if isinstance(cc,Polygon) and cc.area>90:
                            blocks.append((cc.buffer(-1.5).buffer(1.5).simplify(0.8),random.choice([5,6,7,8,10])))
parks=[p.buffer(0) for p in parks if p.is_valid or True]
def hx(c): c=c.lstrip('#'); return tuple(int(c[i:i+2],16) for i in (0,2,4))
def mix(a,b,t): a,b=hx(a),hx(b); return '#%02x%02x%02x'%tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
SKY='#E6EEF2'
class Cam:
    def __init__(s,W,H,tx,ty,yaw,pitch,dist,fov):
        s.W,s.H=W,H;s.tx,s.ty=tx,ty;s.cy,s.sy=math.cos(math.radians(yaw)),math.sin(math.radians(yaw))
        p=math.radians(pitch);s.cp,s.sp=math.cos(p),math.sin(p);s.D=dist;s.f=W/2/math.tan(math.radians(fov/2))
    def cam(s,x,y,z=0):
        x,y=x-s.tx,y-s.ty; xr=x*s.cy-y*s.sy; yr=x*s.sy+y*s.cy
        ry=yr+s.D*s.cp; rz=z-s.D*s.sp
        zc=ry*s.cp-rz*s.sp; yc=ry*s.sp+rz*s.cp
        return xr,yc,zc
    def P(s,x,y,z=0):
        xr,yc,zc=s.cam(x,y,z); zc=max(zc,1)
        return s.W/2+s.f*xr/zc, s.H*0.42-s.f*yc/zc, zc
def fogt(z,c): return max(0,min(1,(z-c.D*0.9)/(c.D*2.2)))
def pstr(c,coords,z=0): return ' '.join('%.1f,%.1f'%c.P(x,y,z)[:2] for x,y in coords)
def gpath(c,g,z=0):
    out=''
    for p in (g.geoms if hasattr(g,'geoms') else [g]):
        if p.is_empty or not isinstance(p,Polygon): continue
        for r in [p.exterior]+list(p.interiors):
            out+='M'+pstr(c,list(r.coords),z).replace(' ',' L')+'Z'
    return out
# ---------- icones (caixa -1..1)
def icon_svg(kind,col):
    k={'buraco':'<ellipse cx="0" cy="0.15" rx="0.62" ry="0.34" fill="%s"/><ellipse cx="0" cy="0.08" rx="0.4" ry="0.18" fill="#FFFFFF" fill-opacity="0.35"/><path d="M-0.5,-0.35 L-0.2,-0.15 M0.45,-0.4 L0.2,-0.12" stroke="%s" stroke-width="0.12" stroke-linecap="round"/>'%(INK,INK),
       'poste':'<rect x="-0.07" y="-0.45" width="0.14" height="1.05" rx="0.05" fill="%s"/><path d="M-0.05,-0.45 Q0,-0.7 0.4,-0.62" stroke="%s" stroke-width="0.14" fill="none" stroke-linecap="round"/><ellipse cx="0.42" cy="-0.52" rx="0.2" ry="0.12" fill="%s"/><path d="M0.42,-0.35 L0.42,-0.12 M0.25,-0.32 L0.1,-0.15 M0.6,-0.32 L0.72,-0.15" stroke="%s" stroke-width="0.09" stroke-linecap="round"/>'%(INK,INK,col,col),
       'lixo':'<rect x="-0.5" y="-0.48" width="1" height="0.16" rx="0.06" fill="%s"/><rect x="-0.15" y="-0.62" width="0.3" height="0.14" rx="0.04" fill="%s"/><path d="M-0.4,-0.28 L0.4,-0.28 L0.32,0.62 L-0.32,0.62 Z" fill="%s"/><path d="M-0.13,-0.12 L-0.1,0.45 M0.13,-0.12 L0.1,0.45" stroke="#FFFFFF" stroke-width="0.09"/>'%(INK,INK,INK),
       'arvore':'<rect x="-0.08" y="0.05" width="0.16" height="0.6" fill="%s"/><circle cx="0" cy="-0.22" r="0.45" fill="%s"/><circle cx="-0.3" cy="0.02" r="0.27" fill="%s"/><circle cx="0.3" cy="0.02" r="0.27" fill="%s"/>'%(CF,LG,LG,LG),
       'agua':'<path d="M0,-0.7 C0.25,-0.3 0.5,0 0.5,0.22 A0.5,0.5 0 0,1 -0.5,0.22 C-0.5,0 -0.25,-0.3 0,-0.7 Z" fill="%s"/><path d="M-0.22,0.2 A0.25,0.25 0 0,0 0,0.45" stroke="#FFFFFF" stroke-width="0.1" fill="none" stroke-linecap="round"/>'%CE}
    return k[kind]
def balloon(x,y,s,col,kind):
    # base at (x,y); s = head radius px
    R=s; hy=y-R*2.05
    o='<g>'
    o+='<path d="M%g,%g C%g,%g %g,%g %g,%g A%g,%g 0 1,1 %g,%g C%g,%g %g,%g %g,%g Z" fill="%s" stroke="#FFFFFF" stroke-width="%g"/>'%(
        x,y, x-R*0.25,y-R*0.55, x-R*0.75,hy+R*0.85, x-R*0.82,hy+R*0.57, R,R, x+R*0.82,hy+R*0.57, x+R*0.75,hy+R*0.85, x+R*0.25,y-R*0.55, x,y, col,R*0.12)
    o+='<circle cx="%g" cy="%g" r="%g" fill="#FFFFFF"/>'%(x,hy,R*0.66)
    o+='<g transform="translate(%g,%g) scale(%g)">%s</g></g>'%(x,hy,R*0.5,icon_svg(kind,col))
    return o
def cluster(x,y,s,n,col):
    R=s;hy=y-R*1.9
    o='<path d="M%g,%g L%g,%g L%g,%g Z" fill="%s"/>'%(x,y,x-R*0.35,hy+R*0.8,x+R*0.35,hy+R*0.8,col)
    o+='<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#FFFFFF" stroke-width="%g"/>'%(x,hy,R,col,R*0.12)
    o+='<circle cx="%g" cy="%g" r="%g" fill="#FFFFFF"/>'%(x,hy,R*0.7)
    return o,(x,hy,R,n,col)
def ground_circle(c,x,y,r,n=28): return [(x+r*math.cos(2*math.pi*i/n),y+r*math.sin(2*math.pi*i/n)) for i in range(n)]
PAL=['#F4E3CF','#EADCC6','#F2E6C2','#E9DED3','#F3D9C4','#E4E2D0']
def render(c,pins,clusters,fn_png):
    Wd,Hd=c.W,c.H; S=[]
    hz=c.P(c.tx-c.sy*0+0,c.ty+60000,0)[1]
    S.append('<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D7E6EE"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'%'#F3EFE6')
    S.append('<rect width="%d" height="%d" fill="url(#sk)"/>'%(Wd,Hd))
    GR='#EFE8DA'
    S.append('<path d="%s" fill="%s"/>'%(gpath(c,box(-4000,-4000,4000,4000).intersection(Polygon([(c.tx+ (c.sy*0),c.ty)]*0 or [(-4000,-4000),(4000,-4000),(4000,4000),(-4000,4000)]))),GR))
    for p in parks:
        S.append('<path d="%s" fill="#CFE2B4"/>'%gpath(c,p))
    for k,(fill,ol,wo) in (('svc',('#FBF8F2','#D9D0C0',2)),('loc',('#FFFFFF','#D2C8B6',2.5)),('main',('#F8DE8E','#D7AE4E',3))):
        g=area[k]
        S.append('<path d="%s" fill="%s" fill-rule="nonzero"/>'%(gpath(c,g.buffer(wo)),ol))
        S.append('<path d="%s" fill="%s" fill-rule="nonzero"/>'%(gpath(c,g),fill))
    # pin ground shadows/rings
    for (x,y,p,kd) in pins:
        if p==5:
            S.append('<path d="M%sZ" fill="%s" fill-opacity="0.35"/>'%(pstr(c,ground_circle(c,x,y,30)).replace(' ',' L'),RD))
            S.append('<path d="M%sZ" fill="none" stroke="%s" stroke-opacity="0.8" stroke-width="5"/>'%(pstr(c,ground_circle(c,x,y,40)).replace(' ',' L'),RD))
        S.append('<path d="M%sZ" fill="#5A4A3A" fill-opacity="0.28"/>'%pstr(c,ground_circle(c,x,y,7)).replace(' ',' L'))
    # buildings far->near
    items=[]
    for g,h in blocks:
        ctr=g.centroid; z=c.cam(ctr.x,ctr.y)[2]
        if z<5: continue
        u,v,_=c.P(ctr.x,ctr.y)
        if -300<u<Wd+300 and -200<v<Hd+300: items.append((z,'b',g,h))
    for (x,y,p,kd) in pins: items.append((c.cam(x,y)[2]-6,'p',(x,y,p,kd),0))
    for cl in clusters: items.append((c.cam(cl[0],cl[1])[2]-6,'c',cl,0))
    items.sort(key=lambda t:-t[0]); labels=[]
    random.seed(9)
    for z,t,g,h in items:
        if t=='b':
            col=PAL[hash((round(g.centroid.x),round(g.centroid.y)))%len(PAL)]; ft=fogt(z,c)
            top=mix(col,'#F3EFE6',ft); side=mix(mix(col,'#8C6A55',0.28),'#F3EFE6',ft)
            co=list(g.exterior.coords); sides=[]
            for i in range(len(co)-1):
                a,b=co[i],co[i+1]; mz=c.cam((a[0]+b[0])/2,(a[1]+b[1])/2)[2]
                sides.append((mz,a,b))
            sides.sort(key=lambda s:-s[0])
            for _,a,b in sides:
                S.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="0.6"/>'%(pstr(c,[a,b])+' '+pstr(c,[b,a],h),side,side))
            S.append('<path d="%s" fill="%s" stroke="%s" stroke-width="1" stroke-opacity="0.5"/>'%(gpath(c,g,h),top,mix(top,'#FFFFFF',0.5)))
        elif t=='p':
            x,y,p,kd=g; u,v,zc=c.P(x,y); s=c.f*20/zc
            S.append(balloon(u,v,max(s,16),PC[p],kd))
        else:
            x,y,n,p=g; u,v,zc=c.P(x,y); s=c.f*26/zc
            o,lab=cluster(u,v,s,n,PC[p]); S.append(o); labels.append(lab)
    S.append('<defs><linearGradient id="fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3EDF1"/><stop offset="0.55" stop-color="#EEF1EC" stop-opacity="0.85"/><stop offset="1" stop-color="#F3EFE6" stop-opacity="0"/></linearGradient></defs><rect width="%d" height="%d" fill="url(#fd)"/>'%(Wd,Hd*0.26))
    svg='<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d">%s</svg>'%(Wd,Hd,''.join(S))
    im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGB')
    dr=ImageDraw.Draw(im)
    for x,y,R,n,col in labels: dr.text((x,y+R*0.04),str(n),font=F(R*1.0,900),fill=col,anchor='mm')
    return im
def pick_pins(c,n,seed,avoid,ncl=2):
    random.seed(seed); lines=roads['loc']+roads['main']; pts=[]
    for l in lines:
        for i in range(0,int(l.length),12):
            p=l.interpolate(i); u,v,z=c.P(p.x,p.y)
            if 90<u<c.W-90 and c.H*0.30<v<c.H-60 and z>0 and not avoid(u,v): pts.append((p.x,p.y,u,v,z))
    random.shuffle(pts); ch=[]
    def ok(q,dd): return all(math.hypot(q[2]-r[2],q[3]-r[3])>dd*(c.f*16/q[4])/30 for r in ch)
    for q in pts:
        if len(ch)>=n+ncl: break
        if ok(q,115): ch.append(q)
    kinds=['buraco','poste','lixo','arvore','agua']
    pr=[5,5,5,4,4,4,4,3,3,3,3,3,2,2,2,2,1,1,1,1,1,4,3,2]
    pins=[(q[0],q[1],pr[i%len(pr)],kinds[i%5]) for i,q in enumerate(ch[ncl:])]
    cls=[(ch[0][0],ch[0][1],7,5),(ch[1][0],ch[1][1],4,4)][:ncl]
    return pins,cls
