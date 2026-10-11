// src/App.tsx: bukka_now メインアプリケーション（シンプル is best 仕様 ＆ 10秒タイマー搭載）

import React, { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Header } from './components/Header';
import { InlineNotice } from './components/InlineNotice';
import { LandingView } from './components/LandingView';
import { NumberKeypad } from './components/NumberKeypad';
import { ResultDashboard } from './components/ResultDashboard';
import type { PublicQuestion, QuizSubmissionResult, UserAnswerItem } from './types/quiz';

const QUESTION_TIME_LIMIT = 10;
// 画面内に出すエラーの文言（alert() は使わない）
const START_RATE_LIMIT_MESSAGE = 'アクセスが集中しています。1分ほど待ってから、もう一度お試しください。';
const START_ERROR_MESSAGE = 'クイズを読み込めませんでした。通信環境を確認して、もう一度お試しください。';
const SUBMIT_RATE_LIMIT_MESSAGE = 'アクセスが集中しています。回答はそのまま残っているので、1分ほど待ってから送信し直してください。';
const SUBMIT_ERROR_MESSAGE = '診断結果を受け取れませんでした。回答はそのまま残っているので、通信環境を確認して送信し直してください。';

export const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'quiz' | 'result'>('landing');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 設問ID → 回答金額（null は時間切れの未回答）
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [currentInputValue, setCurrentInputValue] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [isTimeUpNotice, setIsTimeUpNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  // 画面内のエラー表示（トップ: 出題の取得失敗 / クイズ: 送信失敗）
  const [startError, setStartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // クイズ中に「トップに戻る」を押したときの確認ダイアログ
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // currentInputValue と isSubmitting を最新の状態でタイマーから参照するための ref
  const currentInputRef = useRef(currentInputValue);
  currentInputRef.current = currentInputValue;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  // 初回マウント時に全体の累計回答者数をフェッチ
  useEffect(() => {
    fetch('/api/quiz?count=10')
      .then((res) => res.json<{ totalParticipants?: number }>())
      .then((data) => {
        if (data.totalParticipants) {
          setTotalParticipants(data.totalParticipants);
        }
      })
      .catch(() => {
        // fallback
      });
  }, []);

  // 指定設問数でクイズデータをフェッチして開始（DB / APIと本格連携）
  const handleStart = async () => {
    setIsLoading(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/quiz?count=${questionCount}`);
      if (res.status === 429) {
        setStartError(START_RATE_LIMIT_MESSAGE);
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json<{ questions: PublicQuestion[]; totalParticipants?: number }>();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions received from server');
      }

      if (data.totalParticipants) {
        setTotalParticipants(data.totalParticipants);
      }

      setQuestions(data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setCurrentInputValue(0);
      setTimeLeft(QUESTION_TIME_LIMIT);
      setIsTimeUpNotice(false);
      setResult(null);
      setSubmitError(null);
      setIsResetConfirmOpen(false);
      setIsLoading(false);
      setView('quiz');
    } catch (err) {
      console.error('Failed to load quiz from API:', err);
      setStartError(START_ERROR_MESSAGE);
      setIsLoading(false);
    }
  };

  // トップに戻る（確認なし）
  const goToLanding = () => {
    setIsResetConfirmOpen(false);
    setSubmitError(null);
    setStartError(null);
    setView('landing');
  };

  // ロゴ・「最初に戻る」。クイズ中は回答が消えるので確認する（送信中は受け付けない）
  const handleReset = () => {
    if (view !== 'quiz') {
      goToLanding();
      return;
    }
    if (isSubmittingRef.current) return;
    setIsResetConfirmOpen(true);
  };

  // 全問の回答を送信して結果画面へ。失敗したら画面内に理由と「もう一度送信」を出す（自動では送り直さない）
  const submitAnswers = async (finalAnswers: Record<string, number | null>) => {
    if (isSubmittingRef.current) return;
    setSubmitError(null);
    setIsSubmitting(true);
    const answerPayload: UserAnswerItem[] = Object.entries(finalAnswers).map(([qId, val]) => ({
      questionId: qId,
      answer: val,
    }));

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerPayload }),
      });

      if (res.status === 429) {
        setSubmitError(SUBMIT_RATE_LIMIT_MESSAGE);
        return;
      }
      if (!res.ok) {
        throw new Error(`Submit error: ${res.status}`);
      }

      const resData = await res.json<QuizSubmissionResult>();
      setResult(resData);
      setIsResetConfirmOpen(false);
      setView('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submission failed:', err);
      setSubmitError(SUBMIT_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];

  const updateCurrentValueForQuestion = (index: number) => {
    const q = questions[index];
    if (!q) return;
    // 未回答（null）や未到達の設問は入力欄を空にする
    setCurrentInputValue(answers[q.id] ?? 0);
  };

  // 回答を確定して次の問題へ（または最終送信）
  const advanceWithAnswer = async (answerVal: number | null) => {
    if (!currentQ || isSubmittingRef.current) return;

    const newAnswers = {
      ...answers,
      [currentQ.id]: answerVal,
    };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      updateCurrentValueForQuestion(nextIdx);
      setTimeLeft(QUESTION_TIME_LIMIT);
      setIsTimeUpNotice(false);
    } else {
      // 最終問題 -> サーバーAPIへ送信してDBに保存・集計
      await submitAnswers(newAnswers);
    }
  };

  // 10秒タイマーのインターバル管理
  // 送信に失敗している間はタイマーを止める（再スタートして自動で送り直すことはしない）
  useEffect(() => {
    if (view !== 'quiz' || isSubmitting || submitError) return;

    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsTimeUpNotice(false);

    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [currentIndex, view, isSubmitting, submitError]);

  // 残り時間が0秒になったときのタイムアップ自動遷移
  useEffect(() => {
    if (view !== 'quiz' || isSubmitting || submitError || timeLeft > 0) return;

    setIsTimeUpNotice(true);
    const timeoutId = setTimeout(() => {
      // 入力がないまま時間切れになった設問は未回答（null）として送る。0円として集計しない
      const val = currentInputRef.current > 0 ? currentInputRef.current : null;
      advanceWithAnswer(val);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [timeLeft, view]);

  // 手動でのOK押下（次へ進む / 最終送信）
  const handleNext = () => {
    if (!currentQ || currentInputValue <= 0 || isSubmitting) return;
    advanceWithAnswer(currentInputValue);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      updateCurrentValueForQuestion(prevIdx);
      setTimeLeft(QUESTION_TIME_LIMIT);
      setIsTimeUpNotice(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        onReset={handleReset}
        showReset={view !== 'landing'}
      />

      <main className="main-content">
        {/* 1. ランディングビュー（シンプル is best） */}
        {view === 'landing' && (
          <LandingView
            questionCount={questionCount}
            onQuestionCountChange={setQuestionCount}
            onStart={handleStart}
            totalParticipants={totalParticipants}
            isLoading={isLoading}
            errorMessage={startError}
          />
        )}

        {/* 2. クイズ回答ビュー（テンキー入力型・10秒タイマー・質問ごとの回答者数表示） */}
        {view === 'quiz' && currentQ && (
          <div className="glass-card animate-fade-in quiz-card" id="quiz-card-view">
            {/* プログレスバー & 10秒タイマー & 質問ごとの回答者数 */}
            <div className="quiz-progress-bar">
              <div className="progress-header">
                <span className="progress-step">
                  第 {currentIndex + 1} 問 / 全 {questions.length} 問
                </span>

                {/* 10秒カウントダウンタイマーバッジ */}
                <div
                  className={`quiz-timer-badge ${timeLeft <= 3 ? 'is-warning' : ''} ${isTimeUpNotice ? 'is-time-up' : ''}`}
                  id="quiz-timer-badge"
                >
                  <span className="timer-label">制限時間</span>
                  <span className="timer-seconds" id="quiz-timer-countdown">
                    {isTimeUpNotice ? '時間切れ' : `${timeLeft}秒`}
                  </span>
                </div>

                <span className="question-respondents-tag" id="question-respondents-tag">
                  回答者数: <strong>{currentQ.totalResponses.toLocaleString()}</strong> 人
                </span>
              </div>

              {/* 設問進捗トラック */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>

              {/* 10秒カウントダウンゲージ */}
              <div className="timer-gauge-track">
                <div
                  className={`timer-gauge-fill ${timeLeft <= 3 ? 'is-warning' : ''}`}
                  style={{ width: `${(timeLeft / QUESTION_TIME_LIMIT) * 100}%` }}
                />
              </div>
            </div>

            {/* 設問タイトル */}
            <div className="quiz-header-minimal">
              <h2 className="question-title-clean">{currentQ.title}</h2>
              <p className="question-subtitle-clean">{currentQ.subtitle}</p>
            </div>

            {/* 0〜9のテンキー ＋ OKボタン */}
            <NumberKeypad
              value={currentInputValue}
              onChange={setCurrentInputValue}
              onSubmit={handleNext}
              unit={currentQ.unit}
              // 確認ダイアログ中は、数字・Enter・Esc をダイアログ側に渡す
              disabled={isSubmitting || isTimeUpNotice || submitError !== null || isResetConfirmOpen}
            />

            {/* 送信失敗（回答は保持したまま、手動で送り直す） */}
            {submitError && (
              <InlineNotice
                message={submitError}
                actionLabel={isSubmitting ? '送信中...' : 'もう一度送信'}
                onAction={() => submitAnswers(answers)}
                actionDisabled={isSubmitting}
              />
            )}

            {/* アクション補助 */}
            <div className="quiz-actions-minimal">
              {currentIndex > 0 ? (
                <button
                  type="button"
                  className="btn-subtle"
                  id="btn-quiz-prev"
                  onClick={handlePrev}
                  disabled={isSubmitting || isTimeUpNotice || submitError !== null}
                >
                  前へ戻る
                </button>
              ) : (
                <div />
              )}

              {/* 「Enterキー」の案内はキーボードのない端末では出さない（is-keyboard-hint） */}
              <span className={`enter-key-guide ${!submitError && !isTimeUpNotice && !isSubmitting ? 'is-keyboard-hint' : ''}`}>
                {submitError
                  ? ''
                  : isTimeUpNotice
                  ? '時間切れ！次へ進みます'
                  : isSubmitting
                  ? '診断中...'
                  : 'Enterキーでも決定可能'}
              </span>
            </div>
          </div>
        )}

        {/* 3. 診断結果ビュー（シンプル is best・最高値/最低値/回答者数完備） */}
        {view === 'result' && result && (
          <ResultDashboard
            result={result}
            onRetry={goToLanding}
          />
        )}
      </main>

      {/* クイズ回答中は集中できるようフッターを出さない（トップ・結果画面のみ表示） */}
      {view !== 'quiz' && (
        <footer className="app-footer">
          <div className="footer-brand">
            <span className="footer-logo">bukka_now</span>
            <span className="footer-tagline">物価意識調査</span>
          </div>

          <dl className="footer-info">
            <div className="footer-info-row">
              <dt>開発者</dt>
              <dd className="footer-links">
                <a href="https://x.com/miiiwa3330" target="_blank" rel="noopener noreferrer">
                  X: @miiiwa3330
                </a>
                <a href="https://github.com/miiiwa3330/" target="_blank" rel="noopener noreferrer">
                  GitHub: @miiiwa3330
                </a>
              </dd>
            </div>
            <div className="footer-info-row">
              <dt>ソースコード</dt>
              <dd>
                <a href="https://github.com/miiiwa3330/bukka_now" target="_blank" rel="noopener noreferrer">
                  GitHub: miiiwa3330/bukka_now
                </a>
              </dd>
            </div>
            <div className="footer-info-row">
              <dt>価格の出典</dt>
              <dd>
                <a href="https://www.stat.go.jp/data/kouri/index.html" target="_blank" rel="noopener noreferrer">
                  総務省統計局「小売物価統計調査」
                </a>
                （東京都区部の年平均価格）
              </dd>
            </div>
          </dl>

          <p className="footer-note">
            正解価格は東京都区部の2025年平均（郵便・NHK受信料・新聞・映画は全国統一価格）で、地域や店舗によって異なります。回答は個人を特定しない形で集計されます。
          </p>

          <p className="footer-copyright">© 2026 bukka_now</p>
        </footer>
      )}

      {/* クイズ中にトップへ戻るときの確認。タイマーは止めない（開閉で残り時間を延ばせないようにする） */}
      <ConfirmDialog
        open={isResetConfirmOpen && view === 'quiz'}
        title="トップに戻りますか？"
        message="ここまでの回答は保存されず、消えてしまいます。"
        confirmLabel="トップに戻る"
        cancelLabel="クイズを続ける"
        onConfirm={goToLanding}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};

export default App;
