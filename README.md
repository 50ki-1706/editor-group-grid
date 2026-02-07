# Editor Group Grid

VSCodeの2x2グリッドレイアウトでエディターグループを制御するための拡張機能。

## Dependencies

- pnpm@10.28.2
- node@25.6.0

## 機能

| ショートカット | 動作                             |
| -------------- | -------------------------------- |
| `Ctrl+1`       | 左上にフォーカス                 |
| `Ctrl+2`       | 左下にフォーカス（なければ作成） |
| `Ctrl+3`       | 右上にフォーカス（なければ作成） |
| `Ctrl+4`       | 右下にフォーカス（なければ作成） |

## グリッドレイアウト

```
[Ctrl+1: 左上] [Ctrl+3: 右上]
[Ctrl+2: 左下] [Ctrl+4: 右下]
```

## インストール

```bash
# ビルド
pnpm install
pnpm run compile

# VSCode拡張機能ディレクトリにシンボリックリンク作成
ln -s /path/to/editor-group-grid ~/.vscode/extensions/editor-group-grid
# Antigravity
ln -s /path/to/editor-group-grid ~/.Antigravity/extensions/editor-group-grid

# エディタを再起動
```

## 開発

```bash
# 監視モードでコンパイル
pnpm run watch
```

## ファイル構成

```
editor-group-grid/
├── package.json      # 拡張機能マニフェスト
├── pnpm-lock.yaml    # pnpmロックファイル
├── mise.toml         # mise設定（Node.js/pnpmバージョン管理）
├── tsconfig.json     # TypeScript設定
├── src/
│   └── extension.ts  # メインロジック
└── out/              # コンパイル済みJS
```

## 注意事項

- `keybindings.json` の既存のCtrl+1〜4設定と競合する場合は、既存設定を削除してください
- グループが存在しない位置へのフォーカスは、自動的にグループを作成します
