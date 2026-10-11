# 候補ごとに 1950〜2025 の系列（現在の単位に換算）を組み立て、段差・換算を報告する
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from units import norm, parse_qty, parse_history
from candidates import CANDIDATES, OVERRIDES

SP = sys.argv[1]
long = json.load(open(f'{SP}/stat/long.json'))
tokyo = {y: json.load(open(f'{SP}/stat/tokyo{y}.json')) for y in range(2011, 2026)}
uni = {y: json.load(open(f'{SP}/stat/uni{y}.json')) for y in range(2011, 2026)}

def clean_unit(u):
    u = norm(u or '').strip().strip('()（） ')
    u = re.split(r'[･・]', u)[0].strip()
    return u

def qty(unit, spec):
    u = clean_unit(unit)
    if re.search(r'(kg|g|ml|mL|L)$', u) and not re.match(r'^\d*(袋|本|個|缶|箱)', u):
        q = parse_qty(u)
        if q: return q
    q = parse_qty(spec or '')
    if q: return q
    return ('unit', u)

def last_token(spec):
    t = norm(spec)
    return re.split(r'[,、\s]', t.strip())[-1]

def seg_qty(spec):
    q = parse_qty(spec)
    if q: return q
    return ('unit', clean_unit(last_token(spec)))

def num(v):
    try: return float(str(v).replace(',', ''))
    except: return None

def factor(cur, q):
    if cur[0] != q[0]: return None
    if cur[0] == 'unit': return 1.0 if cur[1] == q[1] else None
    return cur[1] / q[1]

def describe(q):
    if q[0] == 'g': return f"{q[1]/1000:g}kg" if q[1] >= 1000 else f"{q[1]:g}g"
    if q[0] == 'ml': return f"{q[1]/1000:g}L" if q[1] >= 1000 else f"{q[1]:g}mL"
    return q[1]

results = []
for code, cat, title, old, src in CANDIDATES:
    ov = OVERRIDES.get(code, {})
    if ov.get('drop'): continue
    mode_unit = ov.get('mode') == 'unit'
    def factor(cur, q, _f=factor):
        if mode_unit: return 1.0
        return _f(cur, q)
    cur_rec = (uni[2025] if src == 'uni' else tokyo[2025]).get(code)
    if not cur_rec:
        results.append({'code': code, 'title': title, 'error': '2025年データなし'}); continue
    cur_unit = cur_rec.get('unit'); cur_spec = cur_rec.get('spec') or cur_rec.get('name')
    cur_q = qty(cur_unit, cur_spec)
    pts = {}; conv = []; specs = {}
    # 2011〜2025
    for y in range(2025, 2010, -1):
        r = (uni[y].get(code) or tokyo[y].get(code)) if src == 'uni' else tokyo[y].get(code)
        if not r: break
        v = num(r.get('price', r.get('tokyo')))
        if v is None or v == 0: break
        q = qty(r.get('unit'), r.get('spec') or r.get('name'))
        f = factor(cur_q, q)
        if f is None:
            conv.append(f'{y}年以前は単位が異なり（{describe(q)}）換算不可のため除外'); break
        if abs(f - 1) > 1e-9: conv.append(f'{y}年は{describe(q)}あたりの価格を換算')
        pts[y] = v * f; specs[y] = r.get('spec') or r.get('name')
    contiguous = all(y in pts for y in range(min(pts or [2025]), 2026))
    # 1950〜2010
    lc = old or code
    if lc in long and 2011 in pts:
        segs = parse_history(long[lc]['history'])
        series = long[lc]['series']
        for (a, b, spec) in sorted(segs, key=lambda s: -(s[1])):
            q = seg_qty(spec)
            f = factor(cur_q, q)
            years = [y for y in range(b, (a or 1950) - 1, -1) if str(y) in series]
            if f is None:
                if years: conv.append(f'{b}年以前は「{spec[:30]}」（{describe(q)}）で換算不可のため除外')
                break
            stop = False
            for y in years:
                if y in pts: continue
                if y + 1 not in pts and y + 1 <= 2010:   # 欠測で途切れたらそこまで
                    stop = True; break
                pts[y] = series[str(y)] * f
            if abs(f - 1) > 1e-9 and years:
                conv.append(f'{years[-1]}〜{years[0]}年は{describe(q)}あたりの価格を{describe(cur_q)}に換算')
            if stop: break
    if ov.get('minYear'):
        pts = {y: v for y, v in pts.items() if y >= ov['minYear']}
        conv = [c for c in conv if not any(str(y) in c[:4] for y in range(1900, ov['minYear']))]
    ys = sorted(pts)
    jumps = []
    for i in range(1, len(ys)):
        a, b = pts[ys[i - 1]], pts[ys[i]]
        if ys[i] == ys[i - 1] + 1 and a > 0 and (b / a > 1.5 or b / a < 0.67):
            jumps.append(f'{ys[i-1]}→{ys[i]}: {a:,.0f}→{b:,.0f}')
    spec_changes = [y for y in range(2012, 2026) if y in specs and y - 1 in specs and norm(specs[y]) != norm(specs[y - 1])]
    results.append({'code': code, 'cat': cat, 'title': title, 'unit': cur_unit, 'spec': cur_spec, 'curQty': describe(cur_q),
                    'from': ys[0] if ys else None, 'price2025': pts.get(2025), 'points': {y: round(pts[y], 1) for y in ys},
                    'conversions': conv, 'note': ov.get('note'), 'jumps': jumps, 'specChanges2011plus': spec_changes, 'oldCode': old})
json.dump(results, open(f'{SP}/stat/built.json', 'w'), ensure_ascii=False, indent=1)
for r in results:
    if 'error' in r: print('ERR', r['code'], r['title'], r['error']); continue
    print(f"{r['code']} {r['title']} | {r['curQty']} | from {r['from']} | 2025={r['price2025']:,.0f}")
    for c in r['conversions']: print('    conv:', c)
    for j in r['jumps']: print('    JUMP:', j)
    if r['specChanges2011plus']: print('    spec-change:', r['specChanges2011plus'])
