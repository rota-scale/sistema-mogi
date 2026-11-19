import math,io,random,os,cairosvg
HERE=os.path.dirname(os.path.abspath(__file__))
from PIL import Image,ImageDraw,ImageFont
DG,LG,RD,CF,TR,YL,BG,CE='#1F4D2B','#3E7B3A','#B3261E','#4A2C1D','#8C3B2A','#E9B526','#F5F1E8','#3B6EA5'
NAVY='#1E3F8A'; INK='#14110F'
FP=os.environ.get('URBANIST_TTF','/usr/share/fonts/truetype/sand-box/google/Urbanist/Urbanist-VariableFont_wght.ttf')
def F(s,w=900):
    f=ImageFont.truetype(FP,int(s)); f.set_variation_by_axes([w]); return f
# ---------- icone losango 4 (caixa 1000)
def _P(c,*p): return '<polygon points="%s" fill="%s"/>'%(' '.join('%g,%g'%q for q in p),c)
def _C(x,y,r,c): return '<circle cx="%g" cy="%g" r="%g" fill="%s"/>'%(x,y,r,c)
def _leaf(x,y,L,ang,c):
    a=math.radians(ang); ex,ey=x+L*math.cos(a),y-L*math.sin(a); r=L*0.72
    return '<path d="M%g,%g A%g,%g 0 0,1 %g,%g A%g,%g 0 0,1 %g,%g Z" fill="%s"/>'%(x,y,r,r,ex,ey,r,r,x,y,c)
def icon_body():
    cx,cy,D=500,560,340; k=0.6
    return (_P(DG,(cx,cy-D),(cx+D,cy),(cx,cy+D),(cx-D,cy))+_P(YL,(cx,cy-D*k),(cx+D*k,cy),(cx,cy+D*k),(cx-D*k,cy))+_C(cx,cy,D*0.27,NAVY)+
        _leaf(cx,cy-D-40,175,135,DG)+_leaf(cx,cy-D-40,175,45,LG)+_C(cx,cy-D-2,52,RD))
# bbox do icone na caixa 1000: x 160..840, y ~50..900 -> centro visual (500,475)
def _wm_body():
    s=open(os.path.join(HERE,'mogi-wordmark.svg')).read()
    return s[s.index('<g'):s.rindex('</svg>')]
WM=_wm_body()   # caixa 1200x420, letras em x60..1140 y60..360 (1080x300)
class Canvas:
    def __init__(s,W,H,bg=BG): s.W,s.H=W,H; s.S=['<rect width="%d" height="%d" fill="%s"/>'%(W,H,bg)]; s.T=[]; s.img=[]
    def raw(s,x): s.S.append(x)
    def rect(s,x,y,w,h,c,rx=0): s.S.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s"/>'%(x,y,w,h,rx,c))
    def stroke_rect(s,x,y,w,h,c,sw,rx=0): s.S.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="none" stroke="%s" stroke-width="%g"/>'%(x,y,w,h,rx,c,sw))
    def circ(s,x,y,r,c): s.S.append(_C(x,y,r,c))
    def poly(s,c,*p): s.S.append(_P(c,*p))
    def path(s,d,c): s.S.append('<path d="%s" fill="%s"/>'%(d,c))
    def line(s,x1,y1,x2,y2,c,w,cap='round'): s.S.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g" stroke-linecap="%s"/>'%(x1,y1,x2,y2,c,w,cap))
    def icon(s,cx,cy,size):  # size = largura visual (~680 unidades)
        sc=size/680; s.S.append('<g transform="translate(%g,%g) scale(%g)">%s</g>'%(cx-500*sc,cy-475*sc,sc,icon_body()))
    def wordmark(s,x,y,w):   # w = largura das letras
        sc=w/1080; s.S.append('<g transform="translate(%g,%g) scale(%g)">%s</g>'%(x-60*sc,y-60*sc,sc,WM)); return 300*sc
    def text(s,x,y,t,sz,c,anchor='la',w=900): s.T.append((x,y,t,sz,c,anchor,w))
    def para(s,x,y,t,sz,c,maxw,lh=1.18,w=900):
        f=F(sz,w); words=t.split(); line=''; yy=y
        for wd in words:
            tt=(line+' '+wd).strip()
            if f.getlength(tt)>maxw and line: s.text(x,yy,line,sz,c,w=w); yy+=sz*lh; line=wd
            else: line=tt
        if line: s.text(x,yy,line,sz,c,w=w); yy+=sz*lh
        return yy
    def paste(s,im,x,y): s.img.append((im,x,y))
    def clip(s,x,y,w,h,body):
        i='c%d'%len(s.S); s.S.append('<defs><clipPath id="%s"><rect x="%g" y="%g" width="%g" height="%g"/></clipPath></defs><g clip-path="url(#%s)">%s</g>'%(i,x,y,w,h,i,body))
    def render(s):
        t='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">%s</svg>'%(s.W,s.H,s.W,s.H,''.join(s.S))
        im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=t.encode(),output_width=s.W))).convert('RGB')
        for (p,x,y) in s.img: im.paste(p,(int(x),int(y)),p if p.mode=='RGBA' else None)
        d=ImageDraw.Draw(im)
        for (x,y,t,sz,c,a,w) in s.T: d.text((x,y),t,font=F(sz,w),fill=c,anchor=a)
        return im
    def save(s,fn,q=93):
        im=s.render(); im.save(fn,quality=q) if fn.endswith('.jpg') else im.save(fn); return im
# ---------- padrao minhoca (truchet de arcos)
def worms(x0,y0,w,h,t,c,seed=1,sw=None):
    random.seed(seed); sw=sw or t*0.32; o=[]
    for i in range(int(w//t)+1):
        for j in range(int(h//t)+1):
            x,y=x0+i*t,y0+j*t; r=t/2
            if random.random()<.5:
                o.append('<path d="M%g,%g A%g,%g 0 0,0 %g,%g M%g,%g A%g,%g 0 0,0 %g,%g" fill="none" stroke="%s" stroke-width="%g" stroke-linecap="round"/>'%(x+r,y,r,r,x,y+r,x+t-r+r*0,y+t,r,r,x+t,y+r,c,sw))
            else:
                o.append('<path d="M%g,%g A%g,%g 0 0,1 %g,%g M%g,%g A%g,%g 0 0,1 %g,%g" fill="none" stroke="%s" stroke-width="%g" stroke-linecap="round"/>'%(x+r,y,r,r,x+t,y+r,x,y+r,r,r,x+r,y+t,c,sw))
    return ''.join(o)
def pattern(cv,x,y,w,h,t,c,bg,seed=1):
    cv.rect(x,y,w,h,bg); cv.clip(x,y,w,h,worms(x,y,w,h,t,c,seed))
# ---------- celulas decorativas
def bean(cv,x,y,rx,ry,c,k,ang=0):
    cv.raw('<g transform="translate(%g,%g) rotate(%g)"><ellipse rx="%g" ry="%g" fill="%s"/><rect x="%g" y="%g" width="%g" height="%g" fill="%s"/></g>'%(x,y,ang,rx,ry,c,-rx-2,-ry*0.09,2*rx+4,ry*0.18,k))
def leafpair(cv,x,y,L): cv.raw(_leaf(x,y,L,135,DG)+_leaf(x,y,L,45,LG))
def deco(cv,k,x,y,t,seed=0):
    k=k%9
    if k==0: cv.rect(x,y,t,t,YL); cv.path('M%g,%g L%g,%g A%g,%g 0 0,0 %g,%g Z'%(x,y+t,x+t,y+t,t,t,x,y),DG)
    elif k==1: cv.rect(x,y,t,t,RD); cv.circ(x+t/2,y+t/2,t*0.36,BG); cv.circ(x+t/2,y+t/2,t*0.14,RD)
    elif k==2: cv.rect(x,y,t,t,BG); cv.path('M%g,%g A%g,%g 0 0,1 %g,%g Z'%(x,y+t,t/2,t/2,x+t,y+t),CE)
    elif k==3: cv.rect(x,y,t,t,DG); bean(cv,x+t/2,y+t/2,t*0.3,t*0.38,CF,DG,0); 
    elif k==4: cv.rect(x,y,t,t,LG); cv.poly(YL,(x,y),(x+t,y),(x,y+t))
    elif k==5: pattern(cv,x,y,t,t,t/3,DG,BG,seed)
    elif k==6: cv.rect(x,y,t,t,TR); cv.poly(YL,(x+t/2,y+t*0.12),(x+t*0.88,y+t/2),(x+t/2,y+t*0.88),(x+t*0.12,y+t/2))
    elif k==7: cv.rect(x,y,t,t,CE); cv.path('M%g,%g L%g,%g A%g,%g 0 0,1 %g,%g Z'%(x,y,x+t,y,t,t,x,y+t),BG); 
    elif k==8: cv.rect(x,y,t,t,BG); leafpair(cv,x+t/2,y+t*0.8,t*0.55); cv.circ(x+t/2,y+t*0.8,t*0.1,RD)
def mosaic(cv,x,y,cols,rows,t,seed=0,skip=()):
    random.seed(seed); ks=list(range(9))
    for i in range(cols):
        for j in range(rows):
            if (i,j) in skip: continue
            deco(cv,random.choice(ks),x+i*t,y+j*t,t,seed+i*7+j)
PR={5:RD,4:TR,3:YL,2:LG,1:CE}
def pin(cv,x,y,r,c,n=None,tc=BG):
    cv.poly(c,(x-r*.87,y+r*.5),(x+r*.87,y+r*.5),(x,y+r*2)); cv.circ(x,y,r,c)
    if n: cv.text(x,y,str(n),r*1.2,tc,'mm')
def prio_bar(cv,x,y,p,sz=60,gap=10):
    for i in range(5):
        c=PR[i+1] if i+1<=p else '#E2D9C6'
        cv.rect(x+i*(sz+gap),y,sz,sz,c)
