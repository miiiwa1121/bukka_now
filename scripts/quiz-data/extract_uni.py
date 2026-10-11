# 全国統一価格品目の価格（年平均）を抽出（新旧形式対応）
import sys, glob, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_all import rows_of  # noqa

def num(v):
    try: return float(str(v).replace(',', ''))
    except: return None

def parse(rows):
    out = {}
    codes = {}; names = {}; units = {}; price_cols = None; in_header = False
    for r in rows:
        # 新形式
        if len(r) > 10 and r[10] == '銘柄符号':
            codes = {c: r[c].replace('.0', '') for c in range(11, len(r)) if r[c]}; names = {}; units = {}; price_cols = None
            continue
        if len(r) > 10 and r[10] == '品目' and codes:
            names = {c: r[c] for c in codes}; continue
        if len(r) > 10 and r[10] == '単位' and codes:
            units = {c: r[c] for c in codes}; continue
        if len(r) > 10 and r[10] == '表章単位' and codes:
            price_cols = [c for c in codes if r[c].startswith('価格')]; continue
        if len(r) > 10 and r[10] == '年平均' and codes:
            for c in (price_cols or list(codes)):
                v = num(r[c]) if c < len(r) else None
                if v is not None:
                    out[codes[c]] = {'name': names.get(c), 'unit': units.get(c), 'price': v}
            continue
        # 旧形式
        if len(r) > 12 and r[7] == '月':
            codes = {c: r[c].replace('.0', '') for c in range(12, len(r)) if r[c] and num(r[c]) is not None}
            names = {c: '' for c in codes}; in_header = True; continue
        if in_header and codes:
            if len(r) > 7 and r[7] == 'Month':
                in_header = False
            for c in codes:
                if c < len(r) and r[c] and not r[c].startswith(('(1', ' (1')):
                    names[c] += r[c]
                elif c < len(r) and r[c]:
                    units[c] = r[c]
            continue
        if codes and len(r) > 11 and r[11].strip() in ('Av.',):
            for c in codes:
                v = num(r[c + 1]) if c + 1 < len(r) else None
                if v is not None:
                    out[codes[c]] = {'name': names.get(c), 'unit': units.get(c), 'price': v}
    return out

res = {}
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.xlsx'))):
    for rows in rows_of(p):
        res.update(parse(rows))
json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(os.path.basename(sys.argv[1]), len(res))
