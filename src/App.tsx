// src/App.tsx: bukka_now メインアプリケーション（シンプル is best 仕様 ＆ 10秒タイマー搭載）

import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { NumberKeypad } from './components/NumberKeypad';
import { ResultDashboard } from './components/ResultDashboard';
import type { PublicQuestion, QuizSubmissionResult, UserAnswerItem } from './types/quiz';

const QUESTION_TIME_LIMIT = 10;

export const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'quiz' | 'result'>('landing');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentInputValue, setCurrentInputValue] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [isTimeUpNotice, setIsTimeUpNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);

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
    try {
      const res = await fetch(`/api/quiz?count=${questionCount}`);
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
      setIsLoading(false);
      setView('quiz');
    } catch (err) {
      console.error('Failed to load quiz from API:', err);
      alert('クイズデータの取得に失敗しました。接続環境を確認して再度お試しください。');
      setIsLoading(false);
    }
  };

  const currentQ = questions[currentIndex];

  const updateCurrentValueForQuestion = (index: number) => {
    const q = questions[index];
    if (!q) return;
    if (answers[q.id] !== undefined) {
      setCurrentInputValue(answers[q.id]);
    } else {
      setCurrentInputValue(0);
    }
  };

  // 回答を確定して次の問題へ（または最終送信）
  const advanceWithAnswer = async (answerVal: number) => {
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
      setIsSubmitting(true);
      const answerPayload: UserAnswerItem[] = Object.entries(newAnswers).map(([qId, val]) => ({
        questionId: qId,
        answer: val,
      }));

      try {
        const res = await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: answerPayload }),
        });

        if (!res.ok) {
          throw new Error(`Submit error: ${res.status}`);
        }

        const resData = await res.json<QuizSubmissionResult>();
        setResult(resData);
        setView('result');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('Submission failed:', err);
        alert('診断結果の送信・集計処理に失敗しました。');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // 10秒タイマーのインターバル管理
  useEffect(() => {
    if (view !== 'quiz' || isSubmitting) return;

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
  }, [currentIndex, view, isSubmitting]);

  // 残り時間が0秒になったときのタイムアップ自動遷移
  useEffect(() => {
    if (view !== 'quiz' || isSubmitting || timeLeft > 0) return;

    setIsTimeUpNotice(true);
    const timeoutId = setTimeout(() => {
      const val = currentInputRef.current > 0 ? currentInputRef.current : 0;
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
        onReset={() => setView('landing')}
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
          />
        )}

        {/* 2. クイズ回答ビュー（テンキー入力型・10秒タイマー・質問ごとの回答者数表示） */}
        {view === 'quiz' && currentQ && (
          <div className="glass-card animate-fade-in" id="quiz-card-view">
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
              disabled={isSubmitting || isTimeUpNotice}
            />

            {/* アクション補助 */}
            <div className="quiz-actions-minimal">
              {currentIndex > 0 ? (
                <button
                  type="button"
                  className="btn-subtle"
                  id="btn-quiz-prev"
                  onClick={handlePrev}
                  disabled={isSubmitting || isTimeUpNotice}
                >
                  前へ戻る
                </button>
              ) : (
                <div />
              )}

              <span className="enter-key-guide">
                {isTimeUpNotice
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
            onRetry={() => setView('landing')}
          />
        )}
      </main>

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
    </div>
  );
};

export default App;
