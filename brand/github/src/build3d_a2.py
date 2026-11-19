import sys,io,base64; import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from mapa3d import *
from PIL import ImageFilter
DK='#1F4D2B'; CT='#4A2C1D'; R=20
def shadow(im,rects):
    m=Image.new('L',im.size,0); d=ImageDraw.Draw(m)
    for x,y,w,h in rects: d.rounded_rectangle((x+2,y+7,x+w+2,y+h+7),R,fill=95)
    return Image.composite(Image.new('RGB',im.size,'#3A2A1E'),im,m.filter(ImageFilter.GaussianBlur(11)))
def card(cv,x,y,w,h,acc):
    cv.rect(x,y,w,h,'#FFFFFF',R)
    if acc: cv.rect(x+R+4,y+h-14,w-2*R-8,4,YL,2)
    cv.stroke_rect(x+1.75,y+1.75,w-3.5,h-3.5,DK,3.5,R-1.75)
def over(cv,acc):
    BX,BY,BW,BH=40,36,566,140
    card(cv,BX,BY,BW,BH,acc)
    cv.icon(BX+68,BY+BH/2+2,80)
    cv.wordmark(BX+132,BY+28,190)   # altura ~55.5
    cv.text(BX+131,BY+112,'Triagem urbana com IA · Itamogi-MG',23,DK,'ls',800)
    LX,LW=1004,236
    card(cv,LX,BY,LW,BH,acc)
    cv.text(LX+LW/2,BY+44,'Prioridade',22,CT,'mm',800)
    for i in range(1,6):
        cx=LX+34+(i-1)*42; cv.circ(cx,BY+90,17,PC[i]); cv.text(cx,BY+91,str(i),20,'#FFFFFF' if i!=3 else INK,'mm')
    return [(BX,BY,BW,BH),(LX,BY,LW,BH)]
c=Cam(2560,1280,60,120,-18,33,1250,50)
pins,cls=pick_pins(c,20,4,lambda u,v:(u/2<560 and v/2<290) or (u/2>1010 and v/2<200))
def bad(x,y):
    u,v,_=c.P(x,y); return u/2<640 and v/2<300
def nudge(x,y):
    best=None
    for l in roads['loc']+roads['main']:
        for i in range(0,int(l.length),6):
            p=l.interpolate(i)
            if bad(p.x,p.y): continue
            u,v,_=c.P(p.x,p.y); u0,v0,_=c.P(x,y)
            if v/2<300: continue
            dd=math.hypot(p.x-x,p.y-y)
            if dd<300 and all(math.hypot(c.P(q[0],q[1])[0]-u,c.P(q[0],q[1])[1]-v)>150 for q in pins if (q[0],q[1])!=(x,y)) and (best is None or dd<best[0]): best=(dd,p.x,p.y)
    return best[1:] if best else (x,y)
pins=[(*nudge(x,y),p,k) if bad(x,y) else (x,y,p,k) for x,y,p,k in pins]
base=render(c,pins,cls,None).resize((1280,640),Image.LANCZOS)
for name,acc in (('A2a',0),('A2b',1)):
    cv=Canvas(1280,640,BG); im=shadow(base,over(Canvas(1280,640),acc)); bb=io.BytesIO(); im.save(bb,'PNG')
    cv.raw('<image width="1280" height="640" href="data:image/png;base64,%s"/>'%base64.b64encode(bb.getvalue()).decode())
    over(cv,acc); o=cv.render(); o.save('social-preview-3d-%s.jpg'%name,quality=88); o.save('/tmp/%s.jpg'%name)
    o.resize((400,200),Image.LANCZOS).save('/tmp/%s-400.png'%name)
A=Image.open('social-preview-3d-A2a.jpg');B=Image.open('social-preview-3d-A2b.jpg')
C=Image.new('RGB',(2600,700),BG);C.paste(A,(10,50));C.paste(B,(1310,50));d=ImageDraw.Draw(C)
d.text((20,10),'A2a: cards brancos com contorno verde',font=F(30),fill=INK);d.text((1320,10),'A2b: contorno verde + filete amarelo',font=F(30),fill=INK)
C.save('comparativo-social-preview-3d-A2.jpg',quality=85)
t=Image.new('RGB',(810,200),'white');t.paste(Image.open('/tmp/A2a-400.png'),(0,0));t.paste(Image.open('/tmp/A2b-400.png'),(410,0));t.save('/tmp/a2thumb.png')
