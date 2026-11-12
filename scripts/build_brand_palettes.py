import csv,json,sys
src,out=sys.argv[1],sys.argv[2]
defs=[("artkal-s","Artkal S","Artkal","S 系列 5mm","Artkal_S.csv","官方 RGB 色卡，其中 5 色为社区值"),
      ("artkal-c","Artkal C","Artkal","C 系列 2.6mm","Artkal_C.csv","官方 RGB 色卡（社区整理）"),
      ("artkal-m","Artkal M","Artkal","M 系列 2.6mm","Artkal_M.csv","官方 RGB 色卡（社区整理）"),
      ("perler","Perler","Perler","Midi 5mm","Perler.csv","社区实测色值（maxcleme/beadcolors），少数为官方商品图估算"),
      ("hama","Hama","Hama","Midi 5mm","Hama.csv","社区实测色值（maxcleme/beadcolors）"),
      ("nabbi","Nabbi","Nabbi","5mm","Nabbi.csv","社区实测色值（maxcleme/beadcolors）")]
res=[]
for pid,label,brand,series,fn,src_label in defs:
  colors=[];seen=set();skipped=[]
  for r in csv.DictReader(open(f"{src}/{fn}",encoding="utf-8")):
    h=(r["hex"] or "").strip().upper()
    if len(h)!=7: skipped.append(r["code"]); continue
    if h in seen: skipped.append(r["code"]+"(dup)"); continue
    seen.add(h)
    fin=(r["finish"] or "").strip()
    if (r["transparency"] or "").strip()=="transparent" and fin in ("","solid"): fin="transparent"
    if fin=="solid": fin=""
    c={"code":r["code"].strip(),"hex":h}
    if r["display_name"].strip(): c["name"]=r["display_name"].strip()
    if fin: c["finish"]=fin
    if r["status"].strip() in ("存疑","estimated"): c["estimated"]=True
    colors.append(c)
  res.append({"id":pid,"label":label,"brand":brand,"series":series,"source":src_label,"colors":colors})
  print(pid,len(colors),"skipped",skipped)
json.dump(res,open(out,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
