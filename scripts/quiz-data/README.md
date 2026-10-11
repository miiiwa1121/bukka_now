# クイズデータ生成スクリプト（scripts/quiz-data）

`src/data/quizMaster.ts`（100問の正解価格と価格推移）を、総務省統計局「小売物価統計調査（動向編）」の公表データから生成するスクリプト群です。
マスターは手で編集せず、このスクリプトで再生成してください。仕様は [docs/design/quiz_data.md](../../docs/design/quiz_data.md) の「1. マスターデータ」を参照。

## 使い方

```bash
scripts/quiz-data/run.sh            # 作業ディレクトリは scripts/quiz-data/.work（git 管理外）
```

- 必要なもの: `python3`、`curl`（Python ライブラリは作業ディレクトリの venv に `requirements.txt` から入る）
- 初回は約500ファイル（数十MB）をダウンロードするため10分以上かかる。2回目以降はダウンロード済みファイルを再利用する。
- 実行後、`.work/build_report.txt` に品目ごとの起点年・換算内容・前年比の大きな段差が出力される。データ更新時は必ず目を通す。

## ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `run.sh` | ダウンロード → 抽出 → 系列の組み立て → TypeScript 生成を順に実行 |
| `extract_long.py` | 長期時系列（1950〜2010年、`kubu_chouki.xls`）と「品目名及び銘柄等の変遷」を JSON 化 |
| `list_ids.py` / `list_uni.py` | e-Stat の年次一覧ページから、各年のファイル ID を取り出す |
| `extract_all.py` | 「調査品目の月別価格及び年平均価格」（2011〜2025年）から東京都区部の年平均・銘柄・単位を抽出 |
| `extract_uni.py` | 「全国統一価格品目の価格」（2011〜2025年）から年平均を抽出 |
| `units.py` | 銘柄・単位の文字列から内容量（g / mL / 個数）を読み取る |
| `candidates.py` | 出題品目の定義（`CANDIDATES`）と、目視レビューに基づく個別指定（`OVERRIDES`） |
| `build.py` | 品目ごとに 1950〜2025年の系列を組み立てる（単位換算・起点の決定・段差の検出） |
| `review.py` | 品目ごとの銘柄の変遷を表示する（レビュー用） |
| `generate_ts.py` | `src/data/quizMaster.ts` を出力する |
| `sense_types.ts.txt` | 生成ファイル末尾に付ける `SENSE_TYPES`（物価感覚タイプの文言） |

## 品目を追加・変更するとき

1. `candidates.py` の `CANDIDATES` に `(銘柄符号, カテゴリ, 見出し, 1950〜2010年に使う旧符号 or None, 'tokyo' | 'uni')` を追加する。
2. `run.sh` を実行し、`build_report.txt` と `python review.py <作業ディレクトリ> <銘柄符号>` で銘柄の変遷を確認する。
3. 品物の種類が変わった年があれば `OVERRIDES` に `minYear` を、当時の銘柄が現在と異なる場合は `note` を指定する。
   - 見出しは普段の買い物で目にする単位にする（1袋・1本・1パック・1杯、肉や魚は100g）。統計が「1kgあたり」の品目は、量が客観的に決まる場合だけ `displayScale` で換算し（例: もやし200g → 0.2）、見出しに量を書く。
   - 換算モード `mode` は通常は省略でよい（包装単位は内容量が同じ年だけをつなぐ `package`、重さ単位は比例換算の `scale`）。量り売りの商品で包装単位の見出しにする場合（米5kg袋・砂糖1kg袋など）は `scale` を指定する。
4. 出題数は100問ちょうどにする（設問数の選択肢が最大100問のため）。
5. `run.sh` を再実行し、`npm run build` で型チェックする。

## 年次データの更新（例: 2026年平均が公表されたら）

`extract_all.py` / `build.py` などの年の範囲（`range(2011, 2026)`）と、`generate_ts.py` の「2025年」の表記を更新して再生成する。
問題 ID は銘柄符号に基づくため、正解の年を更新しても ID は変わらない（D1 の回答履歴は引き継がれる）。
