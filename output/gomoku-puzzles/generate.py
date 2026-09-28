import random,json,time
from pathlib import Path
random.seed(290928)
W=[]
for y in range(15):
 for x in range(15):
  for dx,dy in [(1,0),(0,1),(1,1),(1,-1)]:
   pts=[(x+dx*k,y+dy*k) for k in range(5)]
   if all(0<=a<15 and 0<=b<15 for a,b in pts):W.append(sum(1<<(b*15+a) for a,b in pts))
def wins(b,w):
 out=0
 for line in W:
  if not line&w and (line&b).bit_count()==4:out|=line&~b
 return out
def won(b):return any(line&b==line for line in W)
def solve(b,w,n,memo):
 key=(b,w,n)
 if key in memo:return memo[key]
 hits=wins(b,w)
 if hits: return hits
 if n<2:return 0
 defence=wins(w,b)
 if defence.bit_count()>1:return 0
 candidates=0
 for line in W:
  if not line&w and (line&b).bit_count()==3:candidates|=line&~b
 if defence:candidates &= defence
 out=0
 while candidates:
  m=candidates&-candidates;candidates-=m
  threats=wins(b|m,w)
  if threats.bit_count()>1:out|=m
  elif threats and solve(b|m,w|threats,n-1,memo):out|=m
 memo[key]=out
 return out
def coords(b):return [chr(i%15+65)+str(i//15+1) for i in range(225) if b>>i&1]
found={3:[],4:[],5:[]};start=time.time()
for trial in range(150000):
 pts=random.sample([y*15+x for y in range(3,12) for x in range(3,12)],random.randrange(24,43,2))
 half=len(pts)//2;b=sum(1<<i for i in pts[:half]);w=sum(1<<i for i in pts[half:])
 if won(b) or won(w) or wins(b,w) or wins(w,b).bit_count()>1:continue
 memo={}
 if solve(b,w,2,memo):continue
 for n in (3,4,5):
  ans=solve(b,w,n,memo)
  if not ans:continue
  if len(found[n])<6 and ans.bit_count()==1:
   found[n].append(dict(black=coords(b),white=coords(w),moves=n,answers=coords(ans)))
   print('FOUND',n,len(found[n]),'trial',trial,'secs',round(time.time()-start,1),flush=True)
   Path('output/gomoku-puzzles/generated.json').write_text(json.dumps(found,indent=2))
  break
 if all(len(a)==6 for a in found.values()):break
print({n:len(a) for n,a in found.items()},flush=True)
