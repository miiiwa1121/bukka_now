-- 0003_in_range_and_score_counts.sql: 未回答の除去・集計対象の判定・最低値/最高値とスコア分布の集計表

-- 0. 診断ごとの出題数（未回答を含む）。総合スコアを計算し直すときの分母に使う
--    0003 より前は未回答も 0円の行として保存されていたので、回答ログの行数が出題数になる（1. で消す前に数える）
ALTER TABLE quiz_submissions ADD COLUMN question_count INTEGER;
UPDATE quiz_submissions
SET question_count = (SELECT COUNT(*) FROM quiz_answers WHERE quiz_answers.submission_id = quiz_submissions.id);

-- 1. 未回答の削除。0003 より前は、時間切れで入力がない設問が 0円として保存されていた
--    （以後、未回答は回答ログに保存しない。API も 0円を受け付けない）
DELETE FROM quiz_answers WHERE user_answer <= 0;

-- 2. 回答ログに「集計対象か」を追加（1: 正解の 1/5〜5倍、0: 範囲外）
--    既存行はいったん 1。範囲外の判定は正解価格が必要なため、npm run db:refresh で付け直す
ALTER TABLE quiz_answers ADD COLUMN in_range INTEGER NOT NULL DEFAULT 1;

-- 3. 設問別集計に「集計対象の回答数」「最低値」「最高値」を追加
--    total_responses は全回答数、sum_answers / average_answer / min_answer / max_answer は集計対象の回答だけ
ALTER TABLE item_aggregates ADD COLUMN in_range_responses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_aggregates ADD COLUMN min_answer REAL;
ALTER TABLE item_aggregates ADD COLUMN max_answer REAL;

-- 4. 総合スコアの分布（スコア → 診断の回数）。上位%の算出と累計回答者数に使う
CREATE TABLE IF NOT EXISTS score_counts (
    total_score INTEGER PRIMARY KEY,
    submissions INTEGER NOT NULL DEFAULT 0
);

-- 5. 集計を回答ログから作り直す（scripts/db/rebuild_aggregates.sql と同じ内容）
DELETE FROM item_aggregates;
INSERT INTO item_aggregates (question_id, total_responses, in_range_responses, sum_answers, average_answer, min_answer, max_answer, updated_at)
SELECT
    question_id,
    COUNT(*),
    SUM(in_range),
    COALESCE(SUM(CASE WHEN in_range = 1 THEN user_answer END), 0),
    COALESCE(AVG(CASE WHEN in_range = 1 THEN user_answer END), 0),
    MIN(CASE WHEN in_range = 1 THEN user_answer END),
    MAX(CASE WHEN in_range = 1 THEN user_answer END),
    CURRENT_TIMESTAMP
FROM quiz_answers
GROUP BY question_id;

DELETE FROM score_counts;
INSERT INTO score_counts (total_score, submissions)
SELECT total_score, COUNT(*) FROM quiz_submissions GROUP BY total_score;
