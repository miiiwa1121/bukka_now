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

- すべてのルートに `hono/cors` を適用している（全オリジン許可）。
- D1 バインディングがない環境（`npm run dev`）では、集計値を空として返す。

---

## 2. エンドポイント詳細

### 2.1 `GET /api/quiz`

設問を取得する。カンニング防止のため、正解（`actualPrice`）、解説（`priceNote`）、正解のヒントになる値（`pastPrice`、`pastPriceYear`、世間平均）はレスポンスに含めない。

#### クエリパラメータ

| 名前 | 型 | 既定値 | 説明 |
| :--- | :--- | :--- | :--- |
| `count` | number | 10 | 出題数。10の倍数に丸めたうえで 10〜100 に収める |

#### レスポンス（200 OK）

```json
{
  "questions": [
    {
      "id": "q1",
      "category": "food",
      "categoryLabel": "食料品（生鮮）",
      "title": "鶏卵1パック（10個・白玉・M/L）の全国平均価格",
      "subtitle": "総務省小売物価統計調査に基づく全国平均小売価格",
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
| `questions[].totalResponses` | その設問の累計回答数 |
| `totalParticipants` | `quiz_submissions` の件数（累計回答者数） |

---

### 2.2 `POST /api/quiz/submit`

全問の回答を送信し、採点結果を受け取る。サーバーは同時に、D1 へ回答ログの保存と集計の更新を行う（非同期）。

#### リクエストボディ

```json
{
  "answers": [
    { "questionId": "q1", "answer": 250 },
    { "questionId": "q2", "answer": 190 }
  ]
}
```

#### 入力検証（違反時は `400 { "error": "<理由>" }`）

| 条件 | エラーメッセージ |
| :--- | :--- |
| ボディが JSON でない | `Invalid JSON body` |
| `answers` が配列でない | `Invalid answers format` |
| `answers` が 0件、または 101件以上 | `answers must contain 1 to 100 items` |
| 要素がオブジェクトでない | `Invalid answer item` |
| `questionId` がマスターに存在しない | `Unknown questionId` |
| 同じ `questionId` が重複している | `Duplicate questionId` |
| `answer` が 0〜99,999,999 の整数でない | `answer must be an integer between 0 and 99999999` |

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
      "questionId": "q1",
      "title": "鶏卵1パック（10個・白玉・M/L）の全国平均価格",
      "category": "food",
      "categoryLabel": "食料品（生鮮）",
      "userAnswer": 250,
      "actualPrice": 258,
      "averageExpected": 245,
      "minAnswer": 180,
      "maxAnswer": 400,
      "totalResponses": 37,
      "unit": "円",
      "score": 92,
      "errorRate": 0.031,
      "priceNote": "鳥インフルエンザ流行前の2020年は約200円前後でしたが、…",
      "pastPrice": 205,
      "pastPriceYear": "2020年",
      "distribution": [
        {
          "label": "〜140円",
          "min": 120,
          "max": 139,
          "count": 0,
          "percent": 0,
          "hasUserAnswer": false,
          "hasActualPrice": false,
          "hasAverageExpected": false
        }
      ],
      "rawAnswers": [250, 260, 240]
    }
  ]
}
```

| フィールド | 説明 |
| :--- | :--- |
| `totalScore` | 総合スコア（0〜100） |
| `topPercentile` | 上位何%（0.5〜99.5、小数1桁） |
| `senseType.code` | `master` / `timeslip` / `panic` / `rough` |
| `biasScore` | 平均バイアス（負なら安く、正なら高く見積もる傾向） |
| `biasTendency` | `balanced`（master）/ `underestimated`（timeslip）/ `overestimated`（panic）/ `volatile`（rough） |
| `questionResults[].distribution` | 10分割ヒストグラムのビン。算出方法は [quiz_data.md](quiz_data.md) を参照 |
| `questionResults[].averageExpected` | 今回の回答を含めた全回答の平均（四捨五入）。既存回答がなければ自分の回答と同じ値 |
| `questionResults[].totalResponses` | 今回の回答を含めた累計回答数（`item_aggregates` ＋1） |
| `questionResults[].minAnswer` / `maxAnswer` | 今回の回答を含めた全回答の最低値・最高値 |
| `questionResults[].rawAnswers` | 分布の母集団（その設問の直近500件＋今回の回答）。面1のヒストグラムと面2の1単位プロットに使う |

#### エラー
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
      "questionId": "q1",
      "title": "鶏卵1パック（10個・白玉・M/L）の全国平均価格",
      "averageExpected": 245,
      "totalResponses": 37
    }
  ]
}
```

- `averageExpected`: 回答がない設問は `null`。
