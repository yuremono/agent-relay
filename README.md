# Agent Relay System

Cursor/VS Code 内で完結する、複数の Claude Code セッションが YAML ファイルを介して連携するシステム。

---

## クイックスタート

### 1. インストール

```bash
npm install -g https://github.com/yuremono/agent-relay.git
```

### 2. プロジェクトで初期化

Cursor/VS Code でプロジェクトディレクトリを開き、ターミナルで実行：

```bash
relay-init
```

### 3. Extension をインストール

生成された VSIX ファイルをインストール：

```bash
code --install-extension terminal-relay-0.0.1.vsix
```

または Cursor で：
- `Cmd+Shift+P` → `Extensions: Install from VSIX...`
- `terminal-relay-0.0.1.vsix` を選択

### 4. VS Code/Cursor を再読み込み

`Cmd+Shift+P` → `Developer: Reload Window`

### 5. 動作確認

```bash
curl http://localhost:3773
# => "Terminal Relay is running..." と表示されればOK
```

### 6. システム起動

```bash
relay-start
```

---

## 前提条件

| ソフトウェア | 確認コマンド | インストール方法 |
|-------------|-------------|-----------------|
| Node.js (v18以上) | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm | `npm --version` | Node.jsに同梱 |
| fswatch (macOS) | `which fswatch` | `brew install fswatch` |
| VS Code または Cursor | - | 公式サイトからダウンロード |
| Claude Code CLI | `claude --version` | [claude.ai](https://claude.ai/) |

---

## 使用方法

### 初期化（対話モード）

```bash
relay-init
```

ターミナル数を選択：
- 2: Leader + 1 Member
- 3: Leader + 2 Members（デフォルト）
- 4: Leader + 3 Members
- 5: Leader + 4 Members
- 6: Leader + 5 Members

### 初期化（非対話モード）

```bash
relay-init -y
```

### 生成されるファイル

```
project/
├── .relay-config.json         # 設定ファイル
├── terminal-relay-0.0.1.vsix  # Extension
├── relay/
│   ├── inbox/                 # 通知ファイル
│   ├── to/                    # タスク指示
│   ├── from/                  # 報告
│   ├── archive/               # アーカイブ
│   └── reports/               # 詳細報告
├── instructions/              # エージェント指示書
├── logs/                      # ログ
└── scripts/                   # 通信スクリプト
```

### Claude Code の起動

1. ターミナルを分割：`Cmd+\`（macOS）
2. 各ペインで Claude Code を起動：

```bash
claude --model sonnet  # Leader（コーディネーター）
claude --model haiku   # Member（実装作業用）
```

3. 各 Claude Code に指示書を読み込ませる：

```
instructions/leader.md を読んでください。あなたは Leader です。
```

---

## 役割構成

### Leader

- ユーザーからのリクエストを受け取る
- タスクを Member に割り当てる
- Member の成果を統合して報告
- **実作業は行わず、待機状態を保つ**

### Member

- Leader からタスクを受け取り実装
- テストを書いて実行
- 完了したら報告
- **ユーザーの指示が最優先**

---

## エージェント間の通信

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

## Extension API

| エンドポイント | 説明 |
|--------------|------|
| `GET /` | サーバー状態確認 |
| `GET /list` | ターミナル一覧を取得 |
| `GET /identify` | 各ターミナルにインデックスを表示 |
| `GET /notify?terminal=N&message=MSG` | ターミナルに通知 |
| `GET /send?terminal=N&text=TEXT` | ターミナルにテキスト送信 |

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

Cursor の場合、Developer: Reload Window で再読み込みしてください。

### `fswatch: command not found`

```bash
brew install fswatch
```

### メッセージが反映されない

1. `relay-start` が実行中か確認
2. `ps aux | grep fswatch` で監視プロセスを確認

---

## 開発者向け情報

### リポジトリをクローンして開発

```bash
git clone https://github.com/yuremono/agent-relay.git
cd agent-relay
npm install
npm link
```

### Extension の再ビルド

```bash
cd extension
npm install
npm run compile
npx vsce package --allow-missing-repository
```

---

## ライセンス

MIT
