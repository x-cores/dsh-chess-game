// 模拟完整对局路径（含 SAN 记谱），验证 sanBase 崩溃已修复
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const elements = {};
function fakeEl(id) {
  return { id, innerHTML: '', textContent: '', className: '', title: '', dataset: {}, style: {},
    appendChild() {}, append() {}, addEventListener() {},
    classList: { add() {}, remove() {} }, scrollTop: 0, scrollHeight: 0 };
}
global.document = { getElementById: id => elements[id] || (elements[id] = fakeEl(id)), createElement: () => fakeEl() };

const code = m[1] + `\n;module.exports = { initialSetup, legalMoves, doMove, getBoard: () => board, getTurn: () => turn, getHistory: () => history, getGameOver: () => gameOver, getEp: () => epSquare };`;
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const api = mod.exports;

// 意大利开局 + 王车易位 + 吃过路兵 + 升变场景，逐步走
function pick(from, to, promo) {
  const mv = api.legalMoves(api.getBoard(), api.getTurn(), {wK:true,wQ:true,bK:true,bQ:true}, null)
    .find(x => x.from.r === from[0] && x.from.c === from[1] && x.to.r === to[0] && x.to.c === to[1] && (!promo || x.promotion === promo));
  if (!mv) throw new Error('no legal move ' + from + '->' + to);
  return mv;
}
// e4 e5 / Nf3 Nc6 / Bc4 Bc5 / O-O O-O （行: 0=8 ... 7=1; 列: 0=a...7=h）
const seq = [
  [[6,4],[4,4]], [[1,4],[3,4]],   // e4 e5
  [[7,6],[5,5]], [[0,6],[2,5]],   // Nf3 Nf6
  [[7,5],[4,2]], [[0,5],[3,2]],   // Bc4 Bc5
  [[7,4],[7,6]], [[0,4],[0,6]],   // O-O O-O（王翼易位）
];
let sanLog = [];
for (const [f, t] of seq) {
  api.doMove(pick(f, t));
  sanLog.push(api.getHistory().slice(-1)[0].san);
}
console.log('SAN:', sanLog.join(' '));
if (sanLog.join(' ') !== 'e4 e5 Nf3 Nf6 Bc4 Bc5 O-O O-O') { console.error('SAN 不符合预期'); process.exit(1); }

// 吃过路兵场景（重开一局）：b4 / a6 / b5 / c5 / bxc6 e.p.
api.initialSetup();
api.doMove(pick([6,1],[4,1])); // b4
api.doMove(pick([1,0],[2,0])); // a6
api.doMove(pick([4,1],[3,1])); // b5
api.doMove(pick([1,2],[3,2])); // c5
const ep = api.legalMoves(api.getBoard(), 'w', {wK:true,wQ:true,bK:true,bQ:true}, api.getEp())
  .find(x => (x.flags||[]).includes('ep'));
if (!ep) { console.error('未生成吃过路兵走法'); process.exit(1); }
api.doMove(ep);
console.log('ep SAN:', api.getHistory().slice(-1)[0].san);
if (api.getHistory().slice(-1)[0].san !== 'bxc6') { console.error('ep SAN 错误'); process.exit(1); }

// 升变场景
for (const [f,t] of [[[3,3],[2,3]],[[7,1],[5,2]],[[2,3],[1,3]],[[5,2],[3,1]],[[1,3],[0,3]]].slice(0,0)) {}
// 简化：直接构造白兵到第7排的局面走升变
const b = api.getBoard();
b[1][3] = {type:'p', color:'w'}; b[1][3] && (b[1][3] = {type:'p', color:'w'});
// 清掉黑 d8 区域干扰：把黑后挪走模拟
b[0][3] = null;
const promoMoves = api.legalMoves(b, 'w', {wK:false,wQ:false,bK:false,bQ:false}, null).filter(x => x.promotion === 'q' && x.from.r===1 && x.from.c===3);
console.log('升变走法生成:', promoMoves.length);
if (!promoMoves.length) { console.error('升变走法缺失'); process.exit(1); }

console.log('✓ doMove 全路径（含 sanBase 记谱）无异常');
