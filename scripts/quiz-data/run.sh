#!/usr/bin/env bash
# 総務省「小売物価統計調査」から東京都区部の年平均価格を取得し、src/data/quizMaster.ts を生成する
#   使い方: scripts/quiz-data/run.sh [作業ディレクトリ（既定: scripts/quiz-data/.work）]
#   前提: python3（venv を作業ディレクトリに作る）、curl
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="${1:-$HERE/.work}"
STAT="$WORK/stat"
UA="Mozilla/5.0"
mkdir -p "$STAT"

# Python 環境（xls / xlsx の読み込み用）
if [ ! -x "$WORK/venv/bin/python" ]; then
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" -q install -r "$HERE/requirements.txt"
fi
PY="$WORK/venv/bin/python"

# 1. 1950〜2010年: 主要品目の東京都区部小売価格（長期時系列）
[ -s "$STAT/kubu_chouki.xls" ] || curl -sSL -A "$UA" -o "$STAT/kubu_chouki.xls" \
  https://www.stat.go.jp/data/kouri/doukou/zuhyou/kubu_chouki.xls
"$PY" "$HERE/extract_long.py" "$STAT/kubu_chouki.xls" "$STAT/long.json"

# 2. 2011〜2025年: e-Stat の年次ファイル（調査品目の月別価格及び年平均価格 / 全国統一価格品目の価格）
for y in $(seq 2011 2025); do
  list="$STAT/list$y.html"
  [ -s "$list" ] || curl -sSL -A "$UA" -o "$list" \
    "https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&cycle=7&toukei=00200571&tstat=000000680001&tclass1val=0&year=${y}0&month=0&result_back=1"
  mkdir -p "$STAT/$y" "$STAT/uni$y"
  for id in $("$PY" "$HERE/list_ids.py" "$list"); do
    [ -s "$STAT/$y/$id.xlsx" ] || curl -sSL -A "$UA" -o "$STAT/$y/$id.xlsx" \
      "https://www.e-stat.go.jp/stat-search/file-download?statInfId=$id&fileKind=0"
  done
  for id in $("$PY" "$HERE/list_uni.py" "$list"); do
    [ -s "$STAT/uni$y/$id.xlsx" ] || curl -sSL -A "$UA" -o "$STAT/uni$y/$id.xlsx" \
      "https://www.e-stat.go.jp/stat-search/file-download?statInfId=$id&fileKind=0"
  done
  "$PY" "$HERE/extract_all.py" "$y" "$STAT/$y" "$STAT/tokyo$y.json"
  "$PY" "$HERE/extract_uni.py" "$STAT/uni$y" "$STAT/uni$y.json"
done

# 3. 系列の組み立て（単位換算・段差の検出）→ build_report.txt で確認できる
"$PY" "$HERE/build.py" "$WORK" > "$WORK/build_report.txt"

# 4. TypeScript の生成
"$PY" "$HERE/generate_ts.py" "$WORK" "$ROOT/src/data/quizMaster.ts" "$HERE/sense_types.ts.txt"
echo "done: $ROOT/src/data/quizMaster.ts（レポート: $WORK/build_report.txt）"
