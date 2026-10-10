# API 仕様書（API Specification）

Hono (TypeScript) で提供する REST API のエンドポイント、リクエスト、レスポンスの仕様を定義します。

---

## 1. エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/quiz` | クイズ設問一覧（全7問）と現在の世間平均を取得 | 不要 |
| `POST` | `/api/quiz/submit` | 回答配列を送信し、採点結果・診断タイプを取得 | 不要 |
| `GET` | `/api/stats` | 各品目の全体統計インサイト一覧を取得 | 不要 |

---

## 2. エンドポイント詳細

### 2.1 `GET /api/quiz`
クイズ開始時に設問一覧を取得します。カンニング防止のため、正解金額はレスポンスに含みません。

#### レスポンス（200 OK）
```json
{
  "questions": [
    {
      "id": "q1_egg",
      "type": "choice",
      "category": "food",
      "categoryLabel": "食料品（生鮮）",
      "title": "卵1パック（10個・M/Lサイズ）の全国平均価格は？",
      "subtitle": "2024〜2026年現在の公的平均小売価格",
      "unit": "円",
      "options": [
        { "label": "約 198 円", "value": 198 },
        { "label": "約 258 円", "value": 258 },
        { "label": "約 318 円", "value": 318 },
        { "label": "約 378 円", "value": 378 }
      ],
      "publicStats": {
        "averageExpected": 230
      }
    },
    {
      "id": "q2_bread",
      "type": "slider",
      "category": "food",
      "categoryLabel": "食料品（主食）",
      "title": "食パン1斤（6枚切）の平均価格は？",
      "subtitle": "スライダーを動かして金額を予想しよう",
      "unit": "円",
      "min": 100,
      "max": 350,
      "step": 1,
      "defaultValue": 180,
      "publicStats": {
        "averageExpected": 170
      }
    }
  ]
}
```

---

### 2.2 `POST /api/quiz/submit`
全問の回答を送信し、総合スコア・タイプ判定・レーダーチャート値・正解比較データを返却します。

#### リクエストボディ
```json
{
  "answers": [
    { "questionId": "q1_egg", "answer": 258 },
    { "questionId": "q2_bread", "answer": 190 },
    { "questionId": "q3_burger", "answer": 50 },
    { "questionId": "q4_tissue", "answer": 360 },
    { "questionId": "q5_gyudon", "answer": 450 },
    { "questionId": "q6_movie", "answer": 2000 },
    { "questionId": "q7_electricity", "answer": 6500 }
  ]
}
```

#### レスポンス（200 OK）
```json
{
  "submissionId": "sub_8f4a2...",
  "totalScore": 88,
  "senseType": {
    "code": "master",
    "name": "令和の相場マスター",
    "tagline": "インフレに惑わされない！ 現代のリアル相場を正確に捉える達人",
    "description": "実勢価格との誤差が非常に小さく、最新の価格改定やインフレの動きを的確に把握できています。",
    "badgeColor": "#10b981"
  },
  "radarChart": [
    { "category": "food", "label": "食料品・生鮮", "score": 92 },
    { "category": "dining", "label": "外食・加工品", "score": 85 },
    { "category": "daily", "label": "日用品・雑貨", "score": 90 },
    { "category": "infrastructure", "label": "光熱・サービス", "score": 84 }
  ],
  "questionResults": [
    {
      "questionId": "q1_egg",
      "title": "卵1パック（10個・M/Lサイズ）",
      "userAnswer": 258,
      "actualPrice": 258,
      "averageExpected": 232,
      "score": 100,
      "unit": "円",
      "priceNote": "2024-2026年小売物価統計調査での全国平均は約255〜260円。鳥インフルエンザ以前（約200円前後）から2割以上上昇しています。"
    }
  ],
  "biasTendency": "balanced"
}
```

---

### 2.3 `GET /api/stats`
全ユーザーの意識調査集合知データを取得します。

#### レスポンス（200 OK）
```json
{
  "totalParticipants": 1420,
  "items": [
    {
      "questionId": "q1_egg",
      "name": "卵1パック（10個）",
      "actualPrice": 258,
      "averageExpected": 232,
      "gapPercent": -10.1,
      "trend": "underestimated"
    }
  ]
}
```
