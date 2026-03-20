// ui.js - DOM操作・牌レンダリング・雀卓UI

const UI = (() => {

  const SUIT_PREFIX = { man: 'm', pin: 'p', sou: 's' };
  const PLAYER_NAMES = {
    self: '自分',
    shimocha: '下家',
    toimen: '対面',
    kamicha: '上家'
  };
  const WIND_LABELS = {
    self: '自',
    shimocha: '下',
    toimen: '対',
    kamicha: '上'
  };

  // 河の最大表示枚数（6枚×3段）
  const RIVER_COLS = 6;

  // ========== 牌画像 ==========

  function tileImgSrc(tileIndex, suit) {
    const num = tileIndex + 1;
    return 'img/tiles/' + SUIT_PREFIX[suit] + num + '.png';
  }

  function createTileImg(tileIndex, suit, className) {
    const img = document.createElement('img');
    img.src = tileImgSrc(tileIndex, suit);
    img.alt = (tileIndex + 1) + suit;
    img.draggable = false;
    if (className) img.className = className;
    return img;
  }

  function createTileDiv(tileIndex, suit, extraClass) {
    const div = document.createElement('div');
    div.className = 'tile' + (extraClass ? ' ' + extraClass : '');
    div.appendChild(createTileImg(tileIndex, suit, 'tile-img'));
    return div;
  }

  function createMiniTileDiv(tileIndex, suit, extraClass) {
    const div = document.createElement('div');
    div.className = 'tile tile-mini' + (extraClass ? ' ' + extraClass : '');
    div.appendChild(createTileImg(tileIndex, suit, 'tile-img'));
    return div;
  }

  // 裏向き牌
  function createBackTile(extraClass) {
    const div = document.createElement('div');
    div.className = 'tile tile-back' + (extraClass ? ' ' + extraClass : '');
    return div;
  }

  // ========== 雀卓初期化 ==========

  function initTable(scenario) {
    // 手牌表示
    renderHand(scenario);
    // 河をクリア
    clearAllRivers();
    // ドラ表示
    renderDoraIndicator(scenario);
    // 情報バー
    updateInfoBar(scenario);
    // フリテン表示リセット
    updateFuritenIndicator(false);
    // 見逃し可能表示リセット
    updateMinogashiIndicator(false);
    // アクティブプレイヤーリセット
    clearActivePlayer();
    // ツモ牌エリアクリア
    clearTsumoArea();
  }

  // ========== 手牌 ==========

  function renderHand(scenario) {
    const container = document.getElementById('hand-tiles');
    container.innerHTML = '';

    const expanded = Tile.expand(scenario.tiles);
    for (const tileIdx of expanded) {
      const el = createTileDiv(tileIdx, scenario.suit, 'hand-tile');
      container.appendChild(el);
    }
  }

  // ========== ツモ牌 ==========

  function showTsumoTile(tileIndex, suit) {
    const area = document.getElementById('tsumo-area');
    area.innerHTML = '';
    const el = createTileDiv(tileIndex, suit, 'tsumo-tile');
    area.appendChild(el);
  }

  function clearTsumoArea() {
    document.getElementById('tsumo-area').innerHTML = '';
  }

  // ========== 河（捨て牌エリア） ==========

  function clearAllRivers() {
    ['self', 'shimocha', 'toimen', 'kamicha'].forEach(p => {
      document.getElementById('river-' + p).innerHTML = '';
    });
  }

  function addToRiver(player, tileIndex, suit, highlight) {
    const container = document.getElementById('river-' + player);
    const el = createTileDiv(tileIndex, suit, 'river-tile');
    if (highlight) {
      el.classList.add('river-tile-new');
      // ハイライトを一定時間後に除去
      setTimeout(() => el.classList.remove('river-tile-new'), 800);
    }
    container.appendChild(el);
  }

  // ========== ドラ表示牌 ==========

  function renderDoraIndicator(scenario) {
    const container = document.getElementById('dora-display');
    container.innerHTML = '';

    // ドラ label
    const label = document.createElement('span');
    label.className = 'dora-label';
    label.textContent = 'ドラ';
    container.appendChild(label);

    // 裏牌 + ドラ表示牌 + 裏牌
    for (let i = 0; i < 2; i++) {
      container.appendChild(createBackTile('dora-back'));
    }
    const doraEl = createTileDiv(scenario.doraIndicator, scenario.suit, 'dora-tile');
    container.appendChild(doraEl);
    for (let i = 0; i < 2; i++) {
      container.appendChild(createBackTile('dora-back'));
    }
  }

  // ========== 局表示 ==========

  function updateRoundLabel(scenario) {
    const el = document.getElementById('round-label');
    if (el && scenario.roundWind && scenario.roundNumber) {
      const honba = scenario.honba != null ? scenario.honba : 0;
      el.textContent = scenario.roundWind + scenario.roundNumber + '局 ' + honba + '本場';
    }
  }

  // ========== 情報バー ==========

  function updateInfoBar(scenario) {
    // 局ラベル更新のみ
    updateRoundLabel(scenario);
  }

  // ========== アクティブプレイヤー表示 ==========

  function setActivePlayer(player) {
    clearActivePlayer();
    const el = document.getElementById('seat-' + player);
    if (el) el.classList.add('active-seat');
  }

  function clearActivePlayer() {
    document.querySelectorAll('.seat-marker').forEach(el =>
      el.classList.remove('active-seat')
    );
  }

  // ========== フリテン表示 ==========

  function updateFuritenIndicator(isFuriten) {
    // フリテン状態はプレイヤーには表示しない（トレーニングの一部）
  }

  // ========== 見逃し可能表示 ==========

  function updateMinogashiIndicator(appeared) {
    // 見逃しボタンの表示を更新（アガリ牌が出たらヒント）
    const btn = document.getElementById('btn-minogashi');
    if (btn) {
      if (appeared) {
        btn.classList.add('minogashi-hint');
      } else {
        btn.classList.remove('minogashi-hint');
      }
    }
  }

  // ========== アクションボタン ==========

  function setButtonsEnabled(enabled) {
    const btns = document.querySelectorAll('.action-btn');
    btns.forEach(btn => {
      btn.disabled = !enabled;
      if (enabled) {
        btn.classList.add('btn-active');
      } else {
        btn.classList.remove('btn-active');
      }
    });
  }

  function highlightButton(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('btn-highlight');
      setTimeout(() => btn.classList.remove('btn-highlight'), 500);
    }
  }

  // ========== スコア・タイマー ==========

  function updateScore(score) {
    const el = document.getElementById('score-display');
    el.textContent = score.toLocaleString();
    // スコア変化アニメーション
    el.classList.add('score-change');
    setTimeout(() => el.classList.remove('score-change'), 400);
  }

  function updateTimer(seconds) {
    const el = document.getElementById('timer-display');
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    el.textContent = min + ':' + String(sec).padStart(2, '0');

    // 残り10秒以下で警告
    if (seconds <= 10) {
      el.classList.add('timer-warning');
    } else {
      el.classList.remove('timer-warning');
    }
  }

  function updateRoundCount(count) {
    document.getElementById('round-display').textContent = 'R' + count;
  }

  // ========== ラウンド結果ポップアップ ==========

  function showRoundResult(result) {
    const overlay = document.getElementById('result-overlay');
    const messageEl = document.getElementById('result-message');
    const pointsEl = document.getElementById('result-points');
    const waitsLabelEl = document.getElementById('result-waits-label');
    const waitsEl = document.getElementById('result-waits');

    messageEl.textContent = result.message;
    messageEl.className = 'result-message ' + (result.isCorrect ? 'result-correct' : 'result-wrong');

    if (result.points !== 0) {
      const prefix = result.points > 0 ? '+' : '';
      pointsEl.textContent = prefix + result.points.toLocaleString() + '点';
      pointsEl.className = 'result-points ' + (result.points > 0 ? 'points-plus' : 'points-minus');
    } else {
      pointsEl.textContent = '';
    }

    // 待ち牌を画像で表示
    const s = result.scenario;
    waitsEl.innerHTML = '';
    s.waitTileIndices.forEach(tileIdx => {
      const div = createTileDiv(tileIdx, s.suit, 'result-wait-tile');
      waitsEl.appendChild(div);
    });

    // ラベル
    let labelText = '待ち牌';
    if (result.isFuriten) labelText += '（フリテン）';
    if (result.winTileAppeared) labelText += '（見逃しあり）';
    waitsLabelEl.textContent = labelText;

    overlay.classList.add('show');

    setTimeout(() => {
      overlay.classList.remove('show');
    }, 1400);
  }

  // ========== ゲームオーバー解答表示 ==========

  function renderDecompositionRow(decomp, winTile, suit) {
    const row = document.createElement('div');
    row.className = 'decomp-row';

    if (decomp.isChitoitsu) {
      const label = document.createElement('span');
      label.className = 'decomp-chi-label';
      label.textContent = '七対子';
      row.appendChild(label);
      for (const p of decomp.pairs) {
        const grp = document.createElement('div');
        grp.className = 'decomp-group';
        for (let k = 0; k < 2; k++) {
          const el = createMiniTileDiv(p, suit);
          if (p === winTile) el.classList.add('decomp-win');
          grp.appendChild(el);
        }
        row.appendChild(grp);
      }
      return row;
    }

    // 雀頭グループ
    const headGroup = document.createElement('div');
    headGroup.className = 'decomp-group';
    for (let k = 0; k < 2; k++) {
      const el = createMiniTileDiv(decomp.head, suit);
      if (decomp.head === winTile && k === 1) el.classList.add('decomp-win');
      headGroup.appendChild(el);
    }
    row.appendChild(headGroup);

    // 面子グループ
    for (const m of decomp.mentsu) {
      const grp = document.createElement('div');
      grp.className = 'decomp-group';
      const tset = m.type === 'koutsu'
        ? [m.tile, m.tile, m.tile]
        : [m.tile, m.tile + 1, m.tile + 2];
      let winHL = false;
      for (const t of tset) {
        const el = createMiniTileDiv(t, suit);
        if (!winHL && t === winTile) { el.classList.add('decomp-win'); winHL = true; }
        grp.appendChild(el);
      }
      row.appendChild(grp);
    }
    return row;
  }

  function renderReviewCard(sc, onDelete) {
    const card = document.createElement('div');
    card.className = 'review-card';

    // ヘッダー（局・本場）
    const header = document.createElement('div');
    header.className = 'review-card-header';

    const headerLabel = document.createElement('span');
    headerLabel.textContent = sc.roundWind + sc.roundNumber + '局 ' + sc.honba + '本場';
    header.appendChild(headerLabel);

    if (onDelete) {
      const delBtn = document.createElement('button');
      delBtn.className = 'review-card-delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', () => onDelete());
      header.appendChild(delBtn);
    }
    card.appendChild(header);

    // 手牌（13枚）
    const handRow = document.createElement('div');
    handRow.className = 'review-hand';
    for (const tIdx of Tile.expand(sc.tiles)) {
      handRow.appendChild(createMiniTileDiv(tIdx, sc.suit));
    }
    card.appendChild(handRow);

    // 待ち牌ラベル
    const waitsLabel = document.createElement('div');
    waitsLabel.className = 'review-waits-label';
    waitsLabel.textContent = 'あがり牌';
    card.appendChild(waitsLabel);

    // 待ち牌ごとに面子分解を表示
    const waitsContainer = document.createElement('div');
    waitsContainer.className = 'review-waits-container';
    for (const w of sc.waits) {
      const entry = document.createElement('div');
      entry.className = 'review-wait-entry';

      // 先頭の分解1つのみ表示
      const decomps = Hand.uniqueDecompositions(w.decompositions || []);
      if (decomps.length > 0) {
        const row = document.createElement('div');
        row.className = 'review-decomp-row';
        row.appendChild(createMiniTileDiv(w.tile, sc.suit, 'review-wait-chip'));
        row.appendChild(renderDecompositionRow(decomps[0], w.tile, sc.suit));
        entry.appendChild(row);
      }
      waitsContainer.appendChild(entry);
    }
    card.appendChild(waitsContainer);
    return card;
  }

  // ========== ゲームオーバー画面 ==========

  function showGameOver(stats, modeKey) {
    document.getElementById('game-screen').classList.add('hidden');
    const screen = document.getElementById('gameover-screen');
    screen.classList.remove('hidden');

    document.getElementById('final-score').textContent = stats.score.toLocaleString() + '点';
    document.getElementById('final-rounds').textContent = stats.roundCount + '局';
    document.getElementById('final-correct').textContent = stats.correctCount;
    document.getElementById('final-wrong').textContent = stats.wrongCount;
    document.getElementById('final-miss').textContent = stats.missCount;

    const total = stats.correctCount + stats.wrongCount + stats.missCount;
    const rate = total > 0 ? Math.round((stats.correctCount / total) * 100) : 0;
    document.getElementById('final-rate').textContent = rate + '%';

    // ランキング比較表示
    const rankRow = document.getElementById('rank-row');
    const bestRow = document.getElementById('best-row');
    const rankEl = document.getElementById('final-rank');
    const bestEl = document.getElementById('final-best');
    if (modeKey && stats.score > 0) {
      const allData = JSON.parse(localStorage.getItem('chinitsu-ranking') || '{}');
      const entries = allData[modeKey] || [];
      if (entries.length > 0) {
        const rank = entries.filter(e => e.score > stats.score).length + 1;
        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        const rankLabel = (medals[rank - 1] || '') + rank + '位';
        rankEl.textContent = rankLabel + ' / ' + entries.length + '件中';
        rankEl.style.color = rank === 1 ? '#ffd700' : rank <= 3 ? '#b0b0b8' : '#e0e0e0';
        bestEl.textContent = entries[0].score.toLocaleString() + '点';
        rankRow.style.display = '';
        bestRow.style.display = stats.score < entries[0].score ? '' : 'none';
      } else {
        rankRow.style.display = 'none';
        bestRow.style.display = 'none';
      }
    } else {
      rankRow.style.display = 'none';
      bestRow.style.display = 'none';
    }

    // 解答確認セクション
    const reviewSection = document.getElementById('review-section');
    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = '';
    const wrongs = stats.wrongRounds || [];
    if (wrongs.length > 0) {
      reviewSection.classList.remove('hidden');
      for (const sc of wrongs.slice(-10)) {
        reviewList.appendChild(renderReviewCard(sc));
      }
    } else {
      reviewSection.classList.add('hidden');
    }
  }

  // ========== 振り返り画面 ==========

  function showReviewScreen(rounds, page) {
    showScreen('review-screen');
    const list = document.getElementById('review-screen-list');
    const countEl = document.getElementById('review-screen-count');

    // 上下共通のページネーション更新関数
    function updatePagination(paginationId, prevId, nextId, infoId, cur, total, roundsRef) {
      const pagination = document.getElementById(paginationId);
      if (total <= 1) { pagination.style.display = 'none'; return; }
      pagination.style.display = 'flex';
      document.getElementById(infoId).textContent = cur + ' / ' + total;
      const prev = document.getElementById(prevId);
      const next = document.getElementById(nextId);
      prev.disabled = cur <= 1;
      next.disabled = cur >= total;
      prev.onclick = () => showReviewScreen(roundsRef, cur - 1);
      next.onclick = () => showReviewScreen(roundsRef, cur + 1);
    }

    list.innerHTML = '';
    if (rounds.length === 0) {
      countEl.textContent = '';
      document.getElementById('review-pagination-top').style.display = 'none';
      document.getElementById('review-pagination').style.display = 'none';
      const empty = document.createElement('div');
      empty.className = 'review-empty';
      empty.textContent = 'まだ記録がありません';
      list.appendChild(empty);
      return;
    }

    const PER_PAGE = 5;
    const reversed = [...rounds].reverse();
    const totalPages = Math.ceil(reversed.length / PER_PAGE);
    const currentPage = Math.max(1, Math.min(page || 1, totalPages));

    countEl.textContent = reversed.length + '件';
    const start = (currentPage - 1) * PER_PAGE;
    for (let i = 0; i < reversed.slice(start, start + PER_PAGE).length; i++) {
      // reversedの元インデックス = reversed.lengthに対応する元roundsのインデックス
      const reversedIdx = start + i;
      const originalIdx = rounds.length - 1 - reversedIdx;
      const sc = reversed[reversedIdx];
      const onDelete = () => {
        const stored = JSON.parse(localStorage.getItem('chinitsu-review') || '[]');
        stored.splice(originalIdx, 1);
        localStorage.setItem('chinitsu-review', JSON.stringify(stored));
        const newPage = stored.length === 0 ? 1
          : Math.min(currentPage, Math.ceil(stored.length / PER_PAGE));
        showReviewScreen(stored, newPage);
      };
      list.appendChild(renderReviewCard(sc, onDelete));
    }

    updatePagination('review-pagination-top', 'review-prev-btn-top', 'review-next-btn-top', 'review-page-info-top', currentPage, totalPages, rounds);
    updatePagination('review-pagination', 'review-prev-btn', 'review-next-btn', 'review-page-info', currentPage, totalPages, rounds);
  }

  // ========== 画面切り替え ==========

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
  }

  // ========== タイマーバー ==========

  function showActionTimerBar(durationMs) {
    const bar = document.getElementById('action-timer-bar');
    bar.style.transition = 'none';
    bar.style.width = '100%';
    // 次フレームでアニメーション開始
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = 'width ' + durationMs + 'ms linear';
        bar.style.width = '0%';
      });
    });
  }

  function resetActionTimerBar() {
    const bar = document.getElementById('action-timer-bar');
    bar.style.transition = 'none';
    bar.style.width = '0%';
  }

  // ========== ランキング画面 ==========

  // ランキング画面で現在選択中のモードキーを返す
  function getCurrentRankingModeKey() {
    const d = document.querySelector('#ranking-diff-options .option-btn.selected')?.dataset.value || 'medium';
    const t = document.querySelector('#ranking-time-options .option-btn.selected')?.dataset.value || 'medium';
    const sp = document.querySelector('#ranking-speed-options .option-btn.selected')?.dataset.value || 'normal';
    return `${d}_${t}_${sp}`;
  }

  function renderRankingList(modeKey) {
    const listEl = document.getElementById('ranking-list');
    const allData = JSON.parse(localStorage.getItem('chinitsu-ranking') || '{}');
    const entries = (allData[modeKey] || []).slice(0, 10);
    listEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ranking-empty';
      empty.textContent = 'まだ記録がありません';
      listEl.appendChild(empty);
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    entries.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'ranking-row' + (i < 3 ? ` ranking-top${i + 1}` : '');

      const rankEl = document.createElement('span');
      rankEl.className = 'ranking-rank';
      rankEl.textContent = medals[i] || `#${i + 1}`;

      const scoreEl = document.createElement('span');
      scoreEl.className = 'ranking-score';
      scoreEl.textContent = entry.score.toLocaleString() + '点';

      const statsEl = document.createElement('span');
      statsEl.className = 'ranking-stats';
      statsEl.textContent = `${entry.rounds}局 ○${entry.correct} ✗${entry.wrong} △${entry.miss}`;

      const dateEl = document.createElement('span');
      dateEl.className = 'ranking-date';
      dateEl.textContent = entry.date;

      row.appendChild(rankEl);
      row.appendChild(scoreEl);
      row.appendChild(statsEl);
      row.appendChild(dateEl);
      listEl.appendChild(row);
    });
  }

  function showRankingScreen(modeKey) {
    showScreen('ranking-screen');
    const parts = (modeKey || 'medium_medium_normal').split('_');
    const [diff, time, speed] = parts;

    // セレクタを初期化
    [
      ['ranking-diff-options', diff],
      ['ranking-time-options', time],
      ['ranking-speed-options', speed]
    ].forEach(([groupId, val]) => {
      const group = document.getElementById(groupId);
      group.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === val);
        btn.onclick = () => {
          group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          renderRankingList(getCurrentRankingModeKey());
        };
      });
    });

    renderRankingList(modeKey);
  }

  function clearCurrentRankingMode() {
    const modeKey = getCurrentRankingModeKey();
    const labelMap = { easy: '易', medium: '普', hard: '難' };
    const timeMap = { short: '30秒', medium: '60秒', long: '90秒' };
    const speedMap = { fast: '2秒', normal: '3秒', slow: '5秒' };
    const [d, t, sp] = modeKey.split('_');
    const label = `${labelMap[d] || d} / ${timeMap[t] || t} / ${speedMap[sp] || sp}`;
    if (confirm(`「${label}」のランキングをクリアしますか？`)) {
      const allData = JSON.parse(localStorage.getItem('chinitsu-ranking') || '{}');
      delete allData[modeKey];
      localStorage.setItem('chinitsu-ranking', JSON.stringify(allData));
      renderRankingList(modeKey);
    }
  }

  // ========== 苦手分析画面 ==========

  function showAnalysisScreen() {
    showScreen('analysis-screen');
    const content = document.getElementById('analysis-content');
    const LOG_KEY = 'chinitsu-game-log';
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');

    if (log.length < 10) {
      content.innerHTML = '<div class="analysis-empty">まだデータが不足しています<br><small>10局以上プレイすると苦手パターンを分析します</small></div>';
      return;
    }

    const MIN_SAMPLES = 3;
    const overallCorrect = log.filter(e => e.isCorrect).length;
    const overallRate = overallCorrect / log.length;

    function calcStats(entries) {
      if (entries.length < MIN_SAMPLES) return null;
      const correct = entries.filter(e => e.isCorrect).length;
      const rate = correct / entries.length;
      return { count: entries.length, rate, rateGap: overallRate - rate };
    }

    // === 待ち数別 ===
    const waitCountChart = [];
    for (let wc = 1; wc <= 5; wc++) {
      const entries = log.filter(e => wc < 5 ? e.waitCount === wc : e.waitCount >= 5);
      const label = wc < 5 ? `${wc}種` : '5種+';
      const s = calcStats(entries);
      waitCountChart.push({ label, count: entries.length, rate: s ? s.rate : null });
    }

    // === 壁検出 ===
    let wall = null;
    for (let i = 0; i < waitCountChart.length - 1; i++) {
      const cur = waitCountChart[i];
      const nxt = waitCountChart[i + 1];
      if (cur.rate != null && nxt.rate != null && cur.count >= MIN_SAMPLES && nxt.count >= MIN_SAMPLES) {
        const drop = cur.rate - nxt.rate;
        if (drop >= 0.10 && (!wall || drop > wall.drop)) {
          wall = { fromLabel: cur.label, toLabel: nxt.label,
            fromRate: Math.round(cur.rate * 100), toRate: Math.round(nxt.rate * 100), drop };
        }
      }
    }

    // === 待ち形タイプ別 ===
    const WT_LABELS = { ryanmen: '両面', kanchan: '嵌張', penchan: '辺張', shanpon: '双碰', tanki: '単騎' };
    const waitTypeStats = {};
    for (const wt of ['ryanmen', 'kanchan', 'penchan', 'shanpon', 'tanki']) {
      const s = calcStats(log.filter(e => e.waitTypes && e.waitTypes.includes(wt)));
      if (s) waitTypeStats[wt] = { ...s, label: WT_LABELS[wt] };
    }

    // === スポット分析 ===
    const termSt  = calcStats(log.filter(e => e.hasTerminal === true));
    const noTermSt = calcStats(log.filter(e => e.hasTerminal === false));
    const entSt   = calcStats(log.filter(e => e.hasEntotsu === true));
    const noEntSt = calcStats(log.filter(e => e.hasEntotsu === false));

    // === チョンボ種別 ===
    const CHONBO_LABELS = {
      wrong_ron: '誤ロン', wrong_ron_on_tsumo: 'ツモ番に誤ロン',
      wrong_furiten_ron: 'フリテンロン', wrong_tsumo: '誤ツモ',
      wrong_tsumo_on_other: '他家番に誤ツモ', wrong_minogashi: '誤見逃し宣言',
      wrong_skip_win: 'アガリ牌スキップ'
    };
    const chonboBreakdown = Object.entries(CHONBO_LABELS)
      .map(([key, label]) => ({ label, count: log.filter(e => e.resultType === key).length }))
      .filter(e => e.count > 0).sort((a, b) => b.count - a.count);
    const totalWrong = log.length - overallCorrect - log.filter(e => e.resultType === 'miss').length;
    const totalMiss  = log.filter(e => e.resultType === 'miss').length;

    // === 難易度別 ===
    const DIFF_LABELS = { easy: '易（1-2種）', medium: '普（3-4種）', hard: '難（5種以上）' };
    const diffRows = ['easy', 'medium', 'hard']
      .map(d => ({ label: DIFF_LABELS[d], s: calcStats(log.filter(e => e.difficulty === d)) }))
      .filter(r => r.s);

    // === 苦手パターン検出 ===
    const weaknesses = [];
    const WT_ADVICE = {
      kanchan: '数字の飛び（嵌張）に注意を払いましょう',
      penchan: '端の筋（辺張）を見落とさないようにしましょう',
      tanki: '単騎待ちの可能性を忘れずに確認しましょう',
      shanpon: '双碰待ちのパターンを意識しましょう',
      ryanmen: '両面待ちの形を整理して覚えましょう'
    };

    if (wall && wall.drop >= 0.15) {
      weaknesses.push({ icon: '🧱', title: '多面張の壁',
        message: `${wall.fromLabel}→${wall.toLabel}で正解率が急落`,
        detail: `${wall.fromLabel}: ${wall.fromRate}% → ${wall.toLabel}: ${wall.toRate}% (-${Math.round(wall.drop * 100)}%)`,
        advice: `${wall.toLabel}以上の待ちを重点的に練習しましょう` });
    }

    const wtWeakest = Object.entries(waitTypeStats)
      .filter(([, s]) => s.rateGap > 0.08).sort((a, b) => b[1].rateGap - a[1].rateGap);
    if (wtWeakest.length > 0 && weaknesses.length < 3) {
      const [wt, s] = wtWeakest[0];
      weaknesses.push({ icon: '🔍', title: `${s.label}の見落とし`,
        message: `${s.label}を含む局の正解率が${Math.round(s.rateGap * 100)}%低い`,
        detail: `正解率: ${Math.round(s.rate * 100)}% (全体: ${Math.round(overallRate * 100)}%) / ${s.count}局`,
        advice: WT_ADVICE[wt] || '' });
    }

    if (termSt && noTermSt) {
      const gap = noTermSt.rate - termSt.rate;
      if (gap >= 0.08 && weaknesses.length < 3) {
        weaknesses.push({ icon: '🎯', title: '端牌の盲点',
          message: `1・9が待ちに含む局の正解率が${Math.round(gap * 100)}%低い`,
          detail: `端牌あり: ${Math.round(termSt.rate * 100)}% / 端牌なし: ${Math.round(noTermSt.rate * 100)}%`,
          advice: '端牌（1・9）の待ちを見落としやすい傾向があります' });
      }
    }

    if (entSt && noEntSt) {
      const gap = noEntSt.rate - entSt.rate;
      if (gap >= 0.08 && weaknesses.length < 3) {
        weaknesses.push({ icon: '🏭', title: '煙突形の苦手',
          message: `煙突形(3334型)を含む局の正解率が${Math.round(gap * 100)}%低い`,
          detail: `煙突形あり: ${Math.round(entSt.rate * 100)}% / なし: ${Math.round(noEntSt.rate * 100)}%`,
          advice: '3334型や6777型の複雑な形に注意しましょう' });
      }
    }

    // === HTMLレンダリング ===
    let html = '';

    // 概要
    html += '<div class="an-overview">';
    html += `<div class="an-stat">回答数: <strong>${log.length}局</strong></div>`;
    html += `<div class="an-stat">正解率: <strong>${Math.round(overallRate * 100)}%</strong></div>`;
    html += `<div class="an-stat">チョンボ: <strong style="color:#ff4444">${totalWrong}回</strong></div>`;
    html += `<div class="an-stat">見逃し: <strong style="color:#ffd700">${totalMiss}回</strong></div>`;
    html += '</div>';

    // 待ち数別 棒グラフ
    if (waitCountChart.some(d => d.count > 0)) {
      html += '<div class="an-section"><h4>待ち数別 正解率</h4><div class="an-bar-chart">';
      for (const d of waitCountChart) {
        if (d.count === 0) continue;
        const pct = d.rate != null ? Math.round(d.rate * 100) : 0;
        const isWall = wall && d.label === wall.toLabel;
        html += `<div class="an-row${isWall ? ' an-row-warn' : ''}">`;
        html += `<span class="an-label">${d.label}</span>`;
        html += `<span class="an-track"><span class="an-fill${isWall ? ' an-fill-warn' : ''}" style="width:${pct}%"></span></span>`;
        html += `<span class="an-value">${pct}%</span><span class="an-count">(${d.count}局)</span>`;
        html += '</div>';
      }
      if (wall) html += `<p class="an-wall-note">🧱 ${wall.fromLabel}→${wall.toLabel}で急落 (${wall.fromRate}%→${wall.toRate}%)</p>`;
      html += '</div></div>';
    }

    // 待ち形タイプ別 棒グラフ
    if (Object.keys(waitTypeStats).length > 0) {
      html += '<div class="an-section"><h4>待ち形タイプ別 正解率</h4><div class="an-bar-chart">';
      for (const wt of ['ryanmen', 'kanchan', 'penchan', 'shanpon', 'tanki']) {
        const s = waitTypeStats[wt];
        if (!s) continue;
        const pct = Math.round(s.rate * 100);
        const isWeak = s.rateGap > 0.08;
        html += `<div class="an-row${isWeak ? ' an-row-warn' : ''}">`;
        html += `<span class="an-label">${s.label}</span>`;
        html += `<span class="an-track"><span class="an-fill${isWeak ? ' an-fill-warn' : ''}" style="width:${pct}%"></span></span>`;
        html += `<span class="an-value">${pct}%</span><span class="an-count">(${s.count}局)</span>`;
        html += '</div>';
      }
      html += '</div></div>';
    }

    // スポット分析テーブル
    if (termSt || entSt) {
      html += '<div class="an-section"><h4>スポット分析</h4>';
      html += '<table class="an-table"><thead><tr><th>特徴</th><th>あり</th><th>なし</th><th>差</th></tr></thead><tbody>';
      if (termSt && noTermSt) {
        const tR = Math.round(termSt.rate * 100), ntR = Math.round(noTermSt.rate * 100);
        const gap = ntR - tR;
        html += `<tr${Math.abs(gap) >= 8 ? ' class="an-row-weak"' : ''}>`;
        html += `<td>端牌(1・9)</td><td>${tR}%<small>(${termSt.count})</small></td>`;
        html += `<td>${ntR}%<small>(${noTermSt.count})</small></td><td>${gap > 0 ? '-' : '+'}${Math.abs(gap)}%</td></tr>`;
      }
      if (entSt && noEntSt) {
        const eR = Math.round(entSt.rate * 100), neR = Math.round(noEntSt.rate * 100);
        const gap = neR - eR;
        html += `<tr${Math.abs(gap) >= 8 ? ' class="an-row-weak"' : ''}>`;
        html += `<td>煙突形(3334型)</td><td>${eR}%<small>(${entSt.count})</small></td>`;
        html += `<td>${neR}%<small>(${noEntSt.count})</small></td><td>${gap > 0 ? '-' : '+'}${Math.abs(gap)}%</td></tr>`;
      }
      html += '</tbody></table></div>';
    }

    // チョンボ種別
    if (chonboBreakdown.length > 0) {
      html += '<div class="an-section"><h4>チョンボ種別</h4><div class="an-bar-chart">';
      const maxCnt = Math.max(...chonboBreakdown.map(e => e.count));
      for (const e of chonboBreakdown) {
        const pct = maxCnt > 0 ? Math.round((e.count / maxCnt) * 100) : 0;
        html += '<div class="an-row">';
        html += `<span class="an-label an-label-wide">${e.label}</span>`;
        html += `<span class="an-track"><span class="an-fill an-fill-red" style="width:${pct}%"></span></span>`;
        html += `<span class="an-value">${e.count}回</span>`;
        html += '</div>';
      }
      html += '</div></div>';
    }

    // 苦手パターン
    html += '<div class="an-section"><h4>苦手パターン</h4>';
    if (weaknesses.length > 0) {
      for (const w of weaknesses) {
        html += '<div class="an-card">';
        html += `<div class="an-card-title">${w.icon} ${w.title}</div>`;
        html += `<div class="an-card-msg">${w.message}</div>`;
        html += `<div class="an-card-detail">${w.detail}</div>`;
        if (w.advice) html += `<div class="an-card-advice">💡 ${w.advice}</div>`;
        html += '</div>';
      }
    } else {
      html += '<div class="an-card an-card-good">';
      html += '<div class="an-card-msg">✅ 特に苦手パターンは見つかりませんでした</div>';
      html += '<div class="an-card-detail">全体的にバランスよく正解できています</div></div>';
    }
    html += '</div>';

    // 難易度別成績
    if (diffRows.length > 0) {
      html += '<div class="an-section"><h4>難易度別成績</h4>';
      html += '<table class="an-table"><thead><tr><th>難易度</th><th>正解率</th><th>局数</th></tr></thead><tbody>';
      for (const { label, s } of diffRows) {
        const pct = Math.round(s.rate * 100);
        html += `<tr${s.rateGap > 0.05 ? ' class="an-row-weak"' : ''}>`;
        html += `<td>${label}</td><td>${pct}%</td><td>${s.count}局</td></tr>`;
      }
      html += '</tbody></table></div>';
    }

    content.innerHTML = html;
  }

  // ========== 通算記録画面 ==========

  function showRecordsScreen() {
    showScreen('records-screen');
    const content = document.getElementById('records-content');
    const rec = JSON.parse(localStorage.getItem('chinitsu-records') || '{}');

    if (!rec.totalGames) {
      content.innerHTML = '<div class="analysis-empty">まだ記録がありません<br><small>ゲームをプレイすると記録が残ります</small></div>';
      return;
    }

    function fmtTime(sec) {
      if (!sec) return '0秒';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return `${h}時間${m}分`;
      if (m > 0) return `${m}分${s}秒`;
      return `${s}秒`;
    }

    function computeStreak(dates) {
      if (!dates || !dates.length) return 0;
      const sorted = [...new Set(dates)].sort().reverse();
      const todayMs = new Date(new Date().toDateString()).getTime();
      let streak = 0, expectedMs = todayMs;
      for (const d of sorted) {
        const p = d.split('/').map(Number);
        const dMs = new Date(p[0], p[1] - 1, p[2]).getTime();
        if (dMs === expectedMs) { streak++; expectedMs -= 86400000; }
        else if (dMs < expectedMs) break;
      }
      return streak;
    }

    function card(icon, label, value, sub, highlight) {
      return `<div class="rec-card${highlight ? ' rec-card-hl' : ''}">
        <div class="rec-icon">${icon}</div>
        <div class="rec-label">${label}</div>
        <div class="rec-value">${value}</div>
        ${sub ? `<div class="rec-sub">${sub}</div>` : ''}
      </div>`;
    }

    function section(title, cards) {
      return `<div class="rec-section"><div class="rec-section-title">${title}</div><div class="rec-grid">${cards.join('')}</div></div>`;
    }

    const totalGames    = rec.totalGames || 0;
    const totalRounds   = rec.totalRounds || 0;
    const totalCorrect  = rec.totalCorrect || 0;
    const totalWrong    = rec.totalWrong || 0;
    const totalMiss     = rec.totalMiss || 0;
    const correctRate   = totalRounds > 0 ? Math.round((totalCorrect / totalRounds) * 100) : 0;
    const playDays      = (rec.playDates || []).length;
    const currentStreak = computeStreak(rec.playDates);
    const streakSub     = currentStreak >= (rec.bestDayStreak || 0) && currentStreak > 0
      ? '🌟現在最高記録中！' : `過去最高: ${rec.bestDayStreak || 0}日`;
    const chonboSec     = totalWrong * 3;
    const perfectGames  = rec.perfectGames || 0;

    let html = '';

    // === プレイ実績 ===
    html += section('プレイ実績', [
      card('🎮', '総ゲーム数', `${totalGames}回`),
      card('⏱️', '総プレイ時間', fmtTime(rec.totalPlayTimeSec || 0)),
      card('📅', 'プレイ日数', `${playDays}日`),
      card('🔥', '連続日数', `${currentStreak}日`, streakSub, currentStreak > 0 && currentStreak >= (rec.bestDayStreak || 0))
    ]);

    // === スコア記録 ===
    html += section('スコア記録', [
      card('🏆', '全モード最高スコア', `${(rec.bestScore || 0).toLocaleString()}点`, rec.bestScoreDate || '', !!rec.bestScore),
      card('🎯', '最多周回数', `${rec.bestRoundsInGame || 0}局`, '1ゲーム中'),
      card('⚡️', '最長プレイ', fmtTime(rec.longestPlayTimeSec || 0), '1ゲーム'),
      card('💰', '累計獲得ポイント', `${(rec.totalPointsEarned || 0).toLocaleString()}点`)
    ]);

    // === 正確さ記録 ===
    html += section('正確さ記録', [
      card('📊', '通算正解率', `${correctRate}%`, `${totalRounds.toLocaleString()}局中${totalCorrect.toLocaleString()}正解`),
      card('🔑', '最大連続正解', `${rec.maxConsecutiveCorrect || 0}連続`, 'ゲーム内最高', (rec.maxConsecutiveCorrect || 0) >= 5),
      card('💎', 'パーフェクトG', `${perfectGames}回`, 'チョンボ0のゲーム', perfectGames > 0),
      card('👌', '見逃し正解率', `${totalRounds > 0 ? Math.round(((totalRounds - totalCorrect - totalWrong) / totalRounds) * 100) : 0}%`, '見逃しのうち正解割合')
    ]);

    // === 累計統計 ===
    html += section('累計統計', [
      card('🌄', '総回答数', `${totalRounds.toLocaleString()}局`),
      card('✅', '総正解数', `${totalCorrect.toLocaleString()}回`),
      card('❌', '総チョンボ数', `${totalWrong.toLocaleString()}回`),
      card('⏳', 'チョンボで失った時間', fmtTime(chonboSec), `3秒×${totalWrong}回`)
    ]);

    // === 初・最終プレイ日 ===
    html += `<div class="rec-footer">
      <span>📆 初プレイ: ${rec.firstPlayDate || '-'}</span>
      <span>最終: ${rec.lastPlayDate || '-'}</span>
    </div>`;

    content.innerHTML = html;
  }

  return {
    tileImgSrc,
    createTileDiv,
    createBackTile,
    initTable,
    renderHand,
    showTsumoTile,
    clearTsumoArea,
    clearAllRivers,
    addToRiver,
    renderDoraIndicator,
    updateInfoBar,
    setActivePlayer,
    clearActivePlayer,
    updateFuritenIndicator,
    updateMinogashiIndicator,
    setButtonsEnabled,
    highlightButton,
    updateScore,
    updateTimer,
    updateRoundCount,
    showRoundResult,
    showGameOver,
    showReviewScreen,
    showRankingScreen,
    clearCurrentRankingMode,
    showAnalysisScreen,
    showRecordsScreen,
    showScreen,
    showActionTimerBar,
    resetActionTimerBar,
    updateRoundLabel,
    PLAYER_NAMES
  };
})();
