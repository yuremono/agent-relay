# Agent Relay System

Cursor/VS Code 内で完結する、複数の Claude Code セッションが YAML ファイルを介して自律的に連携するシステム。

---

## 目次

1. [前提条件](#前提条件)
2. [インストール](#インストール)
3. [VS Code Extension のインストール](#vs-code-extension-のインストール)
4. [新規プロジェクトでの使用方法](#新規プロジェクトでの使用方法)
5. [システムの起動](#システムの起動)
6. [Claude Code の起動と設定](#claude-code-の起動と設定)
7. [エージェント間の通信方法](#エージェント間の通信方法)
8. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

以下がインストールされている必要があります：

| ソフトウェア | 確認コマンド | インストール方法 |
|-------------|-------------|-----------------|
| Node.js (v18以上) | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm | `npm --version` | Node.jsに同梱 |
| fswatch (macOS) | `which fswatch` | `brew install fswatch` |
| VS Code または Cursor | - | 公式サイトからダウンロード |
| Claude Code CLI | `claude --version` | [claude.ai](https://claude.ai/) |

### fswatch のインストール（macOS）

```bash
brew install fswatch
```

---

## インストール

### GitHub からインストール

```bash
# グローバルインストール
npm install -g https://github.com/yuremono/agent-relay.git
```

### または、リポジトリをクローンしてインストール

```bash
# リポジトリをクローン
git clone https://github.com/yuremono/agent-relay.git
cd agent-relay

# 依存関係をインストール
npm install

# グローバルコマンドとして登録
npm link
```

### 確認

```bash
relay-init --help
```

---

## VS Code Extension のインストール

このシステムには、ターミナル間の通信を補助する VS Code Extension が含まれています。

### インストール手順

1. プロジェクトディレクトリで初期化を実行：
   ```bash
   relay-init
   ```

2. 生成された VSIX ファイルをインストール：
   ```bash
   code --install-extension terminal-relay-0.0.1.vsix
   ```

   または VS Code/Cursor で：
   - `Cmd+Shift+P` → `Extensions: Install from VSIX...`
   - `terminal-relay-0.0.1.vsix` を選択

3. VS Code/Cursor を再読み込み：
   - `Cmd+Shift+P` → `Developer: Reload Window`

### 動作確認

```bash
curl http://localhost:3773
# => "Terminal Relay is running..." と表示されればOK
```

---

## 新規プロジェクトでの使用方法

### プロジェクト初期化

1. プロジェクト用のディレクトリを作成
2. Cursor/VS Code でそのディレクトリを開く（`File` → `Open Folder`）
3. ターミナルを開いて初期化を実行：

```bash
relay-init
```

### 対話モードのフロー

```
=== Configuration ===

Available configurations:
  2 terminals: Flat (Member_1 + Member_2)
  3 terminals: Leader + 2 Members
  4 terminals: Full hierarchy (Officer + Leader + 2 Members)
  5 terminals: Officer + Leader + 3 Members
  6 terminals: Officer + Leader + 4 Members

Number of terminals [2-6] (default: 3): _
```

### 非対話モード

```bash
relay-init -y
```

### 生成されるファイル

```
my-project/
├── .relay-config.json      # 設定ファイル
├── terminal-relay-0.0.1.vsix  # Extension
├── relay/
│   ├── inbox/              # 通知ファイル
│   ├── to/                 # タスク指示
│   ├── from/               # 報告
│   ├── archive/            # アーカイブ
│   └── reports/            # 詳細報告
├── instructions/           # エージェント指示書
├── logs/                   # ログ
└── scripts/                # 通信スクリプト
```

---

## システムの起動

```bash
relay-start
```

### 停止方法

- `Ctrl+C`
- または `pkill -f fswatch`

---

## Claude Code の起動と設定

### ターミナルを分割

- `Cmd+\`（macOS）または `Ctrl+\`（Windows）
- または `Terminal` → `Split Terminal`

### Claude Code を起動

各ペインで対応する役割の Claude Code を起動：

```bash
# 役割に応じてモデルを選択
claude --model opus    # Officer, Leader（複雑な判断用）
claude --model sonnet  # Member（実装作業用）
```

### 指示書を読み込ませる

各 Claude Code に：

```
instructions/member_1.md を読んでください。あなたは member_1 です。
```

---

## エージェント間の通信方法

### タスクを送る

```bash
./scripts/to_write.sh relay/to/<role>.yaml <from> "メッセージ" task
./scripts/inbox_write.sh relay/inbox/<role>.yaml <from> new_task relay/to/<role>.yaml "通知"
```

### 報告を送る

```bash
./scripts/from_write.sh relay/from/<role>.yaml <status> "報告内容"
./scripts/inbox_write.sh relay/inbox/<role>.yaml <from> report relay/from/<role>.yaml "完了"
```

### 未処理メッセージを確認

```bash
./scripts/check_pending.sh relay/to/<role>.yaml
```

### 処理済みにする

```bash
./scripts/mark_done.sh relay/to/<role>.yaml <seq>
```

---

## トラブルシューティング

### `relay-init: command not found`

```bash
npm install -g https://github.com/yuremono/agent-relay.git
```

### `Extension server not responding on port 3773`

Extension がインストールされていないか、起動していません。

```bash
code --install-extension terminal-relay-0.0.1.vsix
```

### `fswatch: command not found`

```bash
brew install fswatch
```

### メッセージが反映されない

1. `relay-start` が実行中か確認
2. `ps aux | grep fswatch` で監視プロセスを確認
3. `cat logs/watcher.log` でログを確認

---

## 開発者向け情報

### Extension の再ビルド

```bash
cd extension
npm install
npm run compile
npx vsce package --allow-missing-repository
```

### テスト実行

```bash
node bin/init.js --dry-run --non-interactive
```

---

## ライセンス

MIT
