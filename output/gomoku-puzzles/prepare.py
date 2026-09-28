exec(open('output/gomoku-puzzles/generate.py').read().split('found={')[0])
def bits(cs):return sum(1<<((int(c[1:])-1)*15+ord(c[0])-65) for c in cs)
base=[
('一线收官',1,'D8 E8 F8 G8','C8 B2 D2 F2','找到已经连成四子的横线。'),
('纵向突破',1,'H4 H5 H6 H7','H3 B2 D2 F2','沿竖线检查四连的空端。'),
('边角收束',1,'A1 B1 C1 D1','A2 C2 E2 G2','边界也是封锁，向棋盘内延伸。'),
('中间一子',1,'D10 E10 G10 H10','C10 B2 D2 F2','两段棋子之间，只差一个交点。'),
('斜线补缺',1,'E5 F6 H8 I9','D4 B2 D2 F2','沿左上到右下寻找断开的五连。'),
('抢先一步',1,'F8 G8 H8 I8','C3 D3 E3 F3','对手也有四连，但轮到你，可以先赢。'),
('两头难防',2,'G8 H8 I8','B2 D2 F2','将三连延长为两端都空的四连。'),
('跳三成四',2,'F8 H8 I8','B2 D2 F2','先补上跳三中间的空位。'),
('边线交叉',2,'A3 B3 D3 C1 C2 C4','K11 M11 K13 M13 K15 M15','在横竖交点同时造出两条冲四。'),
('十字双杀',2,'F8 G8 I8 H6 H7 H9','E8 H5 B2 D2 F2 J2','找到横线和竖线共用的空位。'),
('斜向双杀',2,'F6 G7 I9 F10 G9 I7','E5 E11 B2 D2 F2 J2','两条斜线的交点能同时制造威胁。'),
('先守后攻',2,'C8 I8 J8 K8 H6 H7 H9','D8 E8 F8 G8 B2 D2 F2','先堵住白棋唯一的成五点，同时发起反击。')]
alllevels=[]
for title,n,bs,ws,hint in base:
 b,w=bits(bs.split()),bits(ws.split());ans=solve(b,w,n,{})
 assert ans and not won(b) and not won(w)
 assert n==1 or not solve(b,w,n-1,{})
 alllevels.append(dict(title=title,moves=n,black=coords(b),white=coords(w),hint=hint,answers=coords(ans)))
names={3:['借势搭桥','横斜联动','补缺再攻','转角续杀','牵制两翼','三手定局'],4:['长线布局','折线追击','虚实交错','迂回取胜','攻守相连','四步锁局'],5:['深线破局','交叉连攻','层层推进','五步攻心','步步为营','终章连杀']}
for ns,items in json.load(open('output/gomoku-puzzles/generated.json')).items():
 n=int(ns)
 for k,l in enumerate(items):
  b,w=bits(l['black']),bits(l['white'])
  # Keep at least eight stones on each side; strip irrelevant pairs while preserving exact depth.
  changed=True
  while changed and b.bit_count()>8:
   changed=False
   for bp in coords(b):
    if changed:break
    for wp in coords(w):
     nb,nw=b^bits([bp]),w^bits([wp]);a=solve(nb,nw,n,{})
     if a.bit_count()==1 and not solve(nb,nw,n-1,{}):
      b,w=nb,nw;changed=True;break
  ans=solve(b,w,n,{})
  path=[];bb,ww=b,w
  for remaining in range(n,0,-1):
   m=solve(bb,ww,remaining,{});m &= -m;bb|=m
   if won(bb):path.append([coords(m)[0],None]);break
   ts=wins(bb,ww);reply=ts&-ts;ww|=reply;path.append([coords(m)[0],coords(reply)[0]])
  title=names[n][k]
  hint='每步都要形成冲四，迫使白棋封堵；留意落子后出现的新进攻方向。'
  alllevels.append(dict(title=title,moves=n,black=coords(b),white=coords(w),hint=hint,answers=coords(ans),path=path))
  print(n,title,len(coords(b)),path,flush=True)
Path('output/gomoku-puzzles/thirty.json').write_text(json.dumps(alllevels,ensure_ascii=False,indent=2))
