// 从 index.html 提取棋规脚本，stub DOM，跑 perft 校验
// 覆盖：初始局面 + CPW 3 号（吃过路兵密集）+ CPW 4 号（易位/升变密集）
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no script'); process.exit(1); }

const elements = {};
function fakeEl(id) {
  return { id, innerHTML: '', textContent: '', className: '', title: '', dataset: {}, style: {},
    appendChild() {}, append() {}, addEventListener() {},
    classList: { add() {}, remove() {} }, scrollTop: 0, scrollHeight: 0 };
}
global.document = {
  getElementById(id) { return elements[id] || (elements[id] = fakeEl(id)); },
  createElement: () => fakeEl(),
};

const code = m[1] + `\n;module.exports = {
  legalMoves: (b,c,cr,ep) => legalMoves(b,c,cr,ep),
  applyMove: (b,mv,c) => applyMove(b,mv,c),
  setBoard: (b,c,cr,ep) => { board = b; turn = c; castling = cr; epSquare = ep; },
};`;
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const api = mod.exports;

function perft(b, color, cr, ep, depth) {
  const moves = api.legalMoves(b, color, cr, ep);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const mv of moves) {
    const nb = api.applyMove(b, mv, color);
    const ncr = { ...cr };
    const hr = color === 'w' ? 7 : 0;
    if (mv.piece === 'k') { if (color==='w') { ncr.wK = ncr.wQ = false; } else { ncr.bK = ncr.bQ = false; } }
    if (mv.piece === 'r' && mv.from.r === hr) {
      if (mv.from.c === 0) (color==='w'?ncr.wQ=false:ncr.bQ=false);
      if (mv.from.c === 7) (color==='w'?ncr.wK=false:ncr.bK=false);
    }
    const oppHr = color === 'w' ? 0 : 7;
    if (mv.to.r === oppHr) {
      if (mv.to.c === 0) (color==='w'?ncr.bQ=false:ncr.wQ=false);
      if (mv.to.c === 7) (color==='w'?ncr.bK=false:ncr.wK=false);
    }
    const nep = (mv.flags || []).includes('double') ? {r:(mv.from.r+mv.to.r)/2, c:mv.from.c} : null;
    nodes += perft(nb, color==='w'?'b':'w', ncr, nep, depth - 1);
  }
  return nodes;
}

// 简易 FEN 解析（只用前 4 段：棋盘、行棋方、易位权、过路兵格）
function loadFen(fen) {
  const [pos, side, castle, ep] = fen.split(' ');
  const b = Array.from({length: 8}, () => Array(8).fill(null));
  let r = 0, c = 0;
  for (const ch of pos) {
    if (ch === '/') { r++; c = 0; continue; }
    if (/\d/.test(ch)) { c += +ch; continue; }
    b[r][c++] = {type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b'};
  }
  const cr = {wK: castle.includes('K'), wQ: castle.includes('Q'), bK: castle.includes('k'), bQ: castle.includes('q')};
  let epSq = null;
  if (ep && ep !== '-') epSq = {r: 8 - +ep[1], c: 'abcdefgh'.indexOf(ep[0])};
  return {b, color: side === 'w' ? 'w' : 'b', cr, ep: epSq};
}

const suites = [
  {
    name: '初始局面',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depths: [20, 400, 8902, 197281],
  },
  {
    name: 'CPW#3 过路兵密集',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depths: [14, 191, 2812, 43238, 674624],
  },
  {
    name: 'CPW#4 易位/升变密集',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depths: [6, 264, 9467, 422333],
  },
];

let ok = true;
for (const s of suites) {
  console.log(`--- ${s.name}`);
  for (let d = 1; d <= s.depths.length; d++) {
    const st = loadFen(s.fen);
    const n = perft(st.b, st.color, st.cr, st.ep, d);
    const pass = n === s.depths[d-1];
    ok = ok && pass;
    console.log(`perft(${d}) = ${n}  期望 ${s.depths[d-1]}  ${pass ? '✓' : '✗'}`);
    if (!pass) break;
  }
}
process.exit(ok ? 0 : 1);
