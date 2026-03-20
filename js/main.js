// main.js - メニュー操作・Game/UI接続・イベントリスナー

(() => {
  // ========== メニュー設定 ==========
  let selectedDifficulty = 'medium';
  let selectedTimeLimit = 'medium';
  let selectedSpeed = 'normal';

  // ========== ゲーム内トラッキング ==========
  let gameStartTime = null;
  let currentStreakCorrect = 0;  // 現在ゲーム内の連続正解
  let maxStreakCorrect = 0;      // 現在ゲーム内最大連続正解
  let gamePointsEarned = 0;      // 現在ゲームの累計獲得ポイント（プラスのみ）

  function setupOptionGroup(groupId, setter) {
    const group = document.getElementById(groupId);
    const buttons = group.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        setter(btn.dataset.value);
      });
    });
  }

  setupOptionGroup('difficulty-options', v => { selectedDifficulty = v; });
  setupOptionGroup('time-options', v => { selectedTimeLimit = v; });
  setupOptionGroup('speed-options', v => { selectedSpeed = v; });

  // ========== ゲーム開始 ==========

  document.getElementById('start-btn').addEventListener('click', startGame);

  function startGame() {
    gameStartTime = Date.now();
    currentStreakCorrect = 0;
    maxStreakCorrect = 0;
    gamePointsEarned = 0;

    Game.configure({
      difficulty: selectedDifficulty,
      timeLimit: selectedTimeLimit,
      speed: selectedSpeed,
      onStateChange: handleStateChange,
      onActionExecuted: handleActionExecuted,
      onTimerTick: handleTimerTick,
      onRoundResult: handleRoundResult
    });

    UI.showScreen('game-screen');
    UI.updateScore(0);
    UI.setButtonsEnabled(false);

    Game.startGame();
  }

  // ========== Game コールバック ==========

  function handleStateChange(state) {
    switch (state) {
      case Game.STATES.ROUND_START: {
        const sc = Game.getScenario();
        if (sc) {
          UI.initTable(sc);
          UI.updateRoundCount(Game.getRoundCount());
          UI.updateScore(Game.getScore());
          UI.setButtonsEnabled(false);
          UI.resetActionTimerBar();
        }
        break;
      }

      case Game.STATES.WAITING_INPUT:
        UI.setButtonsEnabled(true);
        break;

      case Game.STATES.ACTION_PHASE:
        UI.setButtonsEnabled(false);
        break;

      case Game.STATES.GAME_OVER: {
        const stats = Game.getStats();
        const config = Game.getConfig();
        const modeKey = `${config.difficulty}_${config.timeLimit}_${config.speed}`;
        // 不正解・見逃し問題を localStorage に追記（最大50件）
        if ((stats.wrongRounds || []).length > 0) {
          const key = 'chinitsu-review';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = existing.concat(stats.wrongRounds).slice(-50);
          localStorage.setItem(key, JSON.stringify(updated));
        }
        // ランキング保存
        saveRanking(stats, modeKey);
        // 通算記録更新
        const playTimeSec = Math.round((Date.now() - (gameStartTime || Date.now())) / 1000);
        updateRecords(stats, playTimeSec);
        UI.showGameOver(stats, modeKey);
        break;
      }
    }
  }

  function handleActionExecuted(action, index, isWinTile) {
    const sc = Game.getScenario();
    if (!sc) return;

    if (action.type === 'tsumo') {
      // 自分のツモ
      UI.setActivePlayer('self');
      UI.showTsumoTile(action.tileIndex, sc.suit);
      // タイマーバー開始
      UI.showActionTimerBar(getSpeedMs());
    } else if (action.type === 'tsumokiri') {
      // ツモ切り → 自分の河に追加
      UI.clearTsumoArea();
      UI.addToRiver('self', action.tileIndex, sc.suit, true);
      // フリテン/見逃し状態更新
      UI.updateFuritenIndicator(Game.isFuritenState());
      UI.updateMinogashiIndicator(Game.hasWinTileAppeared());
    } else if (action.type === 'furiten_update') {
      // ロン見逃しによるフリテン化
      UI.updateFuritenIndicator(Game.isFuritenState());
      UI.updateMinogashiIndicator(Game.hasWinTileAppeared());
    } else if (action.type === 'discard') {
      // 他家の捨て牌（同色のみ）
      UI.setActivePlayer(action.player);
      UI.clearTsumoArea();
      UI.addToRiver(action.player, action.tileIndex, sc.suit, true);
      // タイマーバー開始
      UI.showActionTimerBar(getSpeedMs());
    }
  }

  function handleTimerTick(timeRemaining) {
    UI.updateTimer(timeRemaining);
  }

  function handleRoundResult(result) {
    UI.setButtonsEnabled(false);
    UI.resetActionTimerBar();
    UI.updateScore(Game.getScore());
    UI.showRoundResult(result);
    logRoundResult(result);
    // 連続正解・獲得ポイントトラッキング
    if (result.isCorrect) {
      currentStreakCorrect++;
      if (currentStreakCorrect > maxStreakCorrect) maxStreakCorrect = currentStreakCorrect;
    } else {
      currentStreakCorrect = 0;
    }
    if (result.points > 0) gamePointsEarned += result.points;
  }

  function getSpeedMs() {
    const map = { fast: 2000, normal: 3000, slow: 5000 };
    return map[selectedSpeed] || 3000;
  }

  // ========== ランキング保存 ==========

  function saveRanking(stats, modeKey) {
    if (stats.score <= 0) return;
    const key = 'chinitsu-ranking';
    const allData = JSON.parse(localStorage.getItem(key) || '{}');
    if (!allData[modeKey]) allData[modeKey] = [];
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    allData[modeKey].push({
      score: stats.score,
      rounds: stats.roundCount,
      correct: stats.correctCount,
      wrong: stats.wrongCount,
      miss: stats.missCount,
      date: dateStr
    });
    allData[modeKey].sort((a, b) => b.score - a.score);
    allData[modeKey] = allData[modeKey].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(allData));
  }

  // ========== 通算記録更新 ==========

  function dateStr(d) {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  function computeStreak(dates) {
    if (!dates || !dates.length) return 0;
    const sorted = [...new Set(dates)].sort().reverse();
    const todayMs = new Date(new Date().toDateString()).getTime();
    let streak = 0, expectedMs = todayMs;
    for (const d of sorted) {
      const parts = d.split('/').map(Number);
      const dMs = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      if (dMs === expectedMs) { streak++; expectedMs -= 86400000; }
      else if (dMs < expectedMs) break;
    }
    return streak;
  }

  function updateRecords(stats, playTimeSec) {
    const KEY = 'chinitsu-records';
    const rec = JSON.parse(localStorage.getItem(KEY) || '{}');
    const today = dateStr(new Date());

    rec.totalGames        = (rec.totalGames || 0) + 1;
    rec.totalPlayTimeSec  = (rec.totalPlayTimeSec || 0) + playTimeSec;
    rec.totalRounds       = (rec.totalRounds || 0) + stats.roundCount;
    rec.totalCorrect      = (rec.totalCorrect || 0) + stats.correctCount;
    rec.totalWrong        = (rec.totalWrong || 0) + stats.wrongCount;
    rec.totalMiss         = (rec.totalMiss || 0) + stats.missCount;
    rec.totalPointsEarned = (rec.totalPointsEarned || 0) + gamePointsEarned;

    if (stats.score > (rec.bestScore || 0)) {
      rec.bestScore     = stats.score;
      rec.bestScoreDate = today;
    }
    rec.bestRoundsInGame    = Math.max(rec.bestRoundsInGame || 0, stats.roundCount);
    rec.longestPlayTimeSec  = Math.max(rec.longestPlayTimeSec || 0, playTimeSec);
    rec.maxConsecutiveCorrect = Math.max(rec.maxConsecutiveCorrect || 0, maxStreakCorrect);

    if (stats.wrongCount === 0 && stats.roundCount >= 3) {
      rec.perfectGames = (rec.perfectGames || 0) + 1;
    }

    if (!rec.firstPlayDate) rec.firstPlayDate = today;
    rec.lastPlayDate = today;

    if (!rec.playDates) rec.playDates = [];
    if (!rec.playDates.includes(today)) {
      rec.playDates.push(today);
      rec.playDates.sort();
      if (rec.playDates.length > 365) rec.playDates.splice(0, rec.playDates.length - 365);
    }
    const currentStreak = computeStreak(rec.playDates);
    rec.bestDayStreak = Math.max(rec.bestDayStreak || 0, currentStreak);

    localStorage.setItem(KEY, JSON.stringify(rec));
  }

  // ========== 苦手分析ログ ==========

  function logRoundResult(result) {
    const KEY = 'chinitsu-game-log';
    const log = JSON.parse(localStorage.getItem(KEY) || '[]');
    const sc = result.scenario;
    if (!sc) return;

    // 端牌判定: 待ち牌に1またら9があるか
    const hasTerminal = sc.waitTileIndices.some(w => w === 0 || w === 8);

    // 煙突形判定: 3334型など
    let hasEntotsu = false;
    const ti = sc.tiles;
    for (let i = 0; i < 8; i++) {
      if ((ti[i] >= 3 && ti[i + 1] >= 1) || (ti[i] >= 1 && ti[i + 1] >= 3)) {
        hasEntotsu = true; break;
      }
    }

    // 待ち形タイプ分析
    const waitTypesSet = new Set();
    for (const w of (sc.waits || [])) {
      if (w.decompositions && w.decompositions.length > 0) {
        const decomp = w.decompositions.find(d => !d.isChitoitsu) || w.decompositions[0];
        const wt = Hand.getWaitType(sc.tiles, w.tile, decomp);
        if (wt) waitTypesSet.add(wt);
      }
    }

    log.push({
      isCorrect: result.isCorrect,
      resultType: result.type,
      waitCount: sc.waitTileIndices.length,
      difficulty: selectedDifficulty,
      hasTerminal,
      hasEntotsu,
      waitTypes: Array.from(waitTypesSet),
      timestamp: Date.now()
    });
    if (log.length > 500) log.splice(0, log.length - 500);
    localStorage.setItem(KEY, JSON.stringify(log));
  }

  // ========== アクションボタン ==========

  document.getElementById('btn-ron').addEventListener('click', () => {
    Game.declareRon();
  });

  document.getElementById('btn-tsumo').addEventListener('click', () => {
    Game.declareTsumo();
  });

  document.getElementById('btn-skip').addEventListener('click', () => {
    Game.declareSkip();
  });

  document.getElementById('btn-minogashi').addEventListener('click', () => {
    Game.declareMinogashi();
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    if (Game.getState() !== Game.STATES.WAITING_INPUT) return;
    switch (e.key) {
      case 'r': case 'R': case '1':
        Game.declareRon();
        break;
      case 't': case 'T': case '2':
        Game.declareTsumo();
        break;
      case 'k': case 'K': case '3':
        Game.declareSkip();
        break;
      case 'm': case 'M': case '4':
        Game.declareMinogashi();
        break;
    }
  });

  // ========== ホームボタン ==========

  document.getElementById('home-btn').addEventListener('click', () => {
    Game.cleanup();
    UI.showScreen('menu-screen');
  });

  // ========== ゲームオーバー画面 ==========

  document.getElementById('retry-btn').addEventListener('click', () => {
    Game.cleanup();
    startGame();
  });

  document.getElementById('back-menu-btn').addEventListener('click', () => {
    Game.cleanup();
    UI.showScreen('menu-screen');
  });

  // ========== 振り返り画面 ==========

  document.getElementById('review-menu-btn').addEventListener('click', () => {
    const rounds = JSON.parse(localStorage.getItem('chinitsu-review') || '[]');
    UI.showReviewScreen(rounds);
  });

  document.getElementById('ranking-menu-btn').addEventListener('click', () => {
    const modeKey = `${selectedDifficulty}_${selectedTimeLimit}_${selectedSpeed}`;
    UI.showRankingScreen(modeKey);
  });

  document.getElementById('review-home-btn').addEventListener('click', () => {
    UI.showScreen('menu-screen');
  });

  document.getElementById('ranking-home-btn').addEventListener('click', () => {
    UI.showScreen('menu-screen');
  });

  document.getElementById('ranking-clear-btn').addEventListener('click', () => {
    UI.clearCurrentRankingMode();
  });

  document.getElementById('analysis-menu-btn').addEventListener('click', () => {
    UI.showAnalysisScreen();
  });

  document.getElementById('analysis-home-btn').addEventListener('click', () => {
    UI.showScreen('menu-screen');
  });

  document.getElementById('analysis-clear-btn').addEventListener('click', () => {
    if (confirm('苦手分析の記録をすべて削除しますか？')) {
      localStorage.removeItem('chinitsu-game-log');
      UI.showAnalysisScreen();
    }
  });

  document.getElementById('records-menu-btn').addEventListener('click', () => {
    UI.showRecordsScreen();
  });

  document.getElementById('records-home-btn').addEventListener('click', () => {
    UI.showScreen('menu-screen');
  });

  document.getElementById('records-clear-btn').addEventListener('click', () => {
    if (confirm('通算記録をリセットしますか？この操作は元に戻せません。')) {
      localStorage.removeItem('chinitsu-records');
      UI.showRecordsScreen();
    }
  });

  document.getElementById('review-clear-btn').addEventListener('click', () => {
    if (confirm('振り返り記録をすべて削除しますか？')) {
      localStorage.removeItem('chinitsu-review');
      UI.showReviewScreen([]);
    }
  });

})();
