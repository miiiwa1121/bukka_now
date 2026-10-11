# アーキテクチャ設計書（Architecture Design）

`bukka_now` のシステム構成、ディレクトリ構造、およびクライアントとサーバー間の通信設計を定義します。

---

## 1. 全体構成図（System Architecture）

```mermaid
graph TB
    subgraph Client ["クライアント（ブラウザ）"]
        SPA["React SPA (Vite + TypeScript / Vanilla CSS)"]
    end

    subgraph Edge ["Cloudflare Worker: bukka-now"]
        Static["Static Assets 配信 (dist/)"]
        Fn["Worker: server/index.ts → Hono (server/app.ts)"]
        D1[("D1: bukka-now-db")]
    end

    SPA <--> |HTML/JS/CSS| Static
    SPA <--> |/api/* JSON| Fn
    Fn <--> |binding: DB| D1
```

- **Workers Static Assets**: Vite のビルド成果物（`dist/`）を配信する。存在しないパスは `index.html` を返す（`not_found_handling = "single-page-application"`）。`dist/index.html` にはビルド時にトップ画面の HTML を書き込んである（プリレンダー。[seo.md](seo.md)）。
- **Worker + Hono**: `wrangler.toml` の `assets.run_worker_first = ["/api/*"]` により、`/api/*` へのリクエストだけが Worker（`server/index.ts`）に届き、`server/app.ts` の Hono アプリが処理する。出題、採点、集計、D1 への保存を担当する。それ以外のリクエストは Worker を起動せずにアセットとして返る。
- **Cloudflare D1**: 匿名の回答ログと設問別の集計を保存する。スキーマは [database.md](database.md) を参照。
- **デプロイ方式**: Git 連携ではなく `npm run deploy`（`wrangler deploy`）で手動反映する。
- **ドメイン**: `bukka-now.miiiwa.com` を Worker の Custom Domain として接続する（`wrangler.toml` の `routes`）。`*.workers.dev` も有効にしてある。

---

## 2. ディレクトリ構成

```
bukka_now/
├── AGENTS.md                   # AI エージェント用プロジェクト指示
├── docs/                       # ドキュメント（目次: docs/README.md）
├── server/                     # API 実装（Hono）
│   ├── index.ts                # Worker エントリ（Hono アプリを default export）
│   ├── app.ts                  # ルーティング・D1 アクセス・集計
│   ├── scoring.ts              # 採点・パーセンタイル・分布生成・タイプ判定
│   └── types.ts                # Env（D1 バインディング）型
├── migrations/
│   ├── 0001_initial_schema.sql # D1 スキーマ（シードデータなし）
│   └── 0002_add_submission_source.sql # quiz_submissions.source（実ユーザー / 生成データの区別）
├── src/                        # フロントエンド（React）
│   ├── App.tsx                 # 画面遷移（landing / quiz / result）・10秒タイマー・API 呼び出し
│   ├── main.tsx
│   ├── index.css / App.css     # Vanilla CSS（unpis 風デザインシステム）
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── LandingView.tsx           # トップ（累計回答者数・設問数選択）
│   │   ├── NumberKeypad.tsx          # テンキー＋物理キーボード入力
│   │   ├── ResultDashboard.tsx       # 結果画面（固定スコアカード＋3面スライド・ジェスチャー）
│   │   ├── DistributionBarChart.tsx  # 面1: 10分割ヒストグラム
│   │   ├── DetailedPlotChart.tsx     # 面2: 1単位プロット
│   │   ├── PriceTrendChart.tsx       # 面3: 物価推移折れ線（SVG）
│   │   └── PriceNoteColumn.tsx       # 3面共通の「コラム」（priceNote）
│   ├── data/quizMaster.ts      # 100問マスター（正解価格・推移・コラム）＋ SENSE_TYPES。scripts/quiz-data で生成
│   └── types/quiz.ts           # フロント・サーバー共通型
├── scripts/quiz-data/          # 小売物価統計調査からクイズマスターを生成するスクリプト（Python）
├── scripts/synthetic-data/     # 架空の回答者の回答を生成し D1 に投入・削除するスクリプト（TypeScript）
├── scripts/seo/                # プリレンダー（build の最後に実行）・OGP 画像とアイコンの生成
├── public/                     # favicon・apple-touch-icon・OGP 画像・robots.txt・sitemap.xml
├── wrangler.toml               # Worker 設定（エントリ・Static Assets・ドメイン）・D1 バインディング
├── vite.config.ts              # React + @hono/vite-dev-server（dev 時に /api を Hono へ）
└── package.json
```

`src/data/` と `src/types/` はサーバーとフロントで共有している。サーバーは `src/data/quizMaster.ts` を import して採点する。

---

## 3. 実行環境ごとの API / DB の動き

| コマンド | フロント | API | D1 |
| :--- | :--- | :--- | :--- |
| `npm run dev` | Vite dev server（:5173） | `@hono/vite-dev-server` が `server/app.ts` を直接実行 | **バインディングなし**（`c.env.DB` は undefined）。保存はせず、集計値は空として動く |
| `npm run preview` | `dist/`（Static Assets） | `wrangler dev` が Worker（`server/index.ts`）を実行 | ローカル D1（`.wrangler/state`）。`wrangler.toml` のバインディングを使う。事前に `npm run db:migrate:local` が必要 |
| 本番 | Workers Static Assets | Worker | 本番 D1 `bukka-now-db` |

API は `c.env.DB` がない場合でも落ちないように作ってある。その場合は集計値が空（回答者0人。結果画面の世間平均は自分の回答のみから計算）として動く。

---

## 4. 通信・データフロー

### 4.1 起動時・トップ画面
1. 本番では、プリレンダー済みの HTML がまず表示され、`src/main.tsx` の `hydrateRoot` が React に引き継ぐ。
2. `App.tsx` がマウント時に `GET /api/quiz?count=10` を呼び、`totalParticipants`（累計回答者数）だけを使う。

### 4.2 クイズ開始時
1. `GET /api/quiz?count=N` を呼ぶ。
2. サーバーは `QUIZ_MASTER` をシャッフルして N 問を抽出する。返すのは表示に必要な項目（ID、カテゴリ、設問文、単位）と `totalResponses`（設問別回答者数）だけ。正解（`actualPrice`）、解説（`priceNote`）、正解のヒントになる値（`priceHistory`、世間平均）は返さない。

### 4.3 回答完了・採点時
1. クライアントが `POST /api/quiz/submit` に `{ answers: [{ questionId, answer }] }` を送る。
2. サーバー側の処理:
   - 入力を検証する（不正なら 400）。
   - D1 の `item_aggregates` から設問別の平均と回答数を取得する。
   - D1 の `quiz_answers` から、対象設問の過去回答（設問ごとに直近500件）と、設問別の最低値・最高値を取得する。
   - `calculateQuizResult()` で採点、パーセンタイル、タイプ判定、分布生成を行う。世間平均・回答者数・最低値・最高値には今回の回答も含める。
   - D1 に保存する（`quiz_submissions` を INSERT、設問ごとに `quiz_answers` を INSERT、`item_aggregates` を UPSERT）。保存は `db.batch()` で1トランザクションにまとめ、`executionCtx.waitUntil` で非同期に行う（レスポンスを待たせない）。
3. 採点結果を返し、クライアントが結果画面を描画する。

API の詳細は [api.md](api.md) を参照。

---

## 5. 既知の課題

現在、未解決の課題はない。

### 解決済み（2026-10-11）

| # | 課題 | 対応 |
| :--- | :--- | :--- |
| 1 | `PriceTrendChart.tsx` が `QUIZ_MASTER` を import しており、正解価格がクライアントバンドルに入っていた | import を削除し、採点 API が返す `pastPrice` / `pastPriceYear` だけを使うようにした。`pastPrice` / `pastPriceYear` は型上も必須にした |
| 2 | 出題 API が、回答0件の設問の `averageExpected` として正解価格を返していた。`pastPrice` も返していた | 出題 API から `averageExpected` と `pastPrice` / `pastPriceYear` を削除した（フロントでは未使用だった）。`GET /api/stats` からも正解価格と乖離率を削除した（乖離率から正解を逆算できるため） |
| 3 | 過去回答の取得が全設問合計で `LIMIT 500` だった | `ROW_NUMBER() OVER (PARTITION BY question_id)` で設問ごとに直近500件を取るようにした。回答者数は `item_aggregates`、最低値・最高値は SQL の `MIN` / `MAX` から全件ベースで出す |
| 4 | `POST /api/quiz/submit` の入力検証が不十分だった | 件数1〜100、存在する設問ID、重複なし、回答は 0〜99,999,999 の整数、を検証し、違反時は 400 を返す |
