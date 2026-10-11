# 品目ごとに 変遷（〜2010）と 2011〜2025 の銘柄の移り変わりを表示
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from units import norm
from candidates import CANDIDATES
SP = sys.argv[1]; want = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
long = json.load(open(f'{SP}/stat/long.json'))
tokyo = {y: json.load(open(f'{SP}/stat/tokyo{y}.json')) for y in range(2011, 2026)}
uni = {y: json.load(open(f'{SP}/stat/uni{y}.json')) for y in range(2011, 2026)}
built = {r['code']: r for r in json.load(open(f'{SP}/stat/built.json'))}
for code, cat, title, old, src in CANDIDATES:
    if want and code not in want: continue
    b = built.get(code, {})
    print(f'=== {code} {title} (from {b.get("from")})')
    lc = old or code
    if lc in long:
        for h in long[lc]['history']: print('   L', norm(h)[:110])
    prev = None
    for y in range(2011, 2026):
        r = (uni[y] if src == 'uni' else tokyo[y]).get(code)
        s = norm((r or {}).get('spec') or (r or {}).get('name') or '-')[:110]
        if s != prev: print(f'   {y}', s); prev = s
    pts = b.get('points', {})
    sample = [y for y in ['1950','1960','1970','1980','1990','2000','2010','2011','2020','2024','2025'] if y in pts]
    print('   pts:', ' '.join(f'{y}:{pts[y]:,.0f}' for y in sample))
