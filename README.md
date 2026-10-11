# DSH Chess Game

国际象棋 × 两种形态：**单文件网页版**（双人同屏）+ **DeepSeek Harness Web 插件**（悬浮窗，双人/人机对战，PGN 导出）。零依赖、完全离线。

## 网页版（index.html）

两个人在同一台电脑上用鼠标轮流对战，浏览器打开 `index.html` 即玩。

- 白方先行，点一下自己的棋子（显示可走格圆点），再点一下目标格落子
- 红圈表示可吃子；被将军的王红圈高亮提示

## DSH 插件 dsh-chess-float（packages/chess-float/）

在 DeepSeek Harness Web 界面里下棋：输入框工具栏 **♟ 按钮** → 弹出**可拖动悬浮窗**。

**功能**：

- 双人对战 / 人机对战（可选执白或执黑）
- 人机 AI：本地 negamax + αβ 剪枝引擎，5 级难度（入门→大师，难度=搜索深度，低难度带随机失误），毫秒级响应、零模型调用、完全离线
- 完整规则：王车易位、吃过路兵、兵升变、将杀、逼和、50 回合规则、子力不足和棋
- 悔棋（人机模式自动回退双方各一步）、SAN 标准记谱、**PGN 棋谱导出**（可导入 Lichess / chess.com 复盘）
- 主题 token 适配明暗主题

**安装**：

```bash
# 从源码（本仓库）
dsh plugin add packages/chess-float

# 离线安装（其他机器）
mkdir -p ~/plugins/chess-float
tar -xzf dsh-chess-float-1.2.0.tgz -C ~/plugins/chess-float --strip-components=1
dsh plugin add ~/plugins/chess-float
```

预构建 tarball 见 [Releases](https://github.com/x-cores/dsh-chess-game/releases)。安装后刷新 Web 页面即可看到 ♟ 按钮。

## 正确性验证

走法引擎通过标准 perft 校验（走法枚举数与国际象棋公认参考值完全一致）：

| 测试局面 | 深度 | 结果 |
|---|---|---|
| 初始局面 | 1–4 层 | 20 / 400 / 8,902 / 197,281 ✓ |
| CPW #3（吃过路兵密集） | 1–5 层 | 14 / 191 / 2,812 / 43,238 / 674,624 ✓ |
| CPW #4（易位/升变密集） | 1–4 层 | 6 / 264 / 9,467 / 422,333 ✓ |

AI 引擎验证：深度 3 对随机对手 71 步将杀（约 44ms/步）；大师(5) 单步约 1.2s。

## 运行测试

```bash
node test-perft.js      # perft 规则校验
node test-gameplay.js   # 完整对局路径模拟（易位/过路兵/升变/SAN）
```
