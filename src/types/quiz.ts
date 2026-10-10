// src/types/quiz.ts: クイズ・診断・統計の共通型定義

export type CategoryType = 'food' | 'dining' | 'daily' | 'infrastructure' | 'service' | 'goods';

export interface QuestionData {
  id: string;
  category: CategoryType;
  categoryLabel: string;
  title: string;
  subtitle: string;
  unit: string;
  actualPrice: number;
  pastPrice?: number;
  pastPriceYear?: string;
  priceNote: string;
}

// クライアントへ送信する設問データ（カンニング防止のため actualPrice, priceNote は除外）
export type PublicQuestion = Omit<QuestionData, 'actualPrice' | 'priceNote'> & {
  averageExpected: number;
  totalResponses: number; // 質問ごとの回答者数
};

export interface UserAnswerItem {
  questionId: string;
  answer: number;
}

export interface SenseTypeInfo {
  code: 'master' | 'timeslip' | 'panic' | 'rough';
  name: string;
  tagline: string;
  description: string;
  badgeColor: string;
}

// 結果画面の棒グラフ（ユーザー回答分布）の各ビン
export interface DistributionBin {
  label: string;
  min: number;
  max: number;
  count: number;
  percent: number;
  hasUserAnswer: boolean;
  hasActualPrice: boolean;
  hasAverageExpected: boolean;
}

export interface QuestionResultItem {
  questionId: string;
  title: string;
  category: CategoryType;
  categoryLabel: string;
  userAnswer: number;
  actualPrice: number;
  averageExpected: number;
  minAnswer: number;     // 全ユーザー回答の最低値
  maxAnswer: number;     // 全ユーザー回答の最高値
  totalResponses: number; // 質問ごとの回答者数
  unit: string;
  score: number;
  errorRate: number;
  priceNote: string;
  distribution: DistributionBin[];
}

export interface QuizSubmissionResult {
  submissionId: string;
  totalScore: number;
  topPercentile: number; // 上位何% (例: 8.5)
  senseType: SenseTypeInfo;
  biasScore: number;
  biasTendency: 'balanced' | 'underestimated' | 'overestimated' | 'volatile';
  questionResults: QuestionResultItem[];
}

export interface GlobalStatsItem {
  questionId: string;
  title: string;
  actualPrice: number;
  averageExpected: number;
  gapPercent: number;
  trend: 'underestimated' | 'overestimated' | 'accurate';
}
