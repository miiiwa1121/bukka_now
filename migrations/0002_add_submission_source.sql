-- 0002_add_submission_source.sql: 診断セッションに「データの出どころ」を追加（実ユーザー / 生成データの区別）

-- 'user': 実ユーザーの回答（API 経由。既存行もすべてこれになる）
-- 'synthetic': scripts/synthetic-data で生成して投入した回答
ALTER TABLE quiz_submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_submissions_source ON quiz_submissions(source);
