# e-Stat 年次一覧ページから「調査品目の月別価格及び年平均価格」の statInfId を抽出
import sys, re, html
s = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'stat-dataset_list-detail-item.*?</li>', s, re.S):
    blk = m.group(0)
    t = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', blk)))
    if '月別価格及び年平均価格' in t and '市町村銘柄' not in t:
        for i in sorted(set(re.findall(r'statInfId=(\d+)', blk))):
            print(i)
