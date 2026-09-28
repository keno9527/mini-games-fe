import json
from pathlib import Path
ROOT=Path(__file__).parent
specs=[
('一线收官',1,'D8 E8 F8 G8','C8 B2 D2 F2'),
('斜线补缺',1,'E5 F6 H8 I9','D4 B2 D2 F2'),
('两头难防',2,'G8 H8 I8','B2 D2 F2'),
('十字双杀',2,'F8 G8 I8 H6 H7 H9','E8 H5 B2 D2 F2 J2'),
('先守后攻',2,'C8 I8 J8 K8 H6 H7 H9','D8 E8 F8 G8 B2 D2 F2'),
('斜向双杀',2,'F6 G7 I9 F10 G9 I7','E5 E11 B2 D2 F2 J2')]
def parse(s):return {(ord(p[0])-65,int(p[1:])-1) for p in s.split()}
def name(p):return chr(65+p[0])+str(p[1]+1)
board={(x,y) for x in range(15) for y in range(15)}
windows=[]
for x,y in board:
 for dx,dy in [(1,0),(0,1),(1,1),(1,-1)]:
  w={(x+dx*k,y+dy*k) for k in range(5)}
  if w<=board: windows.append(w)
def win(a):return any(w<=a for w in windows)
def threats(a,b):
 out=set()
 for w in windows:
  missing=w-a
  if len(missing)==1 and not missing&b:out.update(missing)
 return out
levels=[]
for i,(title,limit,bs,ws) in enumerate(specs,1):
 b,w=parse(bs),parse(ws)
 assert len(b)==len(w) and not b&w and not win(b) and not win(w)
 answers=[]; branches={}
 for m in sorted(board-b-w):
  bm=b|{m}
  if win(bm):answers.append(name(m));continue
  if limit==1 or threats(w,bm) or len(threats(bm,w))<2:continue
  replies={}
  for r in board-bm-w:
   wr=w|{r}; finishes=threats(bm,wr)
   assert not win(wr) and finishes
   replies[name(r)]=sorted(map(name,finishes))
  answers.append(name(m));branches[name(m)]=replies
 level=dict(id=i,title=title,black=bs.split(),white=ws.split(),maxBlackMoves=limit,winningFirstMoves=answers,winningReplies=branches)
 assert answers
 levels.append(level)
 print(f'{i:02} {title}: {answers}; checked white replies={sum(map(len,branches.values()))}')
(ROOT/'levels.json').write_text(json.dumps(levels,ensure_ascii=False,indent=2)+'\n')
print('PASS: bounds, counts, occupancy, nonterminal start, exhaustive winning first moves and every defensive reply (up to 2 black moves).')
