"""Pack generated transparent sheets into exact, padded gameplay atlases.
Usage: python scripts/prepare-tidewatch-v2.py towers.png enemies.png terrain.png cover.png
Cropping/packing only; preserves generated pixel art and alpha.
"""
import sys,json
from pathlib import Path
from PIL import Image
import cv2
import numpy as np

out=Path('apps/web/assets/tidewatch');out.mkdir(parents=True,exist_ok=True)
rects={}
for source,name,cols,rows in [(sys.argv[1],'towers-v2',6,4),(sys.argv[2],'enemies-v2',4,4)]:
 im=Image.open(source).convert('RGBA');w,h=im.size
 assert im.getextrema()[3][0]==0,'Atlas must preserve actual transparency'
 sheet=Image.new('RGBA',(cols*192,rows*192));rects[name]=[]
 pixels=np.asarray(im).copy();n,labels,stats,centers=cv2.connectedComponentsWithStats((pixels[:,:,3]>60).astype('uint8'))
 objects=[]
 for label,(x,y,bw,bh,area) in enumerate(stats):
  if label==0 or area<3000:continue
  mask=cv2.dilate((labels==label).astype('uint8'),np.ones((5,5),np.uint8))
  cuts=[(int(x),int(y),int(x+bw),int(y+bh))]
  # A few touching glow effects connect neighbours. Split those at the narrowest seam.
  pieces=[]
  while cuts:
   l,t,r,b=cuts.pop()
   if r-l>1.55*w/cols:
    expected=round((l+r)/2);c=min(range(expected-40,expected+41),key=lambda q:int(mask[t:b,q].sum()));cuts.extend([(l,t,c,b),(c,t,r,b)])
   elif b-t>1.55*h/rows:
    expected=round((t+b)/2);c=min(range(expected-40,expected+41),key=lambda q:int(mask[q,l:r].sum()));cuts.extend([(l,t,r,c),(l,c,r,b)])
   else:pieces.append((l,t,r,b))
  for box in pieces:
   l,t,r,b=box;crop=pixels[t:b,l:r].copy();crop[:,:,3]=crop[:,:,3]*mask[t:b,l:r]
   tile=Image.fromarray(crop);bbox=tile.getbbox();assert bbox
   objects.append((box,tile.crop(bbox)))
 byrow=[[] for _ in range(rows)]
 for box,tile in objects:byrow[min(rows-1,int(((box[1]+box[3])/2)/h*rows))].append((box,tile))
 assert all(len(row)==cols for row in byrow),[len(row) for row in byrow]
 for y,row in enumerate(byrow):
  for x,(box,tile) in enumerate(sorted(row,key=lambda z:z[0][0])):
   tile.thumbnail((174,174),Image.Resampling.LANCZOS)
   sheet.alpha_composite(tile,(x*192+(192-tile.width)//2,y*192+(192-tile.height)//2))
   rects[name].append({'frame':y*cols+x,'source':box})
 sheet.save(out/(name+'.png'),optimize=True)
for source,name,size in [(sys.argv[3],'island-v2.webp',(1000,800)),(sys.argv[4],'cover-v2.webp',(960,640))]:
 im=Image.open(source).convert('RGB');im=im.resize(size,Image.Resampling.LANCZOS);im.save(out/name,quality=88,method=6)
Path('assets/tidewatch/packing-v2.json').write_text(json.dumps(rects,indent=2),encoding='utf8')
print('Packed 24 towers, 16 enemy/reward sprites, terrain and cover.')
