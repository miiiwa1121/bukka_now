# 年報（2011〜2025）から東京都区部の年平均・品目名・銘柄・単位を抽出する（xls / xlsx 両対応）
import sys, glob, json, os
import xlrd, openpyxl

def rows_of(path):
    with open(path, 'rb') as f:
        head = f.read(4)
    if head == b'PK\x03\x04':
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for ws in wb.worksheets:
            yield [['' if v is None else str(v).strip() for v in row] for row in ws.iter_rows(values_only=True)]
    else:
        wb = xlrd.open_workbook(path)
        for sh in wb.sheets():
            yield [[str(sh.cell_value(r, c)).strip() for c in range(sh.ncols)] for r in range(sh.nrows)]

def after(row, label):
    for i, v in enumerate(row):
        if v.startswith(label):
            for w in row[i + 1:]:
                if w and not w.startswith(('Spec', 'Unit', '単位 :')):
                    return w
    return None

def parse(rows):
    out = {}
    meta = {}
    col_avg = None
    for r in rows:
        if len(r) > 8 and r[7] in ('銘柄符号：', '品目：', '銘柄：', '単位：'):          # 新形式（xlsx）
            meta[{'銘柄符号：': 'code', '品目：': 'name', '銘柄：': 'spec', '単位：': 'unit'}[r[7]]] = r[8]
        if len(r) > 7 and r[7] == '品目':                                              # 旧形式（xls）のブロック見出し
            meta = {'name': r[10] if len(r) > 10 else None, 'spec': after(r, '銘柄'), 'unit': after(r, '単位')}
        for label in ('年平均', '平均'):
            if label in r:
                col_avg = r.index(label)
        is_tokyo = len(r) > 8 and (r[7] == '13100' or r[8] == '東京都区部')
        if is_tokyo and col_avg is not None:
            code = (meta.get('code') or r[2]).replace('.0', '').strip()
            out[code] = {'name': meta.get('name'), 'spec': meta.get('spec'), 'unit': meta.get('unit'), 'tokyo': r[col_avg]}
    return out

if __name__ == '__main__':
    year = sys.argv[1]
    res = {}
    for p in sorted(glob.glob(os.path.join(sys.argv[2], '*.xlsx'))):
        try:
            for rows in rows_of(p):
                res.update(parse(rows))
        except Exception as e:
            print('ERR', p, e, file=sys.stderr)
    json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
    print(year, len(res))
