// src/types/quiz.ts: クイズ・診断・統計の共通型定義

export type CategoryType = 'food' | 'dining' | 'daily' | 'infrastructure' | 'service' | 'goods';

// 価格推移の1点（年平均価格。単位は設問の単位に換算済み）
export interface PricePoint {
  year: number;
  price: number;
}

export interface QuestionData {
  id: string;           // 's' + 小売物価統計調査の銘柄符号（例: s1001）
  category: CategoryType;
  categoryLabel: string;
  title: string;
  subtitle: string;     // 価格の前提（地域・年・出典）
  unit: string;
  actualPrice: number;  // 正解（東京都区部・2025年平均）
  priceHistory: PricePoint[]; // 年平均価格の推移（古い順、最後が 2025年）
  priceNote: string;    // コラム（調査銘柄と推移の要約）
}

// クライアントへ送信する設問データ
// カンニング防止のため、正解（actualPrice）・解説（priceNote）・正解のヒントになる値（priceHistory, 世間平均）は除外
export type PublicQuestion = Omit<QuestionData, 'actualPrice' | 'priceNote' | 'priceHistory'> & {
  totalResponses: number; // 質問ごとの回答者数
};

export interface UserAnswerItem {
  questionId: string;
  answer: number | null; // null は未回答（時間切れで入力なし）
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
  userAnswer: number | null; // null は未回答
  actualPrice: number;
  averageExpected: number | null; // 集計対象（正解の 1/5〜5倍）の回答の平均。対象がなければ null
  minAnswer: number | null;       // 集計対象の回答の最低値
  maxAnswer: number | null;       // 集計対象の回答の最高値
  totalResponses: number; // 質問ごとの回答者数（未回答は含まない。集計対象外の回答は含む）
  unit: string;
  score: number;
  errorRate: number | null; // 未回答は null
  priceNote: string;
  priceHistory: PricePoint[]; // 年平均価格の推移（古い順、最後が正解の年）
  distribution: DistributionBin[];
  rawAnswers: number[];  // 各回答者の生回答値（直近最大500件＋今回の回答。1単位プロット用）
}

export interface QuizSubmissionResult {
  submissionId: string;
  totalScore: number;
  topPercentile: number; // 上位何% (例: 8.5)。これまでの全診断の総合スコアと比べた順位
  senseType: SenseTypeInfo;
  biasScore: number;
  biasTendency: 'balanced' | 'underestimated' | 'overestimated' | 'volatile';
  questionResults: QuestionResultItem[];
}

// 全体統計（正解が逆算できないよう、正解価格・乖離率は含めない）
export interface GlobalStatsItem {
  questionId: string;
  title: string;
  averageExpected: number | null; // 回答がない設問は null
  totalResponses: number;
}
