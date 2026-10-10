# データベース設計書（Database Design）

Cloudflare D1（エッジ分散型 SQLite）のテーブル構成、インデックス、およびクエリ仕様を定義します。

---

## 1. 概要

`bukka_now` では、ユーザー登録不要でクイズに回答できる一方、全回答者の予想データを蓄積して「世間の予想平均」をリアルタイムに計算します。
Cloudflare D1 は軽量・高速なエッジ SQL データベースであり、以下のテーブルを管理します。

---

## 2. テーブル設計

### 2.1 `quiz_submissions`（診断セッションログ）
クイズ1回ごとの全体結果ログ（匿名）。

| カラム名 | 型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | セッションUUID（例: `sub_uuidv4`） |
| `total_score` | INTEGER | NOT NULL | 総合物価意識スコア（0〜100点） |
| `sense_type` | TEXT | NOT NULL | 診断タイプコード（`master`, `timeslip`, `panic`, `rough` 等） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 受信日時 |

### 2.2 `quiz_answers`（設問別回答ログ）
各問ごとのユーザー予想値・選択値の記録。

| カラム名 | 型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 内部ID |
| `submission_id`| TEXT | NOT NULL, REFERENCES quiz_submissions(id) | セッションID |
| `question_id` | TEXT | NOT NULL | 設問ID（例: `q1_egg`, `q2_bread` 等） |
| `user_answer` | REAL | NOT NULL | ユーザーの回答値（円、または選択肢の数値） |
| `error_rate` | REAL | NOT NULL | 正解値に対する誤差率（`|回答 - 正解| / 正解`） |
| `score` | INTEGER | NOT NULL | この問のスコア（0〜100点） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 回答日時 |

### 2.3 `item_aggregates`（設問別・世間予想集計キャッシュ）
各問の全ユーザー回答平均を瞬時に読み出すためのサマリーテーブル。回答受信時にインクリメンタル更新または高速計算します。

| カラム名 | 型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `question_id` | TEXT | PRIMARY KEY | 設問ID |
| `total_responses` | INTEGER | DEFAULT 0 | 累計回答数 |
| `sum_answers` | REAL | DEFAULT 0 | 累計回答合計金額 |
| `average_answer` | REAL | DEFAULT 0 | 全回答者の平均予想金額（`sum_answers / total_responses`） |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 最終更新日時 |

---

## 3. SQL スキーマ定義（DDL）

```sql
-- セッション記録テーブル
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id TEXT PRIMARY KEY,
    total_score INTEGER NOT NULL,
    sense_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 各問回答記録テーブル
CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer REAL NOT NULL,
    error_rate REAL NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_submission_id ON quiz_answers(submission_id);

-- 集計テーブル
CREATE TABLE IF NOT EXISTS item_aggregates (
    question_id TEXT PRIMARY KEY,
    total_responses INTEGER DEFAULT 0,
    sum_answers REAL DEFAULT 0,
    average_answer REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期シードデータ（実勢調査前の初期世間平均データとして公的相場近傍の初期値を投入）
INSERT OR IGNORE INTO item_aggregates (question_id, total_responses, sum_answers, average_answer) VALUES
('q1_egg', 50, 11500, 230.0),
('q2_bread', 50, 8500, 170.0),
('q3_burger', 50, 2400, 48.0),
('q4_tissue', 50, 17500, 350.0),
('q5_gyudon', 50, 21500, 430.0),
('q6_movie', 50, 95000, 1900.0),
('q7_electricity', 50, 340000, 6800.0);
```
