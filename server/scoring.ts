// server/scoring.ts: スコアリング、上位パーセンタイル判定、および回答分布棒グラフ生成

import { QUIZ_MASTER, SENSE_TYPES } from '../src/data/quizMaster';
import type {
  DistributionBin,
  QuestionResultItem,
  QuizSubmissionResult,
  UserAnswerItem,
} from '../src/types/quiz';
import { isInRange } from './aggregation';

// 設問スコアが0点になる比率。回答が正解の3倍、または3分の1で0点
export const SCORE_ZERO_RATIO = 3;

/**
 * 設問スコア（0〜100点）。回答と正解の比率の対数で測る（高すぎと安すぎを同じ厳しさで扱う）
 * 正解ちょうどで100点、正解の3倍・3分の1で0点。例: 正解1,000円に 800円 → 80点、1,500円 → 63点、500円 → 37点
 */
/**
 * 1問ぶんのバイアス（高めに答えたら正、安めなら負）。回答と正解の比率の対数で測る
 * 設問スコアと同じく、2倍（+0.69）と半分（−0.69）を同じ大きさで扱う。相対誤差の平均だと、高すぎる回答（特に ×10 の打ち間違い）ほど大きく効いた
 */
export function answerBias(answer: number, actualPrice: number): number {
  return Math.log(answer / actualPrice);
}

export function scoreQuestion(answer: number, actualPrice: number): number {
  const distance = Math.abs(Math.log(answer / actualPrice));
  return Math.max(0, Math.min(100, Math.round(100 * (1 - distance / Math.log(SCORE_ZERO_RATIO)))));
}

/**
 * 総合スコアから「上位何%」を算出する。これまでの全診断の総合スコア分布（スコア → 人数）と比べる
 * 自分を含めた順位の中央（同点は真ん中扱い）を割合にする。比較対象がいなければ 50%
 */
export function calculateTopPercentile(score: number, scoreCounts: Record<number, number> = {}): number {
  let higher = 0;
  let equal = 0;
  let total = 0;
  for (const [key, count] of Object.entries(scoreCounts)) {
    const s = Number(key);
    total += count;
    if (s > score) higher += count;
    else if (s === score) equal += count;
  }
  const topPercent = ((higher + (equal + 1) / 2) / (total + 1)) * 100;
  return Number(Math.max(0.1, Math.min(100, topPercent)).toFixed(1));
}

/**
 * 各設問の回答分布（10分割の粒度の高い横棒ヒストグラム用ビン）の生成
 * 母集団は全回答（集計対象外の回答も含む）。未回答（null）は自分の印を付けない
 */
export function generateDistribution(
  actualPrice: number,
  userAnswer: number | null,
  averageExpected: number | null,
  allAnswersForQuestion: number[] = []
): { distribution: DistributionBin[]; rawAnswers: number[] } {
  // 基準となる分布範囲（中央に正解価格、ユーザー回答・平均も含める）
  const anchors = [userAnswer, averageExpected].filter((v): v is number => v !== null);
  const lowerBound = Math.min(Math.round(actualPrice * 0.5), ...anchors.map((v) => Math.round(v * 0.85)));
  const upperBound = Math.max(Math.round(actualPrice * 1.5), ...anchors.map((v) => Math.round(v * 1.15)));

  // 10分割のステップ幅を計算し、キリの良い数値に丸める
  const rawStep = (upperBound - lowerBound) / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceFactor = 1;
  if (normalized > 5) niceFactor = 10;
  else if (normalized > 2) niceFactor = 5;
  else if (normalized > 1) niceFactor = 2;
  const step = Math.max(1, Math.round(niceFactor * magnitude));

  // キリの良い開始点
  const startPrice = Math.max(1, Math.floor(lowerBound / step) * step);

  const binCount = 10;
  const binsDef: { label: string; min: number; max: number }[] = [];

  for (let i = 0; i < binCount; i++) {
    const bMin = startPrice + i * step;
    const bMax = i === binCount - 1 ? Infinity : bMin + step - 1;
    let label = '';
    if (i === 0) {
      label = `〜${(bMin + step).toLocaleString()}円`;
    } else if (i === binCount - 1) {
      label = `${bMin.toLocaleString()}円〜`;
    } else {
      label = `${bMin.toLocaleString()}円`;
    }
    binsDef.push({ label, min: bMin, max: bMax });
  }

  // 実際のユーザー回答データのみを使用（モックデータは一切使用しない）
  const samples = userAnswer !== null ? [...allAnswersForQuestion, userAnswer] : [...allAnswersForQuestion];
  const totalResponses = samples.length;

  const distribution = binsDef.map((b) => {
    const count = samples.filter((s) => s >= b.min && s <= b.max).length;
    const percent = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
    const hasUserAnswer = userAnswer !== null && userAnswer >= b.min && userAnswer <= b.max;
    const hasActualPrice = actualPrice >= b.min && actualPrice <= b.max;
    const hasAverageExpected = averageExpected !== null && averageExpected >= b.min && averageExpected <= b.max;

    return {
      label: b.label,
      min: b.min,
      max: b.max,
      count,
      percent,
      hasUserAnswer,
      hasActualPrice,
      hasAverageExpected,
    };
  });

  return { distribution, rawAnswers: samples };
}

/**
 * 設問別の既存回答の集計値（今回の回答は含まない。item_aggregates の1行）
 */
export interface QuestionStats {
  totalResponses: number;   // 全回答数（集計対象外も含む）
  inRangeResponses: number; // 集計対象の回答数
  sumAnswers: number;       // 集計対象の回答の合計
  min: number | null;       // 集計対象の回答の最低値
  max: number | null;       // 集計対象の回答の最高値
}

export interface ScoringContext {
  questionStats?: Record<string, QuestionStats>;
  historicalAnswers?: Record<string, number[]>; // 設問ごとの直近の回答（分布用）
  scoreCounts?: Record<number, number>;         // これまでの診断の総合スコア → 人数
}

/**
 * 物価感覚タイプの判定（絵文字不使用）。上から順に判定する
 */
export function determineSenseType(
  totalScore: number,
  biasScore: number
): { typeKey: 'master' | 'timeslip' | 'panic' | 'rough'; biasTendency: QuizSubmissionResult['biasTendency'] } {
  if (totalScore >= 80) return { typeKey: 'master', biasTendency: 'balanced' };
  if (biasScore <= -0.08) return { typeKey: 'timeslip', biasTendency: 'underestimated' };
  if (biasScore >= 0.08) return { typeKey: 'panic', biasTendency: 'overestimated' };
  return { typeKey: 'rough', biasTendency: 'volatile' };
}

export function calculateQuizResult(
  userAnswers: UserAnswerItem[],
  { questionStats = {}, historicalAnswers = {}, scoreCounts = {} }: ScoringContext = {}
): QuizSubmissionResult {
  const masterMap = new Map(QUIZ_MASTER.map((q) => [q.id, q]));

  const questionResults: QuestionResultItem[] = [];
  let totalScoreSum = 0;
  let biasSum = 0;
  let answeredCount = 0;

  for (const answerItem of userAnswers) {
    const q = masterMap.get(answerItem.questionId);
    if (!q) continue;

    const userAnswer = answerItem.answer;
    const actual = q.actualPrice;

    // 未回答は0点。誤差率・バイアスは計算しない（バイアスは回答した設問だけで平均する）
    let errorRate: number | null = null;
    let questionScore = 0;
    if (userAnswer !== null) {
      errorRate = Math.abs(userAnswer - actual) / actual;
      biasSum += answerBias(userAnswer, actual);
      answeredCount++;
      questionScore = scoreQuestion(userAnswer, actual);
    }
    totalScoreSum += questionScore;

    // 世間平均・最低値・最高値は集計対象（正解の 1/5〜5倍）の回答だけで出す。今回の回答も対象なら含める
    const stats = questionStats[q.id];
    const mineInRange = userAnswer !== null && isInRange(userAnswer, actual);
    const inRangeCount = (stats?.inRangeResponses ?? 0) + (mineInRange ? 1 : 0);
    const inRangeSum = (stats?.sumAnswers ?? 0) + (mineInRange ? userAnswer : 0);
    const averageExpected = inRangeCount > 0 ? Math.round(inRangeSum / inRangeCount) : null;
    const rangeValues = [stats?.min, stats?.max, mineInRange ? userAnswer : null].filter(
      (v): v is number => v !== null && v !== undefined
    );
    const minAnswer = rangeValues.length > 0 ? Math.min(...rangeValues) : null;
    const maxAnswer = rangeValues.length > 0 ? Math.max(...rangeValues) : null;
    const totalResponses = (stats?.totalResponses ?? 0) + (userAnswer !== null ? 1 : 0);

    // 分布棒グラフ（直近の回答サンプルから生成）
    const { distribution, rawAnswers } = generateDistribution(
      actual,
      userAnswer,
      averageExpected,
      historicalAnswers[q.id] ?? []
    );

    questionResults.push({
      questionId: q.id,
      title: q.title,
      category: q.category,
      categoryLabel: q.categoryLabel,
      userAnswer,
      actualPrice: actual,
      averageExpected,
      minAnswer,
      maxAnswer,
      totalResponses,
      unit: q.unit,
      score: questionScore,
      errorRate: errorRate !== null ? Number(errorRate.toFixed(3)) : null,
      priceNote: q.priceNote,
      priceHistory: q.priceHistory,
      distribution,
      rawAnswers,
    });
  }

  const totalScore = Math.round(totalScoreSum / (questionResults.length || 1));
  const biasScore = Number((answeredCount > 0 ? biasSum / answeredCount : 0).toFixed(3));
  const topPercentile = calculateTopPercentile(totalScore, scoreCounts);

  const { typeKey, biasTendency } = determineSenseType(totalScore, biasScore);
  const senseType = SENSE_TYPES[typeKey] ?? SENSE_TYPES.master;
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    submissionId,
    totalScore,
    topPercentile,
    senseType,
    biasScore,
    biasTendency,
    questionResults,
  };
}
