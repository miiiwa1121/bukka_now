-- delete.sql: 生成データ（source = 'synthetic'）を D1 から削除し、設問別集計から差し引く
-- 実ユーザーの回答（source = 'user'）には触れない

-- 1. 設問別集計から生成データの分を差し引く（削除より先に行う）
UPDATE item_aggregates
SET total_responses = item_aggregates.total_responses - syn.cnt,
    sum_answers = item_aggregates.sum_answers - syn.total,
    average_answer = CASE
      WHEN item_aggregates.total_responses - syn.cnt > 0
        THEN (item_aggregates.sum_answers - syn.total) / (item_aggregates.total_responses - syn.cnt)
      ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT a.question_id, COUNT(*) AS cnt, SUM(a.user_answer) AS total
  FROM quiz_answers a
  JOIN quiz_submissions s ON s.id = a.submission_id
  WHERE s.source = 'synthetic'
  GROUP BY a.question_id
) AS syn
WHERE item_aggregates.question_id = syn.question_id;

-- 2. 回答ログとセッションを削除
DELETE FROM quiz_answers
WHERE submission_id IN (SELECT id FROM quiz_submissions WHERE source = 'synthetic');

DELETE FROM quiz_submissions WHERE source = 'synthetic';
