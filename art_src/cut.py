import numpy as np, json
from PIL import Image, ImageDraw, ImageFilter
def matte(im):
    im=im.convert('RGB'); a=np.asarray(im).astype(int)
    white=((a.min(axis=2)>225)&(a.max(axis=2)-a.min(axis=2)<25)).astype(np.uint8)*255
    m=Image.fromarray(white,'L').copy(); w,h=m.size
    for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]+[(x,0) for x in range(0,w,40)]+[(x,h-1) for x in range(0,w,40)]+[(0,y) for y in range(0,h,40)]+[(w-1,y) for y in range(0,h,40)]:
        if m.getpixel((x,y))==255: ImageDraw.floodfill(m,(x,y),128)
    bg=(np.asarray(m)==128)
    alpha=Image.fromarray(np.where(bg,0,255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out=im.convert('RGBA'); out.putalpha(alpha); return out
def runs(proj,minlen=8,gap=6):
    on=proj>0; segs=[];s=None;g=0
    for i,v in enumerate(on):
        if v:
            if s is None:s=i
            g=0;e=i
        elif s is not None:
            g+=1
            if g>gap: segs.append((s,e));s=None
    if s is not None: segs.append((s,e))
    return [x for x in segs if x[1]-x[0]>minlen]
def split(img,rows):
    A=np.asarray(img)[:,:,3]>40; out=[]
    rs=runs(A.sum(1)>2) if rows>1 else [(0,A.shape[0]-1)]
    assert len(rs)==rows,(rs)
    for r0,r1 in rs:
        cs=runs(A[r0:r1+1].sum(0)>2,gap=10)
        for c0,c1 in cs:
            sub=A[r0:r1+1,c0:c1+1]; ys=np.where(sub.any(1))[0]
            out.append(img.crop((c0,r0+ys[0],c1+1,r0+ys[-1]+1)))
    return out
def grid(img,cols,rows,ycuts=None):
    A=np.asarray(img)[:,:,3]>40; Hh,Ww=A.shape; out=[]
    yc=ycuts or [Hh*i//rows for i in range(rows+1)]
    for r in range(rows):
        for c in range(cols):
            x0,x1=Ww*c//cols,Ww*(c+1)//cols; y0,y1=yc[r],yc[r+1]; sub=A[y0:y1,x0:x1]
            ys=np.where(sub.any(1))[0]; xs=np.where(sub.any(0))[0]
            cell=img.crop((x0,y0,x1,y1)); m=np.asarray(cell).copy(); 
            out.append(cell.crop((xs[0],ys[0],xs[-1]+1,ys[-1]+1)))
    return out
def holes(im):
    a=np.asarray(im).copy(); rgb=a[:,:,:3].astype(int); w=(rgb.min(2)>242)&(rgb.max(2)-rgb.min(2)<12); a[w,3]=0; return Image.fromarray(a)
def fit(im,mx):
    s=mx/max(im.size); return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)
frames={}
H=split(matte(Image.open('heroes.jpg')),1); print('heroes',len(H))
for n,i in zip(['david','deborah','gideon','samson'],H): frames[n]=fit(i,96)
for fn,ns in [('heroes2.jpg',['moses','elijah','esther','noah']),('heroes3.jpg',['franklite','washingtoon','lincolnlog','oakley'])]:
    HH=grid(matte(Image.open(fn)),4,1)
    for n,i in zip(ns,HH): frames[n]=fit(i,96)
E=Image.open('enemies.jpg').convert('RGB')
# remove the cross-like engraving on the armor bearer's shield (respect rule): blur shield interior
sw=E.width/1024; box=tuple(int(v*sw) for v in (728,292,800,500)); E.paste(E.crop(box).filter(ImageFilter.GaussianBlur(14)),box[:2])
En=grid(matte(E),3,2,[0,int(248*sw),E.height]); print('enemies',len(En))
for n,i in zip(['locust','frog','spearman','priest','golem','bearer'],En): frames[n]=fit(i,{'locust':64,'frog':60,'golem':96}.get(n,84))
def xcut(img,xs):
    A=np.asarray(img)[:,:,3]>40; out=[]; sc=img.width/1024
    for a,b in zip(xs,xs[1:]):
        a,b=int(a*sc),int(b*sc); sub=A[:,a:b]; ys=np.where(sub.any(1))[0]; xx=np.where(sub.any(0))[0]; out.append(img.crop((a+xx[0],ys[0],a+xx[-1]+1,ys[-1]+1)))
    return out
for fn,ns,xs in [('units1.jpg',['u_sword','u_shield','u_spear','u_archer'],[0,290,515,735,1024]),('units2.jpg',['u_horse','u_slinger','u_chariot','u_healer'],[0,312,505,840,1024])]:
    UU=xcut(matte(Image.open(fn)),xs)
    for n,i in zip(ns,UU): frames[n]=fit(i,96)
frames['froglet']=fit(frames['frog'],34)
frames['goliath']=fit(split(matte(Image.open('goliath.jpg')),1)[0],200)
TM=matte(Image.open('towers.jpg')); A=np.asarray(TM)[:,:,3]>40; Ww=A.shape[1]; cols=[]
for c in range(4):
    x0,x1=Ww*c//4,Ww*(c+1)//4; rs=runs(A[:,x0:x1].sum(1)>1,minlen=20,gap=4); rs=sorted(sorted(rs,key=lambda r:r[0]-r[1])[:3])
    items=[]
    for r0,r1 in rs:
        sub=A[r0:r1+1,x0:x1]; xs=np.where(sub.any(0))[0]; items.append(TM.crop((x0+xs[0],r0,x0+xs[-1]+1,r1+1)))
    cols.append(items)
T=[cols[k%4][k//4] for k in range(12)]; print('towers',len(T))
for k,i in enumerate(T): frames['t_'+['sling','altar','trumpet','cloud'][k%4]+str(k//4)]=fit(i,84)
for n in frames:
    if 'cloud' not in n: frames[n]=holes(frames[n])
# pack
names=sorted(frames,key=lambda n:-frames[n].height); W=1024;x=y=rowh=0;pos={}
for n in names:
    f=frames[n]
    if x+f.width>W: x=0;y+=rowh+2;rowh=0
    pos[n]=(x,y);x+=f.width+2;rowh=max(rowh,f.height)
atlas=Image.new('RGBA',(W,y+rowh)); js={'frames':{}}
for n,(px,py) in pos.items():
    f=frames[n]; atlas.paste(f,(px,py)); js['frames'][n]={'frame':{'x':px,'y':py,'w':f.width,'h':f.height},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':f.width,'h':f.height},'sourceSize':{'w':f.width,'h':f.height}}
js['meta']={'image':'sprites.png','size':{'w':W,'h':atlas.height},'scale':'1'}
atlas.save('../assets/sprites.png',optimize=True); json.dump(js,open('../assets/sprites.json','w'))
bg=Image.new('RGBA',atlas.size,(60,45,30,255)); bg.alpha_composite(atlas); bg.save('/tmp/atlas_preview.png'); print(atlas.size)
