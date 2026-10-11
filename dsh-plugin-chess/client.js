window.__ModuleLoader__.load({
  id: '@local/chess-float',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ============================================================
    // 象棋引擎（自 Chess/index.html 移植，改为纯函数）
    // ============================================================
    const SIZE = 8;
    const FILES = 'abcdefgh';

    function initialSetup() {
      const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
      for (let c = 0; c < SIZE; c++) {
        board[0][c] = { type: back[c], color: 'b' };
        board[1][c] = { type: 'p', color: 'b' };
        board[6][c] = { type: 'p', color: 'w' };
        board[7][c] = { type: back[c], color: 'w' };
      }
      return newGame(board);
    }

    function newGame(board) {
      return {
        board,
        turn: 'w',
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        epSquare: null,
        halfmoveClock: 0,
        history: [],
        selected: null,
        legalForSelected: [],
        lastMove: null,
        gameOver: false,
        resultText: '',
        pendingPromo: null,
      };
    }

    function sqName(r, c) { return FILES[c] + (SIZE - r); }
    function inBoard(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
    function cloneBoard(b) { return b.map(row => row.map(p => p ? { type: p.type, color: p.color } : null)); }
    function cloneState(s) {
      return {
        ...s,
        board: cloneBoard(s.board),
        castling: { ...s.castling },
        epSquare: s.epSquare ? { ...s.epSquare } : null,
        history: s.history.map(x => ({ ...x })),
        selected: s.selected ? { ...s.selected } : null,
        legalForSelected: s.legalForSelected,
        lastMove: s.lastMove ? { from: { ...s.lastMove.from }, to: { ...s.lastMove.to } } : null,
        pendingPromo: s.pendingPromo ? { ...s.pendingPromo } : null,
      };
    }

    function pseudoMoves(b, color, castlingRights, ep) {
      const moves = [];
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;

      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const p = b[r][c];
        if (!p || p.color !== color) continue;

        if (p.type === 'p') {
          if (inBoard(r + dir, c) && !b[r + dir][c]) {
            addPawn(moves, r, c, r + dir, c);
            if (r === startRow && !b[r + 2 * dir][c]) {
              moves.push({ from: { r, c }, to: { r: r + 2 * dir, c }, piece: 'p', flags: ['double'] });
            }
          }
          for (const dc of [-1, 1]) {
            const nr = r + dir, nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            const t = b[nr][nc];
            if (t && t.color !== color) addPawn(moves, r, c, nr, nc);
            else if (!t && ep && ep.r === nr && ep.c === nc) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: 'p', capture: 'p', flags: ['ep'] });
            }
          }
        } else if (p.type === 'n') {
          for (const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) {
            const nr = r + dr, nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.color !== color) push(moves, r, c, nr, nc, 'n', t);
          }
        } else if (p.type === 'k') {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            const t = b[nr][nc];
            if (!t || t.color !== color) push(moves, r, c, nr, nc, 'k', t);
          }
          const homeRow = color === 'w' ? 7 : 0;
          if (r === homeRow && c === 4) {
            const kRight = color === 'w' ? castlingRights.wK : castlingRights.bK;
            const qRight = color === 'w' ? castlingRights.wQ : castlingRights.bQ;
            if (kRight && !b[homeRow][5] && !b[homeRow][6]
                && b[homeRow][7] && b[homeRow][7].type === 'r' && b[homeRow][7].color === color
                && !isAttacked(b, homeRow, 4, color === 'w' ? 'b' : 'w')
                && !isAttacked(b, homeRow, 5, color === 'w' ? 'b' : 'w')
                && !isAttacked(b, homeRow, 6, color === 'w' ? 'b' : 'w')) {
              moves.push({ from: { r, c }, to: { r: homeRow, c: 6 }, piece: 'k', flags: ['castleK'] });
            }
            if (qRight && !b[homeRow][1] && !b[homeRow][2] && !b[homeRow][3]
                && b[homeRow][0] && b[homeRow][0].type === 'r' && b[homeRow][0].color === color
                && !isAttacked(b, homeRow, 4, color === 'w' ? 'b' : 'w')
                && !isAttacked(b, homeRow, 3, color === 'w' ? 'b' : 'w')
                && !isAttacked(b, homeRow, 2, color === 'w' ? 'b' : 'w')) {
              moves.push({ from: { r, c }, to: { r: homeRow, c: 2 }, piece: 'k', flags: ['castleQ'] });
            }
          }
        } else {
          const rays = {
            r: [[1,0],[-1,0],[0,1],[0,-1]],
            b: [[1,1],[1,-1],[-1,1],[-1,-1]],
            q: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
          }[p.type];
          for (const [dr, dc] of rays) {
            let nr = r + dr, nc = c + dc;
            while (inBoard(nr, nc)) {
              const t = b[nr][nc];
              if (!t) push(moves, r, c, nr, nc, p.type, null);
              else { if (t.color !== color) push(moves, r, c, nr, nc, p.type, t); break; }
              nr += dr; nc += dc;
            }
          }
        }
      }
      return moves;

      function push(arr, fr, fc, tr, tc, type, target) {
        arr.push({ from: { r: fr, c: fc }, to: { r: tr, c: tc }, piece: type, capture: target ? target.type : null });
      }
      function addPawn(arr, fr, fc, tr, tc) {
        const target = b[tr][tc];
        if (tr === promoRow) {
          for (const pr of ['q', 'r', 'b', 'n']) arr.push({ from: { r: fr, c: fc }, to: { r: tr, c: tc }, piece: 'p', promotion: pr, capture: target ? target.type : null });
        } else {
          arr.push({ from: { r: fr, c: fc }, to: { r: tr, c: tc }, piece: 'p', capture: target ? target.type : null });
        }
      }
    }

    function isAttacked(b, r, c, byColor) {
      const dir = byColor === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const pr = r - dir, pc = c + dc;
        if (inBoard(pr, pc)) {
          const p = b[pr][pc];
          if (p && p.color === byColor && p.type === 'p') return true;
        }
      }
      for (const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBoard(nr, nc)) { const p = b[nr][nc]; if (p && p.color === byColor && p.type === 'n') return true; }
      }
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (inBoard(nr, nc)) { const p = b[nr][nc]; if (p && p.color === byColor && p.type === 'k') return true; }
      }
      const rays = [
        [[1,0],[-1,0],[0,1],[0,-1], 'rq'],
        [[1,1],[1,-1],[-1,1],[-1,-1], 'bq'],
      ];
      for (const ray of rays) {
        const types = ray[4];
        for (let i = 0; i < 4; i++) {
          const [dr, dc] = ray[i];
          let nr = r + dr, nc = c + dc;
          while (inBoard(nr, nc)) {
            const p = b[nr][nc];
            if (p) {
              if (p.color === byColor && types.includes(p.type)) return true;
              break;
            }
            nr += dr; nc += dc;
          }
        }
      }
      return false;
    }

    function findKing(b, color) {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const p = b[r][c];
        if (p && p.type === 'k' && p.color === color) return { r, c };
      }
      return null;
    }

    function inCheck(b, color) {
      const k = findKing(b, color);
      return k ? isAttacked(b, k.r, k.c, color === 'w' ? 'b' : 'w') : false;
    }

    function applyMoveToBoard(b, m, color) {
      const nb = cloneBoard(b);
      const flags = m.flags || [];
      nb[m.to.r][m.to.c] = { type: m.promotion || m.piece, color };
      nb[m.from.r][m.from.c] = null;
      if (flags.includes('ep')) nb[m.from.r][m.to.c] = null;
      if (flags.includes('castleK')) {
        const hr = m.from.r;
        nb[hr][5] = nb[hr][7]; nb[hr][7] = null;
      }
      if (flags.includes('castleQ')) {
        const hr = m.from.r;
        nb[hr][3] = nb[hr][0]; nb[hr][0] = null;
      }
      return nb;
    }

    function legalMoves(b, color, castlingRights, ep) {
      const pseudo = pseudoMoves(b, color, castlingRights, ep);
      const out = [];
      for (const m of pseudo) {
        const nb = applyMoveToBoard(b, m, color);
        if (!inCheck(nb, color)) out.push(m);
      }
      return out;
    }

    function insufficientMaterial(board) {
      const pieces = { w: [], b: [] };
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (p && p.type !== 'k') pieces[p.color].push(p.type);
      }
      const lone = arr => arr.length === 0 || (arr.length === 1 && (arr[0] === 'n' || arr[0] === 'b'));
      return lone(pieces.w) && lone(pieces.b);
    }

    function sanBase(stateBefore, m, color, check) {
      const bBefore = stateBefore.board;
      const snap = stateBefore.history[stateBefore.history.length - 1];
      const allLegal = legalMoves(bBefore, color, snap ? snap.castling : stateBefore.castling, snap ? snap.epSquare : stateBefore.epSquare);
      if ((m.flags || []).includes('castleK')) return 'O-O';
      if ((m.flags || []).includes('castleQ')) return 'O-O-O';
      let s = '';
      if (m.piece !== 'p') {
        s += m.piece.toUpperCase();
        const same = allLegal.filter(x => x.piece === m.piece && x.to.r === m.to.r && x.to.c === m.to.c && !(x.from.r === m.from.r && x.from.c === m.from.c));
        if (same.length) {
          if (!same.some(x => x.from.c === m.from.c)) s += FILES[m.from.c];
          else if (!same.some(x => x.from.r === m.from.r)) s += (SIZE - m.from.r);
          else s += sqName(m.from.r, m.from.c);
        }
      }
      if (m.capture) {
        if (m.piece === 'p') s += FILES[m.from.c];
        s += 'x';
      }
      s += sqName(m.to.r, m.to.c);
      if (m.promotion) s += '=' + m.promotion.toUpperCase();
      return s;
    }

    // 纯函数走子：返回新 state
    function doMove(prev, m) {
      if (!m) return prev;
      const s = cloneState(prev);
      const bBefore = s.board;
      const mover = s.turn;

      s.history.push({
        board: cloneBoard(s.board), turn: s.turn, castling: { ...s.castling }, epSquare: s.epSquare ? { ...s.epSquare } : null,
        halfmoveClock: s.halfmoveClock, lastMove: s.lastMove ? { from: { ...s.lastMove.from }, to: { ...s.lastMove.to } } : null,
        san: '',
      });

      s.board = applyMoveToBoard(bBefore, m, mover);

      if (m.piece === 'k') { if (mover === 'w') { s.castling.wK = s.castling.wQ = false; } else { s.castling.bK = s.castling.bQ = false; } }
      const hr = mover === 'w' ? 7 : 0;
      if (m.piece === 'r' && m.from.r === hr) {
        if (m.from.c === 0) (mover === 'w' ? s.castling.wQ = false : s.castling.bQ = false);
        if (m.from.c === 7) (mover === 'w' ? s.castling.wK = false : s.castling.bK = false);
      }
      const oppHr = mover === 'w' ? 0 : 7;
      if (m.to.r === oppHr) {
        if (m.to.c === 0) (mover === 'w' ? s.castling.bQ = false : s.castling.wQ = false);
        if (m.to.c === 7) (mover === 'w' ? s.castling.bK = false : s.castling.wK = false);
      }

      s.epSquare = (m.flags || []).includes('double') ? { r: (m.from.r + m.to.r) / 2, c: m.from.c } : null;

      if (m.piece === 'p' || m.capture) s.halfmoveClock = 0; else s.halfmoveClock++;

      s.turn = mover === 'w' ? 'b' : 'w';
      s.selected = null; s.legalForSelected = [];
      s.lastMove = { from: { ...m.from }, to: { ...m.to } };

      // sanBase 从 history 最后一项读取走子前的易位权/过路兵快照（本次 push 的即走子前状态）
      const snapForSan = { board: bBefore, history: s.history };
      const opp = s.turn;
      const oppMoves = legalMoves(s.board, opp, s.castling, s.epSquare);
      const check = inCheck(s.board, opp);
      let san = sanBase(snapForSan, m, mover, check);
      if (check) san += oppMoves.length ? '+' : '#';
      s.history[s.history.length - 1].san = san;

      if (oppMoves.length === 0) {
        if (check) { s.gameOver = true; s.resultText = `🏁 ${mover === 'w' ? '白方' : '黑方'}胜 — 将杀（Checkmate）`; }
        else { s.gameOver = true; s.resultText = '🏁 和棋 — 逼和（Stalemate）'; }
      } else if (s.halfmoveClock >= 100) {
        s.gameOver = true; s.resultText = '🏁 和棋 — 50 回合规则';
      } else if (insufficientMaterial(s.board)) {
        s.gameOver = true; s.resultText = '🏁 和棋 — 子力不足';
      }
      return s;
    }

    function onSquareClick(prev, r, c) {
      if (prev.gameOver || prev.pendingPromo) return prev;
      const mv = prev.legalForSelected.find(m => m.to.r === r && m.to.c === c);
      if (prev.selected && mv) {
        if (mv.promotion) {
          const s = cloneState(prev);
          s.pendingPromo = { from: { ...mv.from }, to: { r, c } };
          return s;
        }
        return doMove(prev, mv);
      }
      const p = prev.board[r][c];
      const s = cloneState(prev);
      if (p && p.color === prev.turn) {
        s.selected = { r, c };
        s.legalForSelected = legalMoves(prev.board, prev.turn, prev.castling, prev.epSquare).filter(m => m.from.r === r && m.from.c === c);
      } else {
        s.selected = null; s.legalForSelected = [];
      }
      return s;
    }

    function choosePromotion(prev, pr) {
      if (!prev.pendingPromo) return prev;
      const t = prev.pendingPromo.to;
      const m = prev.legalForSelected.find(x => x.to.r === t.r && x.to.c === t.c && x.promotion === pr);
      const s = cloneState(prev);
      s.pendingPromo = null;
      return m ? doMove(s, m) : s;
    }

    function undo(prev) {
      if (!prev.history.length) return prev;
      const s = cloneState(prev);
      const snap = s.history.pop();
      s.board = snap.board; s.turn = snap.turn; s.castling = snap.castling; s.epSquare = snap.epSquare;
      s.halfmoveClock = snap.halfmoveClock; s.lastMove = snap.lastMove;
      s.selected = null; s.legalForSelected = [];
      s.gameOver = false; s.resultText = ''; s.pendingPromo = null;
      return s;
    }

    function statusText(s) {
      const side = s.turn === 'w' ? '白方' : '黑方';
      if (s.gameOver) return s.resultText;
      const checked = inCheck(s.board, s.turn);
      const moves = legalMoves(s.board, s.turn, s.castling, s.epSquare);
      if (moves.length === 0) {
        if (checked) return (s.turn === 'w' ? '黑方' : '白方') + ' 胜 · 将杀（Checkmate）';
        return '和棋 · 逼和（Stalemate）';
      }
      return checked ? `⚠ ${side}被将军！必须应将` : `轮到 ${side}走棋`;
    }

    const GLYPH = {
      w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
      b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
    };
    const PIECE_CN = { k: '王', q: '后', r: '车', b: '象', n: '马', p: '兵' };

    // ============================================================
    // 共享开合状态（composer 按钮 ↔ overlay 悬浮窗）
    // ============================================================
    const openState = { open: false, listeners: new Set() };
    function setOpen(v) {
      openState.open = v;
      openState.listeners.forEach(fn => fn(v));
    }
    function useOpen() {
      const [open, set] = React.useState(openState.open);
      React.useEffect(() => {
        openState.listeners.add(set);
        return () => { openState.listeners.delete(set); };
      }, []);
      return [open, setOpen];
    }

    // ============================================================
    // 工具栏按钮（conversation.input.right）
    // ============================================================
    function ChessButton() {
      const [open, set] = useOpen();
      return h('button', {
        type: 'button',
        title: open ? '关闭象棋悬浮窗' : '打开象棋悬浮窗',
        onClick: () => set(!open),
        style: {
          border: 'none',
          background: 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          cursor: 'pointer',
          fontSize: '17px',
          lineHeight: 1,
          padding: '4px 6px',
          borderRadius: '6px',
        },
        onMouseEnter: e => { e.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'; },
        onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; },
      }, '♟');
    }

    // ============================================================
    // 悬浮窗（shell.overlay）：可拖动 + 完整游戏
    // ============================================================
    const WIN_W = 448;
    const CSS = `
.cfw-root { position: fixed; z-index: 60; width: ${WIN_W}px; max-width: calc(100vw - 24px);
  background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35); overflow: hidden;
  font-family: inherit; }
.cfw-titlebar { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--dsw-alias-bg-layer-1); border-bottom: 1px solid var(--dsw-alias-border-l1);
  cursor: move; user-select: none; touch-action: none; }
.cfw-titlebar .t { flex: 1; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.cfw-close { border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 6px; border-radius: 6px; }
.cfw-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.cfw-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.cfw-status { font-size: 13px; font-weight: 600; padding: 5px 10px; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  display: flex; align-items: center; gap: 8px; min-height: 30px; }
.cfw-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid var(--dsw-alias-border-l2); }
.cfw-board { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr);
  width: 100%; aspect-ratio: 1; border: 3px solid #6b4f35; border-radius: 4px;
  user-select: none; position: relative; }
.cfw-sq { position: relative; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: calc(${WIN_W}px / 13); line-height: 1; }
.cfw-sq.light { background: #f0d9b5; }
.cfw-sq.dark { background: #b58863; }
.cfw-sq.sel::after { content: ""; position: absolute; inset: 0; background: rgba(20,85,30,.45); }
.cfw-sq.last { box-shadow: inset 0 0 0 100px rgba(255,235,59,.35); }
.cfw-sq .cfw-piece { position: relative; z-index: 2; }
.cfw-piece.w { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.7), 0 0 1px #000; }
.cfw-piece.b { color: #1a1a1a; text-shadow: 0 1px 1px rgba(255,255,255,.35); }
.cfw-hint { position: absolute; z-index: 3; border-radius: 50%; width: 26%; height: 26%;
  background: rgba(0,0,0,.28); }
.cfw-hint.capture { width: 92%; height: 92%; background: none; border: 4px solid rgba(200,30,30,.55); }
.cfw-sq.checked { background: radial-gradient(circle, #d43a2f 25%, transparent 75%), #b58863; }
.cfw-sq .cfw-piece, .cfw-sq .cfw-hint, .cfw-sq .cfw-coord { pointer-events: none; }
.cfw-coord { position: absolute; font-size: 10px; opacity: .8; z-index: 1; }
.cfw-coord.file { bottom: 1px; right: 2px; }
.cfw-coord.rank { top: 1px; left: 2px; }
.cfw-sq.light .cfw-coord { color: #8a6b47; }
.cfw-sq.dark .cfw-coord { color: #f0d9b5; }
.cfw-controls { display: flex; gap: 8px; }
.cfw-btn { font-size: 13px; padding: 5px 14px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary); }
.cfw-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.cfw-moves { max-height: 92px; overflow-y: auto; background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px; padding: 6px 10px; font-size: 12px;
  color: var(--dsw-alias-label-primary); }
.cfw-moves .grid { display: grid; grid-template-columns: 2.4em 1fr 1fr; row-gap: 2px; }
.cfw-moves .no { color: var(--dsw-alias-label-tertiary); }
.cfw-promo { display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--dsw-alias-bg-layer-2); border-radius: 8px; font-size: 13px; }
.cfw-promo button { font-size: 26px; padding: 2px 8px; background: #f0d9b5;
  border: 1px solid #8a6b47; border-radius: 8px; cursor: pointer; line-height: 1; }
`;

    // PGN 导出：标准棋谱格式，可被 Lichess/chess.com 等直接导入
    function pgnResult(s) {
      if (!s.gameOver) return '*';
      if (s.resultText.includes('将杀')) return s.resultText.includes('白方胜') ? '1-0' : '0-1';
      return '1/2-1/2';
    }
    function buildPgn(s) {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
      const headers = [
        '[Event "DSH Chess 友谊对局"]',
        '[Site "DeepSeek Harness Web"]',
        `[Date "${date}"]`,
        `[Round "-"]`,
        '[White "白方"]',
        '[Black "黑方"]',
        `[Result "${pgnResult(s)}"]`,
      ];
      const sans = s.history.map(x => x.san || '');
      const lines = [];
      for (let i = 0; i < sans.length; i += 2) {
        lines.push(`${i / 2 + 1}. ${sans[i]} ${sans[i + 1] || ''}`.trim());
      }
      return headers.join('\n') + '\n\n' + lines.join(' ') + (sans.length ? ' ' : '') + pgnResult(s) + '\n';
    }
    function savePgn(s) {
      if (!s.history.length) return;
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      const name = `chess-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pgn`;
      const blob = new Blob([buildPgn(s)], { type: 'application/x-chess-pgn' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function ChessFloatWindow() {
      const [open, set] = useOpen();
      const [game, setGame] = React.useState(initialSetup);
      const [pos, setPos] = React.useState(() => ({
        x: Math.max(12, Math.round(window.innerWidth - WIN_W - 48)),
        y: Math.max(12, Math.round(window.innerHeight * 0.18)),
      }));
      const dragRef = React.useRef(null);

      const onPointerDown = (e) => {
        if (e.target.closest('.cfw-close')) return;
        dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        const x = Math.min(Math.max(0, e.clientX - d.dx), Math.max(0, window.innerWidth - 80));
        const y = Math.min(Math.max(0, e.clientY - d.dy), Math.max(0, window.innerHeight - 48));
        setPos({ x, y });
      };
      const onPointerUp = () => { dragRef.current = null; };

      if (!open) return null;

      const s = game;
      const checkKing = !s.gameOver && inCheck(s.board, s.turn) ? findKing(s.board, s.turn) : null;

      const squares = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const cls = ['cfw-sq', (r + c) % 2 === 0 ? 'light' : 'dark'];
        if (s.selected && s.selected.r === r && s.selected.c === c) cls.push('sel');
        if (s.lastMove && ((s.lastMove.from.r === r && s.lastMove.from.c === c) || (s.lastMove.to.r === r && s.lastMove.to.c === c))) cls.push('last');
        if (checkKing && checkKing.r === r && checkKing.c === c) cls.push('checked');
        const mv = s.legalForSelected.find(m => m.to.r === r && m.to.c === c);
        const p = s.board[r][c];
        squares.push(h('div', {
          key: r + '-' + c, className: cls.join(' '),
          style: { gridRow: r + 1, gridColumn: c + 1 },
          onClick: () => setGame(g => onSquareClick(g, r, c)),
        },
          mv ? h('span', { className: 'cfw-hint' + ((p || (mv.flags || []).includes('ep')) ? ' capture' : '') }) : null,
          p ? h('span', { className: 'cfw-piece ' + p.color }, GLYPH[p.color][p.type]) : null,
          c === 0 ? h('span', { className: 'cfw-coord rank' }, SIZE - r) : null,
          r === SIZE - 1 ? h('span', { className: 'cfw-coord file' }, FILES[c]) : null,
        ));
      }

      const moveRows = [];
      for (let i = 0; i < s.history.length; i += 2) {
        moveRows.push(h('div', { key: i, className: 'no' }, (i / 2 + 1) + '.'));
        moveRows.push(h('div', { key: i + 'w' }, s.history[i].san || ''));
        moveRows.push(h('div', { key: i + 'b' }, s.history[i + 1] ? s.history[i + 1].san : ''));
      }

      return h('div', { className: 'cfw-root', style: { left: pos.x + 'px', top: pos.y + 'px' } },
        h('style', null, CSS),
        h('div', {
          className: 'cfw-titlebar',
          onPointerDown, onPointerMove, onPointerUp,
        },
          h('span', { className: 't' }, '♟ 双人国际象棋（同屏对战）'),
          h('button', { type: 'button', className: 'cfw-close', title: '关闭', onClick: () => set(false) }, '✕'),
        ),
        h('div', { className: 'cfw-body' },
          h('div', { className: 'cfw-status' },
            s.gameOver ? s.resultText
              : h(React.Fragment, null,
                h('span', { className: 'cfw-dot', style: { background: s.turn === 'w' ? '#fff' : '#111' } }),
                statusText(s)),
          ),
          s.pendingPromo ? h('div', { className: 'cfw-promo' },
            h('span', null, '兵的升变 — 选择：'),
            ...['q', 'r', 'b', 'n'].map(pr => h('button', {
              key: pr, title: PIECE_CN[pr],
              onClick: () => setGame(g => choosePromotion(g, pr)),
            }, GLYPH[s.turn][pr])),
          ) : null,
          h('div', { className: 'cfw-board' }, squares),
          h('div', { className: 'cfw-controls' },
            h('button', { type: 'button', className: 'cfw-btn', onClick: () => setGame(undo) }, '↩ 悔棋'),
            h('button', { type: 'button', className: 'cfw-btn', onClick: () => setGame(initialSetup) }, '⊕ 新对局'),
            h('button', {
              type: 'button', className: 'cfw-btn',
              title: s.history.length ? '下载 PGN 棋谱文件' : '还没有着法可保存',
              disabled: !s.history.length,
              style: !s.history.length ? { opacity: 0.5, cursor: 'default' } : undefined,
              onClick: () => savePgn(game),
            }, '💾 保存棋谱'),
          ),
          s.history.length ? h('div', { className: 'cfw-moves' },
            h('div', { className: 'grid' }, moveRows),
          ) : null,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposers = [];
        disposers.push(ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right', id: 'chess-float-button', order: 90,
        }, ChessButton)));
        disposers.push(ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'chess-float-window', order: 90,
        }, ChessFloatWindow)));
        return () => disposers.forEach(d => { try { d(); } catch (_) {} });
      },
    };
  },
});
