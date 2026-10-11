-- 0001_initial_schema.sql: 初期スキーマ定義（モックデータ全廃・純粋なテーブル定義のみ）

-- 診断セッション記録テーブル
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id TEXT PRIMARY KEY,
    total_score INTEGER NOT NULL,
    sense_type TEXT NOT NULL,
    bias_score REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 各設問ごとの回答ログテーブル
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

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_submission_id ON quiz_answers(submission_id);

-- 設問別の世間予想集計サマリーテーブル（リアルタイム集計用）
CREATE TABLE IF NOT EXISTS item_aggregates (
    question_id TEXT PRIMARY KEY,
    total_responses INTEGER DEFAULT 0,
    sum_answers REAL DEFAULT 0,
    average_answer REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
