// server/app.ts: Hono API サーバー実装

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { QUIZ_MASTER } from '../src/data/quizMaster';
import type { GlobalStatsItem, PublicQuestion, UserAnswerItem } from '../src/types/quiz';
import { calculateQuizResult, type QuestionStats } from './scoring';
import type { Env } from './types';

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

const MASTER_IDS = new Set(QUIZ_MASTER.map((q) => q.id));

// 1回の送信で受け付ける回答数の上限（出題数の上限と同じ）
const MAX_ANSWERS = 100;
// 回答金額の上限（テンキーの最大8桁）
const MAX_ANSWER_VALUE = 99_999_999;
// 分布ヒストグラム・1単位プロット用に取得する設問ごとの直近回答数
const HISTORY_LIMIT_PER_QUESTION = 500;

interface AggregateData {
  averages: Record<string, number>;
  counts: Record<string, number>;
  totalParticipants: number;
}

/**
 * 設問別世間平均値および回答者数の取得（実データのみ。回答がない設問はキー自体が存在しない）
 */
async function getAggregatedStats(db?: D1Database): Promise<AggregateData> {
  const averages: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let totalParticipants = 0;

  if (!db) {
    return { averages, counts, totalParticipants };
  }

  try {
    const { results } = await db
      .prepare('SELECT question_id, average_answer, total_responses FROM item_aggregates')
      .all<{ question_id: string; average_answer: number; total_responses: number }>();

    for (const row of results ?? []) {
      if (row.total_responses > 0) {
        averages[row.question_id] = row.average_answer;
        counts[row.question_id] = row.total_responses;
      }
    }

    const subCount = await db
      .prepare('SELECT COUNT(*) as count FROM quiz_submissions')
      .first<{ count: number }>();
    if (subCount) {
      totalParticipants = subCount.count;
    }
  } catch (err) {
    console.error('Failed to query D1 item_aggregates:', err);
  }

  return { averages, counts, totalParticipants };
}

/**
 * 回答送信ボディの検証。問題があればエラーメッセージを返す
 */
function validateAnswers(body: unknown): { answers: UserAnswerItem[] } | { error: string } {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { answers?: unknown }).answers)) {
    return { error: 'Invalid answers format' };
  }

  const rawAnswers = (body as { answers: unknown[] }).answers;
  if (rawAnswers.length === 0 || rawAnswers.length > MAX_ANSWERS) {
    return { error: `answers must contain 1 to ${MAX_ANSWERS} items` };
  }

  const seen = new Set<string>();
  const answers: UserAnswerItem[] = [];

  for (const item of rawAnswers) {
    if (!item || typeof item !== 'object') {
      return { error: 'Invalid answer item' };
    }
    const { questionId, answer } = item as { questionId?: unknown; answer?: unknown };

    if (typeof questionId !== 'string' || !MASTER_IDS.has(questionId)) {
      return { error: 'Unknown questionId' };
    }
    if (seen.has(questionId)) {
      return { error: 'Duplicate questionId' };
    }
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > MAX_ANSWER_VALUE) {
      return { error: `answer must be an integer between 0 and ${MAX_ANSWER_VALUE}` };
    }

    seen.add(questionId);
    answers.push({ questionId, answer });
  }

  return { answers };
}

/**
 * GET /api/quiz?count=10
 * クイズ設問一覧を取得
 * カンニング防止のため、正解・解説・正解のヒントになる値（過去価格・世間平均）は返さない
 * 10〜100問の範囲で10問単位で指定可能（デフォルト10問）
 */
app.get('/api/quiz', async (c) => {
  const countParam = Number(c.req.query('count')) || 10;
  const count = Math.min(100, Math.max(10, Math.round(countParam / 10) * 10));

  const { counts, totalParticipants } = await getAggregatedStats(c.env.DB);

  // 指定数の問題をシャッフルして抽出
  const shuffled = [...QUIZ_MASTER].sort(() => 0.5 - Math.random()).slice(0, count);

  const questions: PublicQuestion[] = shuffled.map((q) => ({
    id: q.id,
    category: q.category,
    categoryLabel: q.categoryLabel,
    title: q.title,
    subtitle: q.subtitle,
    unit: q.unit,
    totalResponses: counts[q.id] ?? 0,
  }));

  return c.json({
    questions,
    totalQuestions: questions.length,
    poolSize: QUIZ_MASTER.length,
    totalParticipants,
  });
});

/**
 * POST /api/quiz/submit
 * 回答を採点し、診断結果（上位%、回答分布棒グラフ）を返却。同時に D1 にログ保存 & 集計更新
 */
app.post('/api/quiz/submit', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const validated = validateAnswers(body);
  if ('error' in validated) {
    return c.json({ error: validated.error }, 400);
  }
  const { answers } = validated;

  try {
    const { averages, counts } = await getAggregatedStats(c.env.DB);
    const questionIds = answers.map((a) => a.questionId);

    const questionStats: Record<string, QuestionStats> = {};
    for (const id of questionIds) {
      if (counts[id]) {
        questionStats[id] = { average: averages[id], count: counts[id] };
      }
    }

    // D1 から過去の回答を取得（設問ごとに直近 HISTORY_LIMIT_PER_QUESTION 件）と、設問別の最低値・最高値
    const historicalAnswers: Record<string, number[]> = {};
    if (c.env.DB) {
      try {
        const placeholders = questionIds.map(() => '?').join(',');

        const { results } = await c.env.DB.prepare(
          `SELECT question_id, user_answer FROM (
             SELECT question_id, user_answer,
                    ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY id DESC) AS rn
             FROM quiz_answers
             WHERE question_id IN (${placeholders})
           ) WHERE rn <= ${HISTORY_LIMIT_PER_QUESTION}`
        )
          .bind(...questionIds)
          .all<{ question_id: string; user_answer: number }>();

        for (const row of results ?? []) {
          (historicalAnswers[row.question_id] ??= []).push(row.user_answer);
        }

        const { results: ranges } = await c.env.DB.prepare(
          `SELECT question_id, MIN(user_answer) AS min_answer, MAX(user_answer) AS max_answer
           FROM quiz_answers WHERE question_id IN (${placeholders}) GROUP BY question_id`
        )
          .bind(...questionIds)
          .all<{ question_id: string; min_answer: number; max_answer: number }>();

        for (const row of ranges ?? []) {
          if (questionStats[row.question_id]) {
            questionStats[row.question_id].min = row.min_answer;
            questionStats[row.question_id].max = row.max_answer;
          }
        }
      } catch (histErr) {
        console.error('Failed to query historical answers:', histErr);
      }
    }

    const result = calculateQuizResult(answers, questionStats, historicalAnswers);

    // D1 への非同期保存処理（DB バインディングが存在する場合）。batch で1トランザクションにまとめる
    if (c.env.DB) {
      const db = c.env.DB;
      const statements: D1PreparedStatement[] = [
        db
          .prepare('INSERT INTO quiz_submissions (id, total_score, sense_type, bias_score) VALUES (?, ?, ?, ?)')
          .bind(result.submissionId, result.totalScore, result.senseType.code, result.biasScore),
      ];

      for (const item of result.questionResults) {
        statements.push(
          db
            .prepare(
              'INSERT INTO quiz_answers (submission_id, question_id, user_answer, error_rate, score) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(result.submissionId, item.questionId, item.userAnswer, item.errorRate, item.score),
          db
            .prepare(
              `INSERT INTO item_aggregates (question_id, total_responses, sum_answers, average_answer)
               VALUES (?, 1, ?, ?)
               ON CONFLICT(question_id) DO UPDATE SET
                 total_responses = total_responses + 1,
                 sum_answers = sum_answers + excluded.sum_answers,
                 average_answer = (sum_answers + excluded.sum_answers) / (total_responses + 1),
                 updated_at = CURRENT_TIMESTAMP`
            )
            .bind(item.questionId, item.userAnswer, item.userAnswer)
        );
      }

      const execution = db.batch(statements).catch((dbErr) => {
        console.error('Failed to save submission to D1:', dbErr);
      });

      // Cloudflare Workers の executionCtx.waitUntil があれば利用、なければ await
      // （Hono の c.executionCtx は Workers 以外の環境ではアクセス時に例外を投げる）
      let executionCtx: { waitUntil(promise: Promise<unknown>): void } | undefined;
      try {
        executionCtx = c.executionCtx;
      } catch {
        executionCtx = undefined;
      }
      if (executionCtx) {
        executionCtx.waitUntil(execution);
      } else {
        await execution;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Quiz submission error:', error);
    return c.json({ error: 'Failed to process quiz submission' }, 500);
  }
});

/**
 * GET /api/stats
 * 全ユーザーの統計（正解が逆算できないよう、正解価格・乖離率は返さない）
 */
app.get('/api/stats', async (c) => {
  const { averages, counts, totalParticipants } = await getAggregatedStats(c.env.DB);

  const items: GlobalStatsItem[] = QUIZ_MASTER.map((q) => ({
    questionId: q.id,
    title: q.title,
    averageExpected: averages[q.id] !== undefined ? Math.round(averages[q.id]) : null,
    totalResponses: counts[q.id] ?? 0,
  }));

  return c.json({
    totalParticipants,
    items,
  });
});

export default app;
