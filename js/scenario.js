// scenario.js - ラウンドシナリオ生成
// 清一色テンパイ手牌 + 2巡分のアクションシーケンスを生成

const Scenario = (() => {

  const MAX_ATTEMPTS = 500;
  const PLAYERS = ['self', 'shimocha', 'toimen', 'kamicha']; // 反時計回り

  // 難易度定義（待ち牌の種類数）
  const DIFFICULTY = {
    easy:   { minWaits: 1, maxWaits: 2 },
    medium: { minWaits: 3, maxWaits: 4 },
    hard:   { minWaits: 5, maxWaits: 9 }
  };

  // ========== 和了形のランダム構築 ==========

  function buildRandomAgari14() {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tiles = Tile.createEmpty();
      const head = Math.floor(Math.random() * 9);
      tiles[head] += 2;

      let valid = true;
      for (let m = 0; m < 4; m++) {
        if (Math.random() < 0.3) {
          const t = Math.floor(Math.random() * 9);
          if (tiles[t] + 3 > 4) { valid = false; break; }
          tiles[t] += 3;
        } else {
          const t = Math.floor(Math.random() * 7);
          if (tiles[t] + 1 > 4 || tiles[t + 1] + 1 > 4 || tiles[t + 2] + 1 > 4) {
            valid = false; break;
          }
          tiles[t]++;
          tiles[t + 1]++;
          tiles[t + 2]++;
        }
      }
      if (valid && Tile.count(tiles) === 14 && Tile.isValid(tiles)) {
        return tiles;
      }
    }
    return null;
  }

  function buildRandomChitoitsu14() {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tiles = Tile.createEmpty();
      const available = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      for (let i = 0; i < 7; i++) {
        tiles[available[i]] = 2;
      }
      if (Tile.count(tiles) === 14 && Tile.isValid(tiles)) {
        return tiles;
      }
    }
    return null;
  }

  // ========== テンパイ手牌生成 ==========

  function generateTenpaiHand(difficulty) {
    const diff = DIFFICULTY[difficulty];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const useChitoitsu = Math.random() < 0.15;
      const agari14 = useChitoitsu ? buildRandomChitoitsu14() : buildRandomAgari14();
      if (!agari14) continue;

      const expanded = Tile.expand(agari14);
      const removeIdx = Math.floor(Math.random() * expanded.length);
      const tiles13 = Tile.copy(agari14);
      tiles13[expanded[removeIdx]]--;

      const waits = Hand.getTenpaiWaits(tiles13);
      if (waits.length < diff.minWaits || waits.length > diff.maxWaits) continue;

      // 全待ち牌が残っているか確認（手牌で4枚使い切りチェック）
      const validWaits = waits.filter(w => tiles13[w.tile] < 4);
      if (validWaits.length < diff.minWaits || validWaits.length > diff.maxWaits) continue;

      return { tiles: tiles13, waits: validWaits };
    }
    return null;
  }

  // ========== 壁の中の残り牌管理 ==========

  function createWall(handTiles, doraIndicator, suit) {
    // 清一色の色の残り牌
    const chinitsuRemaining = [];
    for (let i = 0; i < 9; i++) {
      chinitsuRemaining[i] = 4 - handTiles[i];
    }
    if (doraIndicator >= 0 && doraIndicator < 9) {
      chinitsuRemaining[doraIndicator]--;
    }

    return { chinitsuRemaining };
  }

  // 壁から牌を1枚抜く（清一色の色のみ）
  function drawFromWallChinitsu(wall) {
    const candidates = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < wall.chinitsuRemaining[i]; j++) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    const tile = candidates[idx];
    wall.chinitsuRemaining[tile]--;
    return tile;
  }

  // 壁からランダムな牌を抜く（他家の捨て牌用、自分と同じ色のみ）
  function drawRandomForOther(wall, waitTiles, insertWinTile) {
    if (insertWinTile !== null && insertWinTile !== undefined) {
      // アガリ牌を強制挿入
      if (wall.chinitsuRemaining[insertWinTile] > 0) {
        wall.chinitsuRemaining[insertWinTile]--;
        return { tileIndex: insertWinTile, isPlayerSuit: true };
      }
    }

    // 自分と同じ色から捨て牌を選ぶ（待ち牌以外を優先）
    const candidates = [];
    for (let i = 0; i < 9; i++) {
      if (wall.chinitsuRemaining[i] > 0 && !waitTiles.includes(i)) {
        candidates.push(i);
      }
    }
    if (candidates.length > 0) {
      const tile = candidates[Math.floor(Math.random() * candidates.length)];
      wall.chinitsuRemaining[tile]--;
      return { tileIndex: tile, isPlayerSuit: true };
    }
    // 非待ち牌が枯渇: 壁にある牌なら何でも使う（isWinOpportunity は false のまま）
    const allCandidates = [];
    for (let i = 0; i < 9; i++) {
      if (wall.chinitsuRemaining[i] > 0) allCandidates.push(i);
    }
    if (allCandidates.length > 0) {
      const tile = allCandidates[Math.floor(Math.random() * allCandidates.length)];
      wall.chinitsuRemaining[tile]--;
      return { tileIndex: tile, isPlayerSuit: true };
    }
    return null;
  }

  // ========== シナリオ生成 ==========

  function generate(difficulty) {
    const diff = DIFFICULTY[difficulty];

    for (let outerAttempt = 0; outerAttempt < 50; outerAttempt++) {
      const handResult = generateTenpaiHand(difficulty);
      if (!handResult) continue;

      const { tiles, waits } = handResult;
      const waitTileIndices = waits.map(w => w.tile);

      // 牌種・ドラ・親子をランダム決定
      const suit = Tile.randomSuit();
      const isDealer = Math.random() < 0.25;

      // ドラ表示牌: 使い切っていない牌から選ぶ
      const doraCandidates = [];
      for (let i = 0; i < 9; i++) {
        if (tiles[i] < 4) doraCandidates.push(i);
      }
      const doraIndicator = doraCandidates[Math.floor(Math.random() * doraCandidates.length)];
      const doraIndex = Tile.getDoraIndex(doraIndicator);
      const doraCount = Tile.countDora(tiles, doraIndex, null);

      // 局（東1〜南4をランダム）
      const roundWind = Math.random() < 0.5 ? '東' : '南';
      const roundNumber = Math.floor(Math.random() * 4) + 1;

      // 壁を作成
      const wall = createWall(tiles, doraIndicator, suit);

      // 開始プレイヤーをランダム決定
      const startPlayerIdx = Math.floor(Math.random() * 4);

      // 2巡 = 8アクション
      const actions = [];
      let winTileInserted = false;
      // action 0〜3 の間にランダムに当たり牌を挿入（最初の1打から可能、他家の4枚目以内）
      const insertAt = Math.floor(Math.random() * 4); // 0~3番目のアクション

      for (let i = 0; i < 8; i++) {
        const playerIdx = (startPlayerIdx + i) % 4;
        const player = PLAYERS[playerIdx];

        if (player === 'self') {
          // 自分の番: ツモ
          let tsumoTile;
          if (!winTileInserted && i >= insertAt && Math.random() < 0.4) {
            // アガリ牌をツモらせる
            const availableWins = waitTileIndices.filter(w => wall.chinitsuRemaining[w] > 0);
            if (availableWins.length > 0) {
              tsumoTile = availableWins[Math.floor(Math.random() * availableWins.length)];
              wall.chinitsuRemaining[tsumoTile]--;
              winTileInserted = true;
            }
          }
          if (tsumoTile === undefined) {
            tsumoTile = drawFromWallChinitsu(wall);
            if (tsumoTile === null) break;
          }

          actions.push({
            player: 'self',
            type: 'tsumo',
            tileIndex: tsumoTile,
            isPlayerSuit: true
          });
        } else {
          // 他家の番: 捨て牌
          let insertWin = null;
          if (!winTileInserted && i >= insertAt) {
            // このアクションでアガリ牌を挿入
            const availableWins = waitTileIndices.filter(w => wall.chinitsuRemaining[w] > 0);
            if (availableWins.length > 0) {
              insertWin = availableWins[Math.floor(Math.random() * availableWins.length)];
            }
          }

          const drawn = drawRandomForOther(wall, waitTileIndices, insertWin);
          if (!drawn) break; // 壁切れ
          const isDesignatedWin = insertWin !== null && drawn.tileIndex === insertWin;
          if (isDesignatedWin) winTileInserted = true;

          actions.push({
            player,
            type: 'discard',
            tileIndex: drawn.tileIndex,
            suit: suit,
            isPlayerSuit: true,
            isWinOpportunity: isDesignatedWin
          });
        }
      }

      // アガリ牌が挿入されなかった場合、最後の他家アクションに強制挿入
      if (!winTileInserted) {
        const availableWins = waitTileIndices.filter(w => wall.chinitsuRemaining[w] > 0);
        if (availableWins.length === 0) continue; // やり直し

        const winTile = availableWins[Math.floor(Math.random() * availableWins.length)];
        // 最後の他家アクションを探す
        for (let i = actions.length - 1; i >= 0; i--) {
          if (actions[i].player !== 'self') {
            actions[i].tileIndex = winTile;
            actions[i].suit = suit;
            actions[i].isPlayerSuit = true;
            actions[i].isWinOpportunity = true;
            winTileInserted = true;
            break;
          }
        }
        // 他家アクションがない場合（全部自分のツモだった場合）、最後のツモをアガリ牌に
        if (!winTileInserted) {
          for (let i = actions.length - 1; i >= 0; i--) {
            if (actions[i].player === 'self') {
              actions[i].tileIndex = winTile;
              winTileInserted = true;
              break;
            }
          }
        }
      }

      if (!winTileInserted) continue;

      return {
        tiles,
        waits,
        waitTileIndices,
        suit,
        isDealer,
        doraIndicator,
        doraIndex,
        doraCount,
        actions,
        difficulty,
        startPlayerIdx,
        roundWind,
        roundNumber
      };
    }
    return null;
  }

  return {
    PLAYERS,
    DIFFICULTY,
    generate
  };
})();
