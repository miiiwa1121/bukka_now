// server/scoring.ts: スコアリング、上位パーセンタイル判定、および回答分布棒グラフ生成

import { QUIZ_MASTER, SENSE_TYPES } from '../src/data/quizMaster';
import type {
  DistributionBin,
  QuestionResultItem,
  QuizSubmissionResult,
  UserAnswerItem,
} from '../src/types/quiz';

/**
 * 標準正規分布の累積分布関数（CDF）近似
 */
function normalCDF(z: number): number {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * erf);
}

/**
 * 総合スコア（0〜100点）から「上位何%」を算出（平均65、標準偏差16の母集団モデル）
 */
export function calculateTopPercentile(score: number): number {
  const mean = 65;
  const stdDev = 16;
  const z = (score - mean) / stdDev;
  const cdf = normalCDF(z);
  const topPercent = (1 - cdf) * 100;
  const clamped = Math.max(0.5, Math.min(99.5, topPercent));
  return Number(clamped.toFixed(1));
}

/**
 * 各設問の回答分布（10分割の粒度の高い横棒ヒストグラム用ビン）および最低値・最高値の生成
 */
export function generateDistribution(
  actualPrice: number,
  userAnswer: number,
  averageExpected: number,
  allAnswersForQuestion: number[] = []
): { distribution: DistributionBin[]; minAnswer: number; maxAnswer: number; totalResponses: number; rawAnswers: number[] } {
  // 基準となる分布範囲（中央に正解価格、ユーザー回答も含める）
  const lowerBound = Math.min(Math.round(actualPrice * 0.5), Math.round(userAnswer * 0.85), Math.round(averageExpected * 0.85));
  const upperBound = Math.max(Math.round(actualPrice * 1.5), Math.round(userAnswer * 1.15), Math.round(averageExpected * 1.15));

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
  const samples = allAnswersForQuestion.length > 0
    ? [...allAnswersForQuestion, userAnswer]
    : [userAnswer];

  const totalResponses = samples.length;
  const minAnswer = Math.min(...samples);
  const maxAnswer = Math.max(...samples);

  const distribution = binsDef.map((b) => {
    const count = samples.filter((s) => s >= b.min && s <= b.max).length;
    const percent = Math.round((count / totalResponses) * 100);
    const hasUserAnswer = userAnswer >= b.min && userAnswer <= b.max;
    const hasActualPrice = actualPrice >= b.min && actualPrice <= b.max;
    const hasAverageExpected = averageExpected >= b.min && averageExpected <= b.max;

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

  return { distribution, minAnswer, maxAnswer, totalResponses, rawAnswers: samples };
}

export function calculateQuizResult(
  userAnswers: UserAnswerItem[],
  aggregatedAverages: Record<string, number> = {},
  historicalAnswers: Record<string, number[]> = {}
): QuizSubmissionResult {
  const masterMap = new Map(QUIZ_MASTER.map((q) => [q.id, q]));

  const questionResults: QuestionResultItem[] = [];
  let totalScoreSum = 0;
  let biasSum = 0;

  for (const answerItem of userAnswers) {
    const q = masterMap.get(answerItem.questionId);
    if (!q) continue;

    const userAnswer = Number(answerItem.answer ?? (answerItem as unknown as Record<string, unknown>).userAnswer) || 0;
    const actual = q.actualPrice;

    // 相対誤差率
    const errorRate = Math.abs(userAnswer - actual) / actual;
    const bias = (userAnswer - actual) / actual;
    biasSum += bias;

    // 設問スコア: 誤差率0%で100点、40%以上で0点
    const questionScore = Math.max(0, Math.min(100, Math.round(100 * (1 - errorRate / 0.4))));
    totalScoreSum += questionScore;

    // 世間平均
    const averageExpected = aggregatedAverages[q.id] ?? actual;

    // 分布棒グラフおよび最高値・最低値・回答者数
    const { distribution, minAnswer, maxAnswer, totalResponses, rawAnswers } = generateDistribution(
      actual,
      userAnswer,
      Math.round(averageExpected),
      historicalAnswers[q.id] ?? []
    );

    questionResults.push({
      questionId: q.id,
      title: q.title,
      category: q.category,
      categoryLabel: q.categoryLabel,
      userAnswer,
      actualPrice: actual,
      averageExpected: Math.round(averageExpected),
      minAnswer,
      maxAnswer,
      totalResponses,
      unit: q.unit,
      score: questionScore,
      errorRate: Number(errorRate.toFixed(3)),
      priceNote: q.priceNote,
      pastPrice: q.pastPrice,
      pastPriceYear: q.pastPriceYear,
      distribution,
      rawAnswers,
    });
  }

  const answeredCount = questionResults.length || 1;
  const totalScore = Math.round(totalScoreSum / answeredCount);
  const biasScore = Number((biasSum / answeredCount).toFixed(3));
  const topPercentile = calculateTopPercentile(totalScore);

  // タイプ判定（絵文字不使用）
  let typeKey = 'rough';
  let biasTendency: 'balanced' | 'underestimated' | 'overestimated' | 'volatile' = 'balanced';

  if (totalScore >= 80) {
    typeKey = 'master';
    biasTendency = 'balanced';
  } else if (biasScore <= -0.08) {
    typeKey = 'timeslip';
    biasTendency = 'underestimated';
  } else if (biasScore >= 0.08) {
    typeKey = 'panic';
    biasTendency = 'overestimated';
  } else {
    typeKey = 'rough';
    biasTendency = 'volatile';
  }

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
