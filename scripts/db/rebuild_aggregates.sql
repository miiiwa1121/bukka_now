-- rebuild_aggregates.sql: 設問別集計（item_aggregates）と総合スコア分布（score_counts）を、回答ログ・診断ログから作り直す
-- 生成データの投入・削除や、集計対象（in_range）の付け直しのあとに実行する。読み取りは全回答数ぶん、書き込みは設問数＋スコアの種類数ぶん

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
