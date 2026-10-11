-- delete.sql: 生成データ（source = 'synthetic'）を D1 から削除する
-- 実ユーザーの回答（source = 'user'）には触れない
-- このあと scripts/db/rebuild_aggregates.sql で集計を作り直す（npm run synthetic:delete:* は続けて実行する）

DELETE FROM quiz_answers
WHERE submission_id IN (SELECT id FROM quiz_submissions WHERE source = 'synthetic');

DELETE FROM quiz_submissions WHERE source = 'synthetic';
