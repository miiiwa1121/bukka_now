# built.json から src/data/quizMaster.ts を生成する
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from candidates import CANDIDATES
SP, OUT, SENSE = sys.argv[1], sys.argv[2], sys.argv[3]
built = json.load(open(f'{SP}/stat/built.json'))
SOURCE = {c[0]: c[4] for c in CANDIDATES}   # 'tokyo'（東京都区部）| 'uni'（全国統一価格）

def label(code, cat):
    c = int(code)
    table = [
        (1000, 1100, '食料品（穀類）'), (1100, 1200, '食料品（魚介）'), (1200, 1300, '食料品（肉類）'),
        (1300, 1400, '食料品（乳卵類）'), (1400, 1470, '食料品（野菜）'), (1470, 1500, '食料品（大豆製品）'),
        (1500, 1600, '食料品（果物）'), (1600, 1700, '食料品（調味料）'), (1700, 1790, '食料品（菓子）'),
        (1790, 1900, '食料品（調理食品）'), (1900, 2000, '食料品（飲料）'), (2000, 2100, '食料品（酒類）'),
        (2100, 2200, '外食'), (3000, 3100, '住居'), (3500, 3900, '光熱・水道'), (4000, 4100, '家電'),
        (4300, 4500, '家事用品'), (5000, 5700, '衣料・履物'), (5700, 5800, 'クリーニング'),
        (6000, 6200, '医薬品・保健用品'), (7200, 7300, '交通'), (7300, 7400, '自動車関連'),
        (7400, 7500, '郵便'), (7700, 7800, '交通'), (9100, 9200, '教養娯楽用品'),
        (9200, 9300, '新聞'), (9300, 9400, '娯楽・サービス'), (9500, 9600, '理美容・入浴'), (9600, 9700, '理美容用品'),
    ]
    for lo, hi, name in table:
        if lo <= c < hi: return name
    return 'その他'

def clean_spec(s):
    s = unicodedata.normalize('NFKC', s or '')
    s = re.sub(r',?\s*(?:\d{4}年|平成\d+年|令和\d+年)\d+月から[^,]*', '', s)   # 「2025年1月から基本銘柄改正」などの注記
    s = s.replace(',', '、').strip('、 ')
    return s

def round_price(v):
    """10円以上は整数、10円未満（1950年代のはがき等）は小数1桁"""
    return round(v) if v >= 10 else round(v, 1)

def fmt(v):
    v = round_price(v)
    return f'{v:,}' if isinstance(v, int) or v == int(v) else f'{v:,.1f}'

def change_text(first_y, first_v, cur):
    r = cur / first_v
    if r >= 2: return f'約{r:.1f}倍' if r < 10 else f'約{r:.0f}倍'
    pct = (r - 1) * 100
    return f'{pct:+.0f}%'

items = []
for b in built:
    pts = {int(y): v for y, v in b['points'].items()}
    ys = sorted(pts)
    cur = pts[2025]
    history = [{'year': y, 'price': round_price(pts[y])} for y in ys]
    spec = clean_spec(b['spec'])
    parts = [f'調査銘柄：{spec}。'] if spec else []
    if len(ys) >= 2:
        fy = ys[0]
        parts.append(f'{fy}年の{fmt(pts[fy])}円から、2025年は{fmt(cur)}円（{change_text(fy, pts[fy], cur)}）。')
        my = max(ys, key=lambda y: pts[y])
        # 2025年が最高値と同額の場合も「2025年が最高値」とする
        parts.append('2025年が統計上の最高値です。' if cur >= pts[my] else f'最も高かったのは{my}年の{fmt(pts[my])}円です。')
    is_uni = SOURCE.get(b['code']) == 'uni'
    notes = []
    if is_uni and ys[0] <= 2010:
        notes.append('2010年以前は東京都区部の価格、2011年以降は全国統一価格')
    if b.get('note'): notes.append(b['note'])
    conv = [c for c in b['conversions'] if '換算不可' not in c]
    if conv and not b.get('note'):
        notes.append('過去の価格は当時の調査単位から換算しています。')
    if notes: parts.append('※' + '。'.join(n.rstrip('。') for n in notes) + '。')
    items.append({
        # 統計の単位（1kg）から身近な量に換算した品目は、ID に量を付けて換算前の回答履歴と分ける（例: s1407-200g）
        'id': f's{b["code"]}' + (f'-{round(b["displayScale"] * 1000)}g' if b.get('displayScale') else ''),
        'category': b['cat'],
        'categoryLabel': label(b['code'], b['cat']),
        'title': f'{b["title"]}はいくら？',
        'subtitle': ('全国統一価格' if is_uni else '東京都区部') + '・2025年平均（総務省 小売物価統計調査）',
        'unit': '円',
        'actualPrice': round(cur),
        'priceHistory': history,
        'priceNote': ''.join(parts),
    })

def ts_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

lines = [
    '// src/data/quizMaster.ts: 100問の物価マスターデータ（数字回答型）',
    '// このファイルは scripts/quiz-data/generate_ts.py で生成している。手で編集しないこと。',
    '// 出典: 総務省統計局「小売物価統計調査（動向編）」東京都区部の年平均価格',
    '//   1950〜2010年: 主要品目の東京都区部小売価格（長期時系列）/ 2011〜2025年: 調査品目の月別価格及び年平均価格・全国統一価格品目の価格',
    '',
    "import type { QuestionData, SenseTypeInfo } from '../types/quiz';",
    '',
    'export const QUIZ_MASTER: QuestionData[] = [',
]
for it in items:
    hist = ', '.join(f'[{h["year"]}, {h["price"]}]' for h in it['priceHistory'])
    lines += [
        '  {',
        f"    id: {ts_str(it['id'])},",
        f"    category: {ts_str(it['category'])},",
        f"    categoryLabel: {ts_str(it['categoryLabel'])},",
        f"    title: {ts_str(it['title'])},",
        f"    subtitle: {ts_str(it['subtitle'])},",
        f"    unit: {ts_str(it['unit'])},",
        f"    actualPrice: {it['actualPrice']},",
        f"    priceHistory: toHistory([{hist}]),",
        f"    priceNote: {ts_str(it['priceNote'])},",
        '  },',
    ]
lines += [
    '];',
    '',
    '// [年, 価格] の組を PricePoint に変換する（データ行を短く保つため）',
    'function toHistory(pairs: [number, number][]): { year: number; price: number }[] {',
    '  return pairs.map(([year, price]) => ({ year, price }));',
    '}',
    '',
]
src = '\n'.join(lines) + open(SENSE).read()
# QUIZ_MASTER 定義より後に function 宣言があっても巻き上げで参照できる
open(OUT, 'w').write(src)
print(len(items), 'items written')
json.dump(items, open(f'{SP}/stat/items.json', 'w'), ensure_ascii=False, indent=1)
