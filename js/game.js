// game.js - ゲームステートマシン・タイマー・スコア管理

const Game = (() => {

  // ========== 定数 ==========
  const STATES = {
    MENU: 'menu',
    ROUND_START: 'round_start',
    ACTION_PHASE: 'action_phase',
    WAITING_INPUT: 'waiting_input',
    RESULT: 'result',
    GAME_OVER: 'game_over'
  };

  const PENALTY_POINTS = 8000; // 満貫相当
  const PENALTY_TIME = 3;       // チョンボ時の時間減少
  const CORRECT_TIME_BONUS = 1; // 正解時の時間加算
  const MINOGASHI_BONUS = 2000; // 見逃し正解ボーナス

  const TIME_LIMITS = {
    short: 30,
    medium: 60,
    long: 90
  };

  const SPEED_MS = {
    fast: 2000,
    normal: 3000,
    slow: 5000
  };

  // ========== ゲーム状態 ==========
  let state = STATES.MENU;
  let scenario = null;
  let actionIndex = 0;
  let actionTimer = null;
  let gameTimer = null;
  let timeRemaining = 0;
  let score = 0;
  let roundCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let missCount = 0;
  let wrongRounds = []; // 不正解・見逃しのシナリオ記録
  let gameKyokuIndex = 0; // 0=東1 ... 3=東4, 4=南1 ... 15=北4
  let gameHonba = 0;

  // ラウンド状態
  let isFuriten = false;
  let winTileAppeared = false; // 誰かがアガリ牌を捨てたことがあるか
  let myDiscards = []; // 自分のツモ切り牌（フリテン判定用）
  let currentTsumoTile = null; // 現在のツモ牌（自分の番の場合）
  let roundResolved = false;
  let inputTimeoutId = null;

  // 設定
  let difficulty = 'medium';
  let timeLimitKey = 'medium';
  let speedKey = 'normal';

  // コールバック
  let onStateChange = null;
  let onActionExecuted = null;
  let onTimerTick = null;
  let onRoundResult = null;

  // ========== 設定 ==========

  function configure(opts) {
    if (opts.difficulty) difficulty = opts.difficulty;
    if (opts.timeLimit) timeLimitKey = opts.timeLimit;
    if (opts.speed) speedKey = opts.speed;
    if (opts.onStateChange) onStateChange = opts.onStateChange;
    if (opts.onActionExecuted) onActionExecuted = opts.onActionExecuted;
    if (opts.onTimerTick) onTimerTick = opts.onTimerTick;
    if (opts.onRoundResult) onRoundResult = opts.onRoundResult;
  }

  // ========== ゲーム開始 ==========

  function startGame() {
    score = 0;
    roundCount = 0;
    correctCount = 0;
    wrongCount = 0;
    missCount = 0;
    wrongRounds = [];
    gameKyokuIndex = 0;
    gameHonba = 0;
    timeRemaining = TIME_LIMITS[timeLimitKey];

    setState(STATES.ROUND_START);
    if (onTimerTick) onTimerTick(timeRemaining);
    startGameTimer();
    startNewRound();
  }

  function startGameTimer() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = setInterval(() => {
      timeRemaining--;
      if (onTimerTick) onTimerTick(timeRemaining);
      if (timeRemaining <= 0) {
        endGame();
      }
    }, 1000);
  }

  function endGame() {
    clearAllTimers();
    setState(STATES.GAME_OVER);
  }

  // ========== ラウンド管理 ==========

  function startNewRound() {
    if (state === STATES.GAME_OVER) return;

    scenario = Scenario.generate(difficulty);
    if (!scenario) {
      // 生成失敗時はリトライ
      scenario = Scenario.generate(difficulty);
      if (!scenario) {
        endGame();
        return;
      }
    }

    // 局・本場を上書き（シナリオのランダム値を使わず管理値を使用）
    const KYOKU_WINDS = ['東', '南', '西', '北'];
    scenario.roundWind = KYOKU_WINDS[Math.floor(gameKyokuIndex / 4) % 4];
    scenario.roundNumber = (gameKyokuIndex % 4) + 1;
    scenario.honba = gameHonba;

    actionIndex = 0;
    isFuriten = false;
    winTileAppeared = false;
    myDiscards = [];
    currentTsumoTile = null;
    roundResolved = false;
    roundCount++;

    setState(STATES.ROUND_START);

    // 少し待ってからアクション開始
    setTimeout(() => {
      if (state === STATES.GAME_OVER) return;
      setState(STATES.ACTION_PHASE);
      executeNextAction();
    }, 1500);
  }

  // ========== アクション実行 ==========

  function executeNextAction() {
    if (roundResolved || state === STATES.GAME_OVER) return;
    if (actionIndex >= scenario.actions.length) {
      // 2巡終了、見逃し
      resolveRound('miss', null);
      return;
    }

    const action = scenario.actions[actionIndex];

    if (action.player === 'self') {
      // 自分の番: ツモ
      currentTsumoTile = action.tileIndex;
      const isWinTile = scenario.waitTileIndices.includes(action.tileIndex);

      if (onActionExecuted) {
        onActionExecuted(action, actionIndex, isWinTile);
      }

      if (isWinTile) {
        // アガリ牌をツモった → プレイヤーにツモ宣言のチャンスを与える
        setState(STATES.WAITING_INPUT);
        inputTimeoutId = setTimeout(() => {
          if (roundResolved) return;
          // 時間切れ → ツモ切り（フリテン化）
          autoTsumoKiri(action.tileIndex);
        }, getSpeed());
      } else {
        // アガリ牌ではない → 自動ツモ切り
        setState(STATES.WAITING_INPUT);
        inputTimeoutId = setTimeout(() => {
          if (roundResolved) return;
          autoTsumoKiri(action.tileIndex);
        }, getSpeed());
      }
    } else {
      // 他家の番: 捨て牌
      currentTsumoTile = null;
      // isWinOpportunity: シナリオ生成時に意図的に挿入されたアガリ牌のみ true
      const isWinTile = action.isWinOpportunity === true;

      if (onActionExecuted) {
        onActionExecuted(action, actionIndex, isWinTile);
      }

      if (isWinTile) {
        // アガリ牌が捨てられた → ロン宣言のチャンスを与える
        winTileAppeared = true;
        setState(STATES.WAITING_INPUT);
        inputTimeoutId = setTimeout(() => {
          if (roundResolved) return;
          // 時間切れ → 見逃し、フリテン化して次のアクションへ
          isFuriten = true;
          if (onActionExecuted) {
            onActionExecuted({ player: 'self', type: 'furiten_update' }, actionIndex, false);
          }
          advanceAction();
        }, getSpeed());
      } else {
        // アガリ牌ではない → 次のアクションへ
        setState(STATES.WAITING_INPUT);
        inputTimeoutId = setTimeout(() => {
          if (roundResolved) return;
          advanceAction();
        }, getSpeed());
      }
    }
  }

  function autoTsumoKiri(tileIndex) {
    // ツモ切り処理
    myDiscards.push(tileIndex);

    // フリテン判定: ツモ切りした牌が待ち牌に含まれているか
    if (scenario.waitTileIndices.includes(tileIndex)) {
      isFuriten = true;
      winTileAppeared = true; // 自分がアガリ牌を捨てた → 見逃し正解対象
    }

    if (onActionExecuted) {
      onActionExecuted({ player: 'self', type: 'tsumokiri', tileIndex }, actionIndex, false);
    }

    currentTsumoTile = null;
    advanceAction();
  }

  function advanceAction() {
    if (roundResolved || state === STATES.GAME_OVER) return;
    actionIndex++;
    if (actionIndex >= scenario.actions.length) {
      // 2巡終了
      resolveRound('miss', null);
    } else {
      setState(STATES.ACTION_PHASE);
      executeNextAction();
    }
  }

  // ========== プレイヤー宣言 ==========

  function declareRon() {
    if (state !== STATES.WAITING_INPUT || roundResolved) return;
    if (state === STATES.GAME_OVER) return;
    clearInputTimeout();

    const action = scenario.actions[actionIndex];

    // ロンは他家の捨て牌時のみ有効
    if (action.player === 'self') {
      // 自分のツモ番にロンは誤宣言
      resolveRound('wrong_ron_on_tsumo', action);
      return;
    }

    const isWinTile = action.isWinOpportunity === true;

    if (isWinTile && !isFuriten) {
      // 正しいロン
      const scoreResult = calculateWinScore(action.tileIndex, false);
      resolveRound('correct_ron', { action, scoreResult });
    } else if (isWinTile && isFuriten) {
      // フリテン中にロン → 誤宣言
      resolveRound('wrong_furiten_ron', action);
    } else {
      // アガリ牌でないのにロン → 誤宣言
      resolveRound('wrong_ron', action);
    }
  }

  function declareTsumo() {
    if (state !== STATES.WAITING_INPUT || roundResolved) return;
    if (state === STATES.GAME_OVER) return;
    clearInputTimeout();

    const action = scenario.actions[actionIndex];

    // ツモは自分のツモ番のみ有効
    if (action.player !== 'self') {
      resolveRound('wrong_tsumo_on_other', action);
      return;
    }

    const isWinTile = scenario.waitTileIndices.includes(action.tileIndex);

    if (isWinTile) {
      // 正しいツモ
      const scoreResult = calculateWinScore(action.tileIndex, true);
      resolveRound('correct_tsumo', { action, scoreResult });
    } else {
      // アガリ牌でないのにツモ → 誤宣言
      resolveRound('wrong_tsumo', action);
    }
  }

  function declareMinogashi() {
    if (roundResolved) return;
    if (state === STATES.GAME_OVER) return;
    if (state !== STATES.WAITING_INPUT) return;
    clearInputTimeout();

    // 正解条件: 誰か（自分・他家）がアガリ牌を切ったことがある
    // winTileAppeared: 他家がアガリ牌を捨てた / isFuriten: 自分がアガリ牌を捨てた
    if (winTileAppeared || isFuriten) {
      resolveRound('correct_minogashi', {});
    } else {
      // まだ誰もアガリ牌を切っていない → 誤宣言
      resolveRound('wrong_minogashi', scenario.actions[actionIndex]);
    }
  }

  function declareSkip() {
    if (roundResolved) return;
    if (state === STATES.GAME_OVER) return;
    if (state !== STATES.WAITING_INPUT) return;

    const action = scenario.actions[actionIndex];

    if (action.player === 'self') {
      // 自分のツモ番
      const isWinTile = scenario.waitTileIndices.includes(action.tileIndex);
      if (isWinTile) {
        // ツモアガリできる牌をスキップ → チョンボ
        clearInputTimeout();
        resolveRound('wrong_skip_win', action);
      } else {
        // アガリ牌でない → 通常ツモ切り
        clearInputTimeout();
        autoTsumoKiri(action.tileIndex);
      }
    } else {
      // 他家の捨て牌
      const isWinTile = action.isWinOpportunity === true;
      if (isWinTile && !isFuriten) {
        // ロンできる牌をスキップ → チョンボ
        clearInputTimeout();
        resolveRound('wrong_skip_win', action);
      } else {
        // アガリ牌でない or フリテン中 → 山を進める
        clearInputTimeout();
        advanceAction();
      }
    }
  }

  // ========== スコア計算 ==========

  function calculateWinScore(winTile, isTsumo) {
    const situation = {
      isTsumo,
      isOpen: false,
      doraCount: scenario.doraCount,
      redDoraCount: 0,
      meld: null
    };

    const yakuResult = Yaku.getBestYaku(
      scenario.tiles, scenario.waits, winTile, situation, null
    );

    if (!yakuResult) return null;

    const scoreResult = Score.calculateScore(
      yakuResult.totalHan,
      yakuResult.isYakuman,
      { isTsumo }
    );

    // 本場ボーナス: 300点 × 本場数
    const honbaBonus = gameHonba * 300;
    scoreResult.total += honbaBonus;
    if (isTsumo && scoreResult.payments) {
      const perPlayer = Math.floor(honbaBonus / 3);
      scoreResult.payments.ko += perPlayer;
      scoreResult.payments.oya += perPlayer;
    }
    scoreResult.honbaBonus = honbaBonus;

    return {
      ...scoreResult,
      yakuList: yakuResult.yakuList,
      totalHan: yakuResult.totalHan,
      isYakuman: yakuResult.isYakuman,
      doraCount: yakuResult.doraCount,
      waitType: yakuResult.waitType
    };
  }

  // ========== ラウンド結果処理 ==========

  function resolveRound(resultType, data) {
    if (roundResolved) return;
    roundResolved = true;
    clearInputTimeout();

    let points = 0;
    let message = '';
    let isCorrect = false;

    switch (resultType) {
      case 'correct_ron':
        points = data.scoreResult.total;
        message = `ロン！ ${Score.formatScore(data.scoreResult)} +1秒`;
        isCorrect = true;
        correctCount++;
        break;

      case 'correct_tsumo':
        points = data.scoreResult.total;
        message = `ツモ！ ${Score.formatScore(data.scoreResult)} +1秒`;
        isCorrect = true;
        correctCount++;
        break;

      case 'correct_minogashi':
        points = MINOGASHI_BONUS;
        message = '見逃し正解！ +2,000点';
        isCorrect = true;
        correctCount++;
        break;

      case 'wrong_ron':
      case 'wrong_ron_on_tsumo':
        points = -PENALTY_POINTS;
        message = 'チョンボ！ 誤ロン -8,000点';
        wrongCount++;
        break;

      case 'wrong_furiten_ron':
        points = -PENALTY_POINTS;
        message = 'チョンボ！ フリテンロン -8,000点';
        wrongCount++;
        break;

      case 'wrong_tsumo':
      case 'wrong_tsumo_on_other':
        points = -PENALTY_POINTS;
        message = 'チョンボ！ 誤ツモ -8,000点';
        wrongCount++;
        break;

      case 'wrong_minogashi':
        points = -PENALTY_POINTS;
        message = 'チョンボ！ 誤見逃し宣言 -8,000点';
        wrongCount++;
        break;

      case 'wrong_skip_win':
        points = -PENALTY_POINTS;
        message = 'チョンボ！ アガリ牌をスキップ -8,000点';
        wrongCount++;
        break;

      case 'miss':
        points = 0;
        message = '見逃し… 0点';
        missCount++;
        break;
    }

    // 時間のボーナス/ペナルティ
    let timeDelta = 0;
    if (isCorrect && resultType !== 'correct_minogashi') {
      timeDelta = CORRECT_TIME_BONUS;
    } else if (resultType.startsWith('wrong_')) {
      timeDelta = -PENALTY_TIME;
    }
    if (timeDelta < 0) message += ` (${timeDelta}秒)`;
    timeRemaining = Math.max(0, timeRemaining + timeDelta);
    if (onTimerTick) onTimerTick(timeRemaining);

    score += points;
    if (!isCorrect) wrongRounds.push(scenario);

    const result = {
      type: resultType,
      points,
      timeDelta,
      message,
      isCorrect,
      scenario,
      isFuriten,
      winTileAppeared,
      myDiscards
    };

    setState(STATES.RESULT);
    // メッセージ表示中はタイマーを一時停止
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }

    if (onRoundResult) {
      onRoundResult(result);
    }

    // 局・本場を更新（次ラウンド用）
    // 見逃し正解は局が進む（本場リセット）、通常正解は本場が増える
    if (isCorrect && resultType !== 'correct_minogashi') {
      gameHonba++;
    } else {
      gameHonba = 0;
      gameKyokuIndex = (gameKyokuIndex + 1) % 16;
    }

    // 次のラウンドへ（制限時間が残っていれば）
    setTimeout(() => {
      if (timeRemaining > 0) {
        startGameTimer(); // タイマー再開始
        startNewRound();
      } else {
        endGame();
      }
    }, 1500);
  }

  // ========== ユーティリティ ==========

  function setState(newState) {
    state = newState;
    if (onStateChange) onStateChange(newState);
  }

  function getSpeed() {
    return SPEED_MS[speedKey] || 3000;
  }

  function clearInputTimeout() {
    if (inputTimeoutId) {
      clearTimeout(inputTimeoutId);
      inputTimeoutId = null;
    }
  }

  function clearAllTimers() {
    clearInputTimeout();
    if (actionTimer) { clearTimeout(actionTimer); actionTimer = null; }
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
  }

  function getState() { return state; }
  function getScore() { return score; }
  function getTimeRemaining() { return timeRemaining; }
  function getRoundCount() { return roundCount; }
  function getScenario() { return scenario; }
  function isFuritenState() { return isFuriten; }
  function getCurrentTsumo() { return currentTsumoTile; }
  function getStats() {
    return { roundCount, correctCount, wrongCount, missCount, score, wrongRounds };
  }

  function getConfig() {
    return { difficulty, timeLimit: timeLimitKey, speed: speedKey };
  }

  function cleanup() {
    clearAllTimers();
    state = STATES.MENU;
  }

  function hasWinTileAppeared() { return winTileAppeared; }

  return {
    STATES,
    configure,
    startGame,
    endGame,
    declareRon,
    declareTsumo,
    declareMinogashi,
    declareSkip,
    getState,
    getScore,
    getTimeRemaining,
    getRoundCount,
    getScenario,
    isFuritenState,
    hasWinTileAppeared,
    getCurrentTsumo,
    getStats,
    getConfig,
    cleanup
  };
})();
