import sys, re, html
s = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'stat-dataset_list-detail-item.*?</li>', s, re.S):
    blk = m.group(0)
    t = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', blk)))
    if '全国統一価格品目' in t:
        for i in sorted(set(re.findall(r'statInfId=(\d+)', blk))):
            print(i)
