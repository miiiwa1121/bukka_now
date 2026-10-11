# 長期時系列（主要品目の東京都区部小売価格 1950〜2010）を JSON 化
import sys, json, xlrd
wb = xlrd.open_workbook(sys.argv[1])
out = {}
for sh in wb.sheets()[:2]:
    for c in range(2, sh.ncols):
        code = str(sh.cell_value(5, c)).replace('.0', '').strip()
        name = str(sh.cell_value(6, c)).replace('\n', '').strip()
        sub = str(sh.cell_value(7, c)).replace('\n', '').strip()
        unit = str(sh.cell_value(9, c)).replace('\n', '').strip()
        if not code or not name:
            continue
        series = {}
        for r in range(11, sh.nrows):
            y = sh.cell_value(r, 1)
            v = sh.cell_value(r, c)
            if isinstance(y, float) and isinstance(v, float):
                series[int(y)] = v
        out[code] = {'name': name + sub, 'unit': unit, 'series': series}
# 品目名及び銘柄等の変遷
hist = {}
for sh in wb.sheets()[2:]:
    cur = None
    for r in range(3, sh.nrows):
        c0 = str(sh.cell_value(r, 0)).replace('.0', '').strip()
        txt = str(sh.cell_value(r, 1)).strip()
        if c0:
            cur = c0; hist[cur] = []
        if cur and txt:
            hist[cur].append(txt)
for k in out:
    out[k]['history'] = hist.get(k, [])
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(out))
