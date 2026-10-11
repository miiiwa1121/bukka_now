// src/components/ResultDashboard.tsx: 診断結果ダッシュボード（ホワイトボード横スライド機能・1単位プロット棒グラフ詳細搭載）

import React, { useState, useEffect } from 'react';
import type { QuizSubmissionResult } from '../types/quiz';
import { DetailedPlotChart } from './DetailedPlotChart';
import { PriceTrendChart } from './PriceTrendChart';
import { DistributionBarChart } from './DistributionBarChart';

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

export const ResultDashboard: React.FC<ResultDashboardProps> = ({ result, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [activeBoard, setActiveBoard] = useState<'summary' | 'detailed' | 'trend'>('summary');
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

  // スクロール位置はそのまま維持して横スライド移動
  const handleGoToDetail = () => setActiveBoard('detailed');
  const handleGoToTrend = () => setActiveBoard('trend');
  const handleBackToSummary = () => setActiveBoard('summary');
  const handleBackToDetail = () => setActiveBoard('detailed');

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
      {/* ナビボタン1：サマリー ⇄ 詳細 切替ボタン（カードと完全同期移動） */}
      <button
        type="button"
        className={`whiteboard-fixed-nav-btn nav-btn-summary-detail pos-${activeBoard} ${activeBoard === 'summary' ? 'dir-right' : 'dir-left'}`}
        onClick={activeBoard === 'summary' ? handleGoToDetail : handleBackToSummary}
        aria-label={activeBoard === 'summary' ? 'データ詳細へ進む' : '診断サマリーに戻る'}
        title={activeBoard === 'summary' ? 'データ詳細へ進む' : '診断サマリーに戻る'}
        id="btn-nav-summary-detail"
      >
        <div className="fixed-nav-icon-wrapper">
          {activeBoard === 'summary' ? (
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          )}
        </div>
        <span className="fixed-nav-label">
          {activeBoard === 'summary' ? '詳細データ' : 'サマリー'}
        </span>
      </button>

      {/* ナビボタン2：詳細 ⇄ 物価推移 切替ボタン（カードと完全同期移動） */}
      <button
        type="button"
        className={`whiteboard-fixed-nav-btn nav-btn-detail-trend pos-${activeBoard} ${activeBoard === 'trend' ? 'dir-left' : 'dir-right'}`}
        onClick={activeBoard === 'trend' ? handleBackToDetail : handleGoToTrend}
        aria-label={activeBoard === 'trend' ? '詳細データに戻る' : '物価推移へ進む'}
        title={activeBoard === 'trend' ? '詳細データに戻る' : '物価推移へ進む'}
        id="btn-nav-detail-trend"
      >
        <div className="fixed-nav-icon-wrapper">
          {activeBoard === 'trend' ? (
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          )}
        </div>
        <span className="fixed-nav-label">
          {activeBoard === 'trend' ? '詳細データ' : '物価推移'}
        </span>
      </button>

      {/* ホワイトボードスライドラック（横スライドコンテナ） */}
      <div className="whiteboard-track-viewport">
        <div className={`whiteboard-sliding-rail is-${activeBoard}-active`}>
          
          {/* 【面1：診断サマリーボード】 */}
          <div className="whiteboard-panel panel-summary">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in" id="summary-main-card">
                {renderCommonScoreHeader()}

                {/* 3. 各問の回答分布・統計データリスト */}
                <div className="questions-result-list" id="comparison-section">
                  <div className="result-section-header">
                    <span>出題別の回答分布・統計（全{result.questionResults.length}問）</span>
                  </div>

                  {result.questionResults.map((item, index) => {
                    return (
                      <div key={item.questionId} className="result-question-card" id={`result-card-${item.questionId}`}>
                        <div className="card-header-clean">
                          <div className="card-title-group">
                            <span className="card-q-index">Q{index + 1}</span>
                            <h3 className="card-q-title">{item.title}</h3>
                          </div>
                          <span className="card-respondents-pill">
                            回答者数: <strong>{item.totalResponses.toLocaleString()}</strong>人
                          </span>
                        </div>

                        <div className="stats-five-grid">
                          <div className="stat-cell you">
                            <span className="stat-cell-label">あなたの回答</span>
                            <span className="stat-cell-value">{item.userAnswer.toLocaleString()}{item.unit}</span>
                          </div>

                          <div className="stat-cell actual">
                            <span className="stat-cell-label">正解（公的相場）</span>
                            <span className="stat-cell-value">{item.actualPrice.toLocaleString()}{item.unit}</span>
                          </div>

                          <div className="stat-cell avg">
                            <span className="stat-cell-label">全体平均</span>
                            <span className="stat-cell-value">{item.averageExpected.toLocaleString()}{item.unit}</span>
                          </div>

                          <div className="stat-cell min">
                            <span className="stat-cell-label">最低値（MIN）</span>
                            <span className="stat-cell-value">{item.minAnswer.toLocaleString()}{item.unit}</span>
                          </div>

                          <div className="stat-cell max">
                            <span className="stat-cell-label">最高値（MAX）</span>
                            <span className="stat-cell-value">{item.maxAnswer.toLocaleString()}{item.unit}</span>
                          </div>
                        </div>

                        <DistributionBarChart
                          distribution={item.distribution}
                          userAnswer={item.userAnswer}
                          actualPrice={item.actualPrice}
                          minAnswer={item.minAnswer}
                          maxAnswer={item.maxAnswer}
                          unit={item.unit}
                        />

                        <p className="card-clean-note">{item.priceNote}</p>
                      </div>
                    );
                  })}
                </div>

                {/* 4. 最下部アクション */}
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

          {/* 【面2：データ詳細ボード（1単位でプロットされた棒グラフ全問一覧）】 */}
          <div className="whiteboard-panel panel-detailed">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in detailed-board-card">
                {renderCommonScoreHeader()}

                <div className="questions-result-list">
                  <div className="result-section-header">
                    <span>出題別の1単位プロット棒グラフ（全{result.questionResults.length}問）</span>
                  </div>

                  <div className="detailed-all-questions-list">
                    {result.questionResults.map((qItem, idx) => (
                      <DetailedPlotChart
                        key={qItem.questionId}
                        item={qItem}
                        questionIndex={idx}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 【面3：物価推移ボード（過去から現在への価格変動全問一覧）】 */}
          <div className="whiteboard-panel panel-trend">
            <div className="whiteboard-card-wrapper">
              <div className="glass-card animate-fade-in trend-board-card">
                {renderCommonScoreHeader()}

                <div className="questions-result-list">
                  <div className="result-section-header">
                    <span>出題別の物価推移・価格変動（全{result.questionResults.length}問）</span>
                  </div>

                  <div className="trend-all-questions-list">
                    {result.questionResults.map((qItem, idx) => (
                      <PriceTrendChart
                        key={qItem.questionId}
                        item={qItem}
                        questionIndex={idx}
                      />
                    ))}
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

