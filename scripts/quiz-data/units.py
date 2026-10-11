# 銘柄・単位の文字列から数量（g / mL / 個数）を取り出し、年ごとの単位で記録された価格を現在の単位に換算する
import re, unicodedata

def norm(s):
    t = unicodedata.normalize('NFKC', s or '')
    return re.sub(r'(?<=\d),(?=\d{3})', '', t)   # 桁区切りのカンマだけ除去（読点は残す）

ERA = {'昭和': 1925, '平成': 1988, '令和': 2018}

def _to(v, unit):
    if unit == 'kg': return ('g', v * 1000)
    if unit == 'g': return ('g', v)
    if unit in ('L', 'l', 'リットル'): return ('ml', v * 1000)
    return ('ml', v)

def parse_qty(text):
    """銘柄・単位の文字列から内容量を ('g', 5000) / ('ml', 2100) / ('count', 10) で返す。曖昧なら None"""
    t = norm(text)
    # 「350mL入り）,6缶入り」「350ml×6本」
    m = re.search(r'(\d+(?:\.\d+)?)\s*(ml|mL|cc|L)\s*(?:入り)?\)?\s*[×x,，]\s*(\d+)\s*(?:缶|本)', t)
    if m:
        kind, v = _to(float(m.group(1)), m.group(2))
        return (kind, v * int(m.group(3)))
    # 「(10個入り)」「(18枚入り)」「(44包入り)」のような個数入り
    m = re.search(r'(\d+)\s*(?:個|枚|包|粒|錠|袋|本)入り', t)
    if m:
        return ('count', int(m.group(1)))
    # 「(400~450g入り)」のような範囲指定は内容量が一意に決まらない
    if re.search(r'\d+\s*[~〜]\s*\d+(?:\.\d+)?\s*(kg|g|ml|mL|cc|L)\s*入', t):
        return None
    # 「(5kg入り)」のような内容量
    inner = {(_to(float(v), u)) for v, u in re.findall(r'(\d+(?:\.\d+)?)\s*(kg|g|ml|mL|cc|L)\s*入', t)}
    if len(inner) == 1:
        return inner.pop()
    if len(inner) > 1:
        return None
    # 末尾の単位（例: ...,400g / 1kg / 18L）
    m = re.search(r'(?:^|[,\s])(\d+(?:\.\d+)?)\s*(kg|g|ml|mL|cc|L)\s*$', t)
    if m:
        return _to(float(m.group(1)), m.group(2))
    return None

def segment_years(label):
    """'～昭和25年' '昭和26～36年' '昭和48年～平成7年' '平成8～13年' '昭和47年' '～46年' を (from, to) に"""
    t = norm(label)
    era = None
    def conv(e, n):
        return ERA[e] + int(n)
    m = re.match(r'^[～~](?:(昭和|平成))?(\d+)年', t)
    if m:
        return (None, conv(m.group(1) or '昭和', m.group(2)))
    m = re.match(r'^(昭和|平成)(\d+)年?[～~](?:(昭和|平成))?(\d+)年', t)
    if m:
        return (conv(m.group(1), m.group(2)), conv(m.group(3) or m.group(1), m.group(4)))
    m = re.match(r'^(昭和|平成)(\d+)年$', t) or re.match(r'^(昭和|平成)(\d+)年[:：]', t)
    if m:
        y = conv(m.group(1), m.group(2)); return (y, y)
    return None

def parse_history(history):
    """長期表の変遷から [(from, to, spec_text)] を返す（先頭行は最新＝〜2010年）"""
    segs = []
    for line in history[1:]:
        t = norm(line).strip('()（） 　')
        if '：' in line or ':' in t:
            lab, spec = re.split(r'[:：]', t, maxsplit=1)
            yr = segment_years(lab.strip())
            if yr:
                segs.append((yr[0], yr[1], spec))
    latest_from = max([s[1] for s in segs], default=1949) + 1
    segs.append((latest_from, 2010, norm(history[0]) if history else ''))
    return segs
