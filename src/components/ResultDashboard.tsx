// src/components/ResultDashboard.tsx: 診断結果ダッシュボード（ホワイトボード横スライド機能・1単位プロット棒グラフ詳細搭載）

import React, { useState, useEffect } from 'react';
import type { QuizSubmissionResult } from '../types/quiz';
import { formatAmount } from '../utils/format';
import { DetailedPlotChart } from './DetailedPlotChart';
import { PriceTrendChart } from './PriceTrendChart';
import { DistributionBarChart } from './DistributionBarChart';
import { PriceNoteColumn } from './PriceNoteColumn';

interface ResultDashboardProps {
  result: QuizSubmissionResult;
  onRetry: () => void;
}

interface IntenseComment {
  punchline: string;
  message: string;
  levelClass: string;
}

/**
 * 総合スコアに応じた情緒激しく派手な辛口〜大絶賛コメント（100点・0点は別枠・5点刻み全22段階・絵文字ゼロ厳守）
 */
function getIntenseComment(score: number): IntenseComment {
  // 【特別枠】100点満点（完全無欠・絶対神）
  if (score === 100) {
    return {
      punchline: '全知全能の絶対神！100点満点！！',
      message: '全問ピタリ一致の奇跡！前世は日本の消費者物価指数か！？この世のすべての値札がお前の頭脳と直結している！日銀総裁もお前の前で正座して教えを乞うレベル！生ける伝説！！',
      levelClass: 'comment-perfect-100',
    };
  }

  // 【特別枠】0点（前代未聞・完全壊滅）
  if (score === 0) {
    return {
      punchline: '前代未聞の完全0点！逆にすごい！！',
      message: '1円の相場も合ってない奇跡の全滅！お前は一体どこの銀河系から来た宇宙人だ！？買い物かごの持ち方からやり直せ！自炊どころか財布没収で外出禁止レベル！！',
      levelClass: 'comment-zero-point',
    };
  }

  // 通常5点刻み枠
  if (score >= 95) {
    return {
      punchline: '最高天才！神！',
      message: '相場の絶対神降臨！日本の全スーパーマーケットがひれ伏す超絶相場眼！あんたが総理大臣をやれ！！毎日の買い物で1円たりとも搾取されない無敵の節約神！！',
      levelClass: 'comment-god',
    };
  }
  if (score >= 90) {
    return {
      punchline: '人間国宝！歩く物価電卓！',
      message: '凄まじい精度！チラシの裏まで全部把握してるだろ！スーパーの店長もビビるレベルの金銭感覚！日本のインフレを完全に手玉に取ってる！！',
      levelClass: 'comment-god',
    };
  }
  if (score >= 85) {
    return {
      punchline: 'ヤバすぎ！相場感覚の鬼！',
      message: '毎日の買い物で1円も無駄にしてないプロの眼力！スーパーの特売チラシ全部脳内に入ってるだろ！家計の守護神すぎる！！',
      levelClass: 'comment-excellent',
    };
  }
  if (score >= 80) {
    return {
      punchline: '超一流！買い物マスター！',
      message: '世間の相場に完全適応！普通にめちゃくちゃ買い物上手で隙がない！レシートをちゃんと見て生きてる証拠！この調子で物価高を生き抜け！',
      levelClass: 'comment-excellent',
    };
  }
  if (score >= 75) {
    return {
      punchline: 'かなりデキる！相場の達人！',
      message: '日常生活の値上がりをしっかり肌で感じ取ってる！財布の紐の締め具合が完璧！無駄遣いゼロの堅実エリート！！',
      levelClass: 'comment-good',
    };
  }
  if (score >= 70) {
    return {
      punchline: '合格！堅実な生活者！',
      message: '世間一般の相場観をしっかりキープ！騙されることもボラれることもない安心クオリティ！地に足ついた買い物ができてるぞ！',
      levelClass: 'comment-good',
    };
  }
  if (score >= 65) {
    return {
      punchline: '悪くない！でも油断大敵！',
      message: '大体合ってるけど微妙にズレてる品目があるぞ！「まあこんなもんか」でカゴに入れてないか！？もう一声値札を凝視しろ！',
      levelClass: 'comment-average',
    };
  }
  if (score >= 60) {
    return {
      punchline: 'まあまあ凡人！流されかけ！',
      message: 'インフレの波にフワフワ流されてるぞ！値上げに気づかずなんとなく買ってないか！？たまにはレシートを直視して現実と向き合え！',
      levelClass: 'comment-average',
    };
  }
  if (score >= 55) {
    return {
      punchline: 'ちょっと感覚鈍ってないか！？',
      message: '去年の価格のまま記憶が止まってないか！？スーパー行くたびに値上げラッシュなんだぞ！もっとアンテナ高く張れ！！',
      levelClass: 'comment-average',
    };
  }
  if (score >= 50) {
    return {
      punchline: '半分ズレてる！危うい一般市民！',
      message: '合ってるやつと外れてるやつの差が激しすぎる！適当に感覚で買い物してないか！？財布からじわじわ金が逃げていってるぞ！',
      levelClass: 'comment-poor',
    };
  }
  if (score >= 45) {
    return {
      punchline: 'おいおい相場感覚ガバガバだぞ！',
      message: '財布の紐が緩みっぱなし！「100円くらい誤差」って思ってないか！？そのチリツモが命取りになるんだよ！今すぐ特売日を調べろ！',
      levelClass: 'comment-poor',
    };
  }
  if (score >= 40) {
    return {
      punchline: '値札見て買い物してるか！？',
      message: 'ノリと勢いでカゴに商品放り込んでるだろ！スーパーで合計金額見て「あれ？こんな高い？」ってレジで焦るタイプ確定！！',
      levelClass: 'comment-poor',
    };
  }
  if (score >= 35) {
    return {
      punchline: 'コンビニ感覚で生きてるだろ！',
      message: '定価で買うのが当たり前になってないか！？スーパーとドラッグストアの価格差を舐めるな！家計簿アプリ入れて現実を見ろ！！',
      levelClass: 'comment-terrible',
    };
  }
  if (score >= 30) {
    return {
      punchline: '相場の異世界転生者かよ！',
      message: 'どこの世界の物価感覚で生きてんだ！高すぎか安すぎかの極端すぎるボケ回答連発！日本の経済ニュースを1秒でも見ろ！！',
      levelClass: 'comment-terrible',
    };
  }
  if (score >= 25) {
    return {
      punchline: '世間知らず疑惑！金銭感覚大崩壊！',
      message: 'どんな貴族生活送ってんだ現実を見ろ！値段見ずにカード切って請求額見て叫ぶタイプだろ！ちょっとは社会の物価を勉強しろ！！',
      levelClass: 'comment-terrible',
    };
  }
  if (score >= 20) {
    return {
      punchline: 'お前マジで買い物したことある！？',
      message: '誰かに買ってもらってばっかりだろ！世の中のあらゆるモノの値段を知らなすぎる！週末に一人でスーパー行って勉強してこい！！',
      levelClass: 'comment-terrible',
    };
  }
  if (score >= 15) {
    return {
      punchline: '大富豪かよ！財布ガバガバの極み！',
      message: '石油王の生まれ変わりか！？全部の値段が異次元にぶっ飛んでるぞ！資本主義のカモにされる前にレシートを額縁に入れて飾れ！！',
      levelClass: 'comment-disaster',
    };
  }
  if (score >= 10) {
    return {
      punchline: '世間知らず！自炊しろボケ！',
      message: 'どんな別世界のブルジョワだよ！物価感覚が壊滅的！自炊しろ！スーパーの入り口から出直してこい！世界は値上がりしてんだよ！！',
      levelClass: 'comment-disaster',
    };
  }
  if (score >= 5) {
    return {
      punchline: '超絶世間知らず！異次元の浮世離れ！',
      message: '全部間違ってる奇跡の感覚！もはや芸術的な世間知らず！お前の財布の中身どうなってんだ！現実世界の日本円を取り戻せ！！',
      levelClass: 'comment-disaster',
    };
  }
  return {
    punchline: '壊滅！！経済のパラレルワールド住人！！',
    message: '1問も合ってない！全滅！息をするように金銭感覚が狂ってる！自炊どころか買い物すら禁止レベル！今すぐスーパーのチラシを音読しろ！！',
    levelClass: 'comment-disaster',
  };
}

type BoardKey = 'summary' | 'detailed' | 'trend';

// スライドボードの並び順と、ナビボタンに表示する名前
const BOARD_ORDER: BoardKey[] = ['summary', 'detailed', 'trend'];
const BOARD_LABELS: Record<BoardKey, string> = {
  summary: 'サマリー',
  detailed: '詳細データ',
  trend: '物価推移',
};

export const ResultDashboard: React.FC<ResultDashboardProps> = ({ result, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [activeBoard, setActiveBoard] = useState<BoardKey>('summary');
  const intenseComment = getIntenseComment(result.totalScore);

  const shareText = `【bukka_now 物価意識診断結果】\n物価意識スコア: 上位 ${result.topPercentile}% （総合スコア: ${result.totalScore}点）\n評価: ${intenseComment.punchline}\n判定: ${result.senseType.name}\n\nリアルタイム回答分布で診断しよう。\n#bukka_now #物価感覚診断`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const xShareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // カード間ナビボタン（レール内に配置し、カードと一緒にスライドする）
  // gapIndex 0 = サマリーと詳細の間 / 1 = 詳細と物価推移の間
  // 左側のボードが表示中なら「→ 右のボードへ」、右側のボードが表示中なら「← 左のボードへ」、それ以外は非表示
  const renderGapNav = (gapIndex: number) => {
    const leftBoard = BOARD_ORDER[gapIndex];
    const rightBoard = BOARD_ORDER[gapIndex + 1];
    const isForward = activeBoard !== rightBoard;
    const isVisible = activeBoard === leftBoard || activeBoard === rightBoard;
    const target = isForward ? rightBoard : leftBoard;

    return (
      <div className="panel-gap-nav">
        <button
          type="button"
          className={`whiteboard-gap-nav-btn ${isVisible ? '' : 'is-hidden'}`}
          onClick={() => setActiveBoard(target)}
          aria-label={isForward ? `${BOARD_LABELS[target]}へ進む` : `${BOARD_LABELS[target]}に戻る`}
          aria-hidden={!isVisible}
          tabIndex={isVisible ? 0 : -1}
          id={`btn-nav-gap-${gapIndex}`}
        >
          {/* 向き・行き先が切り替わるたびに中身をフェードインし直す */}
          <span key={target} className={`gap-nav-content ${isForward ? 'dir-right' : 'dir-left'}`}>
            <span className="gap-nav-icon-wrapper">
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                {isForward ? (
                  <>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </>
                ) : (
                  <>
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </>
                )}
              </svg>
            </span>
            <span className="gap-nav-label">{BOARD_LABELS[target]}</span>
          </span>
        </button>
      </div>
    );
  };

  // スマホ用の面切り替えボタン（左下 = 前の面へ / 右下 = 次の面へ。画面の端から張り出す U 字を横にした形）
  // 行き先がない側は画面外へ引っ込める。引っ込む間に文字が変わらないよう、そのときは端の面の名前のままにする
  const renderEdgeNav = () => {
    const index = BOARD_ORDER.indexOf(activeBoard);
    const prevBoard = BOARD_ORDER[index - 1];
    const nextBoard = BOARD_ORDER[index + 1];
    const prevLabel = BOARD_LABELS[prevBoard ?? BOARD_ORDER[0]];
    const nextLabel = BOARD_LABELS[nextBoard ?? BOARD_ORDER[BOARD_ORDER.length - 1]];

    return (
      <nav className="board-edge-nav" aria-label="結果の表示切り替え">
        <button
          type="button"
          className={`board-edge-btn is-prev ${prevBoard ? '' : 'is-hidden'}`}
          onClick={() => prevBoard && setActiveBoard(prevBoard)}
          aria-label={`${prevLabel}に戻る`}
          aria-hidden={!prevBoard}
          tabIndex={prevBoard ? 0 : -1}
          id="btn-edge-prev"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>{prevLabel}</span>
        </button>
        <button
          type="button"
          className={`board-edge-btn is-next ${nextBoard ? '' : 'is-hidden'}`}
          onClick={() => nextBoard && setActiveBoard(nextBoard)}
          aria-label={`${nextLabel}へ進む`}
          aria-hidden={!nextBoard}
          tabIndex={nextBoard ? 0 : -1}
          id="btn-edge-next"
        >
          <span>{nextLabel}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </nav>
    );
  };

  // スワイプ / ドラッグによる画面切り替えハンドラー（タッチ＆マウス対応）
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || touchStartXRef.current === null || touchStartYRef.current === null) {
      isDraggingRef.current = false;
      return;
    }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartXRef.current;
    const diffY = endY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isDraggingRef.current = false;

    // 縦スクロールと競合しないよう、水平移動量が垂直移動量より大きく40px以上の場合に切り替え
    if (Math.abs(diffX) > Math.abs(diffY) * 1.1 && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        // 左スワイプ（次へ進む）
        if (activeBoard === 'summary') setActiveBoard('detailed');
        else if (activeBoard === 'detailed') setActiveBoard('trend');
      } else {
        // 右スワイプ（前へ戻る）
        if (activeBoard === 'trend') setActiveBoard('detailed');
        else if (activeBoard === 'detailed') setActiveBoard('summary');
      }
    }
  };

  // マウスドラッグ対応
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    isDraggingRef.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || touchStartXRef.current === null || touchStartYRef.current === null) {
      isDraggingRef.current = false;
      return;
    }
    const diffX = e.clientX - touchStartXRef.current;
    const diffY = e.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isDraggingRef.current = false;

    if (Math.abs(diffX) > Math.abs(diffY) * 1.1 && Math.abs(diffX) > 50) {
      if (diffX < 0) {
        if (activeBoard === 'summary') setActiveBoard('detailed');
        else if (activeBoard === 'detailed') setActiveBoard('trend');
      } else {
        if (activeBoard === 'trend') setActiveBoard('detailed');
        else if (activeBoard === 'detailed') setActiveBoard('summary');
      }
    }
  };

  // トラックパッド二本指横スワイプ対応
  const lastWheelTimeRef = React.useRef<number>(0);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 横スクロールできるグラフ（面2）の上では、グラフのスクロールを優先してボードを切り替えない
      const scroller = e.target instanceof Element ? e.target.closest('.vplot-scroll') : null;
      if (scroller && scroller.scrollWidth > scroller.clientWidth) return;

      // 水平方向の二本指スワイプ判定（垂直成分より大きく一定量以上のdeltaX）
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2 && Math.abs(e.deltaX) > 20) {
        const now = Date.now();
        // 連続発火防止（クールダウン 650ms）
        if (now - lastWheelTimeRef.current < 650) {
          return;
        }

        if (e.deltaX > 20) {
          // 指を左へスワイプ ＝ 次のボードへ進む
          lastWheelTimeRef.current = now;
          setActiveBoard((prev) => {
            if (prev === 'summary') return 'detailed';
            if (prev === 'detailed') return 'trend';
            return prev;
          });
        } else if (e.deltaX < -20) {
          // 指を右へスワイプ ＝ 前のボードへ戻る
          lastWheelTimeRef.current = now;
          setActiveBoard((prev) => {
            if (prev === 'trend') return 'detailed';
            if (prev === 'detailed') return 'summary';
            return prev;
          });
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 表示面に応じて body クラスを付与し、空間演出を連動
  useEffect(() => {
    document.body.classList.remove('detailed-view-active', 'trend-view-active');
    if (activeBoard === 'detailed') {
      document.body.classList.add('detailed-view-active');
    } else if (activeBoard === 'trend') {
      document.body.classList.add('trend-view-active');
    }
    return () => {
      document.body.classList.remove('detailed-view-active', 'trend-view-active');
    };
  }, [activeBoard]);

  // すべての面でインデント・高さを完全一致させる共通スコアヘッダー
  const renderCommonScoreHeader = () => (
    <>
      {/* 1. ヒーロースコアエリア */}
      <div className="result-hero-simple">
        <span className="result-sub-label">あなたの物価意識スコア</span>

        <div className="percentile-simple-val">
          <span className="percentile-tag">上位</span>
          <span className="percentile-number" id="percentile-value">{result.topPercentile}</span>
          <span className="percentile-unit">%</span>
        </div>

        <div className="result-summary-tags">
          <span className="summary-pill score">総合スコア: {result.totalScore}点</span>
          <span
            className="summary-pill type"
            style={{ borderColor: result.senseType.badgeColor, color: result.senseType.badgeColor }}
          >
            {result.senseType.name}
          </span>
        </div>

        {/* 総合スコアの下の情緒激しく派手なコメントバナー */}
        <div className={`result-intense-comment ${intenseComment.levelClass}`} id="result-intense-comment">
          <div className="comment-punchline">{intenseComment.punchline}</div>
          <p className="comment-body">{intenseComment.message}</p>
        </div>
      </div>

      {/* 2. シェア ＆ リトライアクション列 */}
      <div className="result-top-actions" id="result-top-actions">
        <a
          href={xShareLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-action-top btn-x-share-top"
          id="btn-x-share"
        >
          <span>Xでポストする</span>
        </a>

        <button
          type="button"
          className="btn-action-top btn-copy-top"
          id="btn-copy-result"
          onClick={handleCopy}
        >
          <span>{copied ? 'コピー完了' : '結果をコピー'}</span>
        </button>

        <button
          type="button"
          className="btn-action-top btn-retry-top"
          id="btn-retry-top"
          onClick={onRetry}
        >
          <span>もう一度挑戦する</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={`whiteboard-stage is-${activeBoard}-active`} id="result-dashboard-view">
      {/* 【出題別の上までを独立したカードとして配置（横スライドせず画面固定）】 */}
      <div className="result-independent-score-card-wrap">
        <div className="glass-card animate-fade-in result-independent-score-card" id="independent-score-card">
          {renderCommonScoreHeader()}
        </div>
      </div>

      {/* スマホ用の面切り替えボタン（幅640px以下でだけ表示。画面の左下・右下に固定し、最前面に置く） */}
      {renderEdgeNav()}

      {/* ホワイトボードスライドラック（横スライドコンテナ・スワイプ/ドラッグ対応） */}
      <div
        className="whiteboard-track-viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div className={`whiteboard-sliding-rail is-${activeBoard}-active`}>
          
          {/* 【面1：診断サマリーボード】 */}
          <div className="whiteboard-panel panel-summary">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in" id="summary-main-card">
                <div className="questions-result-list" id="comparison-section">
                  <div className="result-section-header">
                    <span>出題別の回答分布・統計（全{result.questionResults.length}問）</span>
                  </div>

                  <div className="unified-board-cards-list">
                    {result.questionResults.map((item, index) => {
                      return (
                        <div key={item.questionId} className="unpis-question-card" id={`result-card-${item.questionId}`}>
                          {/* 統一ヘッダー */}
                          <div className="unified-card-header">
                            <div className="unified-header-left">
                              <span className="unified-q-badge">Q{index + 1}</span>
                              <span className="unified-cat-badge">{item.categoryLabel}</span>
                              <h3 className="unified-q-title">{item.title}</h3>
                            </div>
                            <div className="unified-header-right">
                              <span className="unified-meta-pill">
                                回答者数: <strong>{item.totalResponses.toLocaleString()}</strong>人
                              </span>
                            </div>
                          </div>

                          {/* 統一メトリクスグリッド（5カラム） */}
                          <div className="unified-metrics-grid grid-five">
                            <div className="unified-stat-cell you">
                              <span className="unified-stat-label">あなたの回答</span>
                              <span className="unified-stat-val">{formatAmount(item.userAnswer, item.unit, '未回答')}</span>
                            </div>

                            <div className="unified-stat-cell actual">
                              <span className="unified-stat-label">正解（公的相場）</span>
                              <span className="unified-stat-val">{item.actualPrice.toLocaleString()}{item.unit}</span>
                            </div>

                            <div className="unified-stat-cell avg">
                              <span className="unified-stat-label">全体平均</span>
                              <span className="unified-stat-val">{formatAmount(item.averageExpected, item.unit)}</span>
                            </div>

                            <div className="unified-stat-cell min">
                              <span className="unified-stat-label">最低値（MIN）</span>
                              <span className="unified-stat-val">{formatAmount(item.minAnswer, item.unit)}</span>
                            </div>

                            <div className="unified-stat-cell max">
                              <span className="unified-stat-label">最高値（MAX）</span>
                              <span className="unified-stat-val">{formatAmount(item.maxAnswer, item.unit)}</span>
                            </div>
                          </div>

                          <div className="unified-chart-container">
                            <DistributionBarChart distribution={item.distribution} />
                          </div>

                          {/* コラム（3面共通） */}
                          <PriceNoteColumn note={item.priceNote} />
                        </div>
                      );
                    })}
                  </div>

                  {/* 最下部アクション */}
                  <div className="result-bottom-actions">
                    <button
                      type="button"
                      className="btn-action-top btn-retry-top"
                      id="btn-retry-bottom"
                      onClick={onRetry}
                      style={{ width: '100%', maxWidth: '360px', height: '48px', fontSize: '1rem' }}
                    >
                      <span>もう一度挑戦する</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {renderGapNav(0)}
          </div>

          {/* 【面2：データ詳細ボード（1単位でプロットされた棒グラフ全問一覧）】 */}
          <div className="whiteboard-panel panel-detailed">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in" id="detailed-main-card">
                <div className="questions-result-list">
                  <div className="result-section-header">
                    <span>出題別の1単位プロット棒グラフ（全{result.questionResults.length}問）</span>
                  </div>

                  <div className="unified-board-cards-list">
                    {result.questionResults.map((qItem, idx) => (
                      <DetailedPlotChart
                        key={qItem.questionId}
                        item={qItem}
                        questionIndex={idx}
                      />
                    ))}
                  </div>

                  {/* 最下部アクション */}
                  <div className="result-bottom-actions">
                    <button
                      type="button"
                      className="btn-action-top btn-retry-top"
                      id="btn-retry-bottom-detail"
                      onClick={onRetry}
                      style={{ width: '100%', maxWidth: '360px', height: '48px', fontSize: '1rem' }}
                    >
                      <span>もう一度挑戦する</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {renderGapNav(1)}
          </div>

          {/* 【面3：物価推移ボード（過去から現在への価格変動全問一覧）】 */}
          <div className="whiteboard-panel panel-trend">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in" id="trend-main-card">
                <div className="questions-result-list">
                  <div className="result-section-header">
                    <span>出題別の物価推移・価格変動（全{result.questionResults.length}問）</span>
                  </div>

                  <div className="unified-board-cards-list">
                    {result.questionResults.map((qItem, idx) => (
                      <PriceTrendChart
                        key={qItem.questionId}
                        item={qItem}
                        questionIndex={idx}
                      />
                    ))}
                  </div>

                  {/* 最下部アクション */}
                  <div className="result-bottom-actions">
                    <button
                      type="button"
                      className="btn-action-top btn-retry-top"
                      id="btn-retry-bottom-trend"
                      onClick={onRetry}
                      style={{ width: '100%', maxWidth: '360px', height: '48px', fontSize: '1rem' }}
                    >
                      <span>もう一度挑戦する</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

