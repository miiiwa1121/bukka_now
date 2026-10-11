# API 仕様書（API Specification）

Hono (TypeScript) で提供する REST API のエンドポイント、リクエスト、レスポンスの仕様を定義します。
実装は `server/app.ts`、型定義は `src/types/quiz.ts` です。

---

## 1. エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/quiz` | 指定数の設問と回答者数を取得 | 不要 |
| `POST` | `/api/quiz/submit` | 回答を送信し、採点結果を取得（D1 に保存） | 不要 |
| `GET` | `/api/stats` | 全100品目の世間平均と回答数を取得（フロント未使用） | 不要 |

- **CORS は許可しない**。画面と API は同じオリジンなので不要。他サイトのブラウザからは呼べない（プリフライトに許可ヘッダーを返さない）。
- **IP ごとの回数制限**（Workers Rate Limiting。設定は `wrangler.toml` の `ratelimits`）。超えると `429 { "error": "..." }`。

  | 対象 | バインディング | 上限 |
  | :--- | :--- | :--- |
  | `POST /api/quiz/submit` | `SUBMIT_RATE_LIMITER` | 60秒に6回 |
  | `GET /api/quiz`、`GET /api/stats` | `READ_RATE_LIMITER` | 60秒に60回 |

  キーは `cf-connecting-ip`。IPv4 はアドレスそのもの、IPv6 は上位64ビット（`2001:db8:abcd:12::/64` の形）で数える（IPv6 は1契約に /64 以上がまとめて割り当てられ、アドレスを付け替えて回避できるため。`rateLimitKey()`）。回数は Cloudflare の拠点ごとに数えるため、厳密な上限ではない。回数制限そのものが失敗したときは通す（サービスを止めない）。
- D1 バインディングや回数制限のバインディングがない環境（`npm run dev`）では、集計値を空として返し、回数制限もしない。

---

## 2. エンドポイント詳細

### 2.1 `GET /api/quiz`

設問を取得する。カンニング防止のため、正解（`actualPrice`）、解説（`priceNote`）、正解のヒントになる値（`priceHistory`、世間平均）はレスポンスに含めない。

#### クエリパラメータ

| 名前 | 型 | 既定値 | 説明 |
| :--- | :--- | :--- | :--- |
| `count` | number | 10 | 出題数。10の倍数に丸めたうえで 10〜100 に収める |

#### レスポンス（200 OK）

```json
{
  "questions": [
    {
      "id": "s1001",
      "category": "food",
      "categoryLabel": "食料品（穀類）",
      "title": "お米（コシヒカリ・5kg袋）はいくら？",
      "subtitle": "東京都区部・2025年平均（総務省 小売物価統計調査）",
      "unit": "円",
      "totalResponses": 0
    }
  ],
  "totalQuestions": 10,
  "poolSize": 100,
  "totalParticipants": 0
}
```

| フィールド | 説明 |
| :--- | :--- |
| `questions[].totalResponses` | その設問の累計回答数（`item_aggregates.total_responses`） |
| `totalParticipants` | 累計回答者数（`score_counts.submissions` の合計。`quiz_submissions` の件数と同じ） |

---

### 2.2 `POST /api/quiz/submit`

全問の回答を送信し、採点結果を受け取る。サーバーは同時に、D1 へ回答ログの保存と集計の更新を行う（非同期）。

#### リクエストボディ

```json
{
  "answers": [
    { "questionId": "s1001", "answer": 4500 },
    { "questionId": "s7401", "answer": null }
  ]
}
```

- `answer: null` は未回答（時間切れで入力なし）。0点として採点し、回答ログ・設問別集計には保存しない。

#### 入力検証（違反時は `400 { "error": "<理由>" }`）

| 条件 | エラーメッセージ |
| :--- | :--- |
| ボディが JSON でない | `Invalid JSON body` |
| `answers` が配列でない | `Invalid answers format` |
| `answers` が 0件、または 101件以上 | `answers must contain 1 to 100 items` |
| 要素がオブジェクトでない | `Invalid answer item` |
| `questionId` がマスターに存在しない | `Unknown questionId` |
| 同じ `questionId` が重複している | `Duplicate questionId` |
| `answer` が `null` でも 1〜99,999,999 の整数でもない（0円は不可） | `answer must be null or an integer between 1 and 99999999` |

#### レスポンス（200 OK）

```json
{
  "submissionId": "sub_1760140800000_k3j9x2a",
  "totalScore": 72,
  "topPercentile": 33.1,
  "senseType": {
    "code": "rough",
    "name": "大らか直感型",
    "tagline": "細かい金額は気にしない！ 直感と大らかさで生きるマイペース派",
    "description": "品目によって高低のブレが大きく、…",
    "badgeColor": "#8b5cf6"
  },
  "biasScore": -0.031,
  "biasTendency": "volatile",
  "questionResults": [
    {
      "questionId": "s1001",
      "title": "お米（コシヒカリ・5kg袋）はいくら？",
      "category": "food",
      "categoryLabel": "食料品（穀類）",
      "userAnswer": 4500,
      "actualPrice": 4928,
      "averageExpected": 4650,
      "minAnswer": 2800,
      "maxAnswer": 6000,
      "totalResponses": 37,
      "unit": "円",
      "score": 78,
      "errorRate": 0.087,
      "priceNote": "調査銘柄：国内産、精米、…「コシヒカリ」。1950年の495円から、2025年は4,928円（約10.0倍）。…",
      "priceHistory": [{ "year": 1950, "price": 495 }, { "year": 1951, "price": 540 }, "…", { "year": 2025, "price": 4928 }],
      "distribution": [
        {
          "label": "〜2,500円",
          "min": 2000,
          "max": 2499,
          "count": 0,
          "percent": 0,
          "hasUserAnswer": false,
          "hasActualPrice": false,
          "hasAverageExpected": false
        }
      ],
      "rawAnswers": [4500, 4800, 5000]
    }
  ]
}
```

| フィールド | 説明 |
| :--- | :--- |
| `totalScore` | 総合スコア（0〜100） |
| `topPercentile` | 上位何%（0.1〜100、小数1桁）。これまでの全診断の総合スコア（`score_counts`）と比べた順位。算出方法は [quiz_data.md](quiz_data.md) |
| `senseType.code` | `master` / `timeslip` / `panic` / `rough` |
| `biasScore` | 平均バイアス（負なら安く、正なら高く見積もる傾向）。回答した設問だけで平均する |
| `biasTendency` | `balanced`（master）/ `underestimated`（timeslip）/ `overestimated`（panic）/ `volatile`（rough） |
| `questionResults[].distribution` | 10分割ヒストグラムのビン。算出方法は [quiz_data.md](quiz_data.md) を参照 |
| `questionResults[].userAnswer` | 回答金額。未回答は `null` |
| `questionResults[].score` / `errorRate` | 設問スコアと誤差率。未回答は 0点、`errorRate` は `null` |
| `questionResults[].averageExpected` | 集計対象（正解の 1/5〜5倍）の回答の平均（四捨五入）。今回の回答も対象なら含める。対象がなければ `null` |
| `questionResults[].totalResponses` | 今回の回答を含めた累計回答数（`item_aggregates.total_responses` ＋ 回答していれば1）。集計対象外の回答も数える |
| `questionResults[].minAnswer` / `maxAnswer` | 集計対象の回答の最低値・最高値（今回の回答も対象なら含める）。対象がなければ `null` |
| `questionResults[].priceHistory` | 年平均価格の推移（古い順、最後が2025年）。面3の折れ線に使う |
| `questionResults[].rawAnswers` | 分布の母集団（その設問の直近500件＋今回の回答。集計対象外の回答も含む）。面1のヒストグラムと面2の1単位プロットに使う |

#### エラー
- `429 { "error": "Too many submissions. Please wait a moment." }`: 回数制限を超えた場合。入力検証より前に判定する。画面は「1分ほど待ってから」と案内する。
- `500 { "error": "Failed to process quiz submission" }`: 想定外の例外が起きた場合。
- D1 への保存は `db.batch()` による1トランザクションで、レスポンス返却後に非同期で行う。保存に失敗してもログ出力のみで、レスポンスには影響しない。

---

### 2.3 `GET /api/stats`

全100品目について、世間平均と回答数を返す。現在のフロントエンドからは呼んでいない。
正解を逆算できないよう、正解価格と乖離率は返さない。

#### レスポンス（200 OK）

```json
{
  "totalParticipants": 37,
  "items": [
    {
      "questionId": "s1001",
      "title": "お米（コシヒカリ・5kg袋）はいくら？",
      "averageExpected": 245,
      "totalResponses": 37
    }
  ]
}
```

- `averageExpected`: 集計対象（正解の 1/5〜5倍）の回答の平均。対象がない設問は `null`。
- `totalResponses`: 集計対象外も含めた回答数。
