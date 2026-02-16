# Agent-Relay

Cursor/VS Code 内で完結する、複数の Claude Code セッションが YAML ファイルを介して連携するシステム。

---

## 参考文献

  本プロジェクトの構想は以下に触発されました：

  - **[multi-agent-shogun](https://github.com/yohey-w/multi-agent-shogun)** -
  tmuxベースのマルチエージェント並列開発プラットフォーム。YAMLファイルによる通信
  や階層構成などのアーキテクチャを参考にしました。
  - [Claude Code 公式ドキュメント - Agent  Teams](https://code.claude.com/docs/en/agent-teams)

---

## 前提条件

| ソフトウェア | 確認コマンド | インストール方法 |
|-------------|-------------|-----------------|
| Node.js (v18以上) | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm | `npm --version` | Node.jsに同梱 |
| fswatch (macOS) | `which fswatch` | `brew install fswatch` |
| VS Code または Cursor | - | 公式サイトからダウンロード |
| Claude Code CLI | `claude --version` | [claude.ai](https://claude.ai/) |

### 一括インストール（macOS）

```bash
# Homebrew で Node.js と fswatch をインストール
brew install node fswatch

# Claude Code CLI をインストール
# https://claude.ai/ からダウンロード
```

---

## クイックスタート

### 1. インストール

```bash
npm install -g https://github.com/yuremono/agent-relay.git
```

### 2. ターミナルを分割

VS Code/Cursor でプロジェクトディレクトリを開き、ターミナルを分割：

- **VS Code/Cursor**: `Cmd+\`（複数回）または `Terminal > Split Terminal`

### 3. 各ペインで Claude Code を起動

```bash
claude
```

### 4. プロジェクトを初期化

Claude Code を使用しない別のターミナルで実行：
※Tarminal IndexはOSレベルで自動付与されます。Claude Codeを先に起動することで
Terminal Index: 0,Terminal Index: 1,Terminal Index: 3,のように並び順通りの番号が付きます。

```bash
relay-init
```

設定項目：
- Pane 0 を leader にするかどうか（Y/n）

※ ペイン数は自動検出されます。途中でターミナルを追加しても `relay-start` を再実行すれば自動的に反映されます。

### 5. Extension をインストール

生成された VSIX ファイルをインストール：

```bash
# VS Code の場合
code --install-extension terminal-relay-0.0.1.vsix

# Cursor の場合
cursor --install-extension terminal-relay-0.0.1.vsix
```

または Extensions パネルで：
- `Cmd+Shift+P` → `Extensions: Install from VSIX...`
- `terminal-relay-0.0.1.vsix` を選択

### 6. VS Code/Cursor を再読み込み

`Cmd+Shift+P` → `Developer: Reload Window`

### 7. システム起動

```bash
relay-start
```

各ペインにターミナルインデックスと役割が表示されます。

```
Terminal Index: 0 | Your role: leader. instructions/leader.md               
  を読んでください。                             
```

### 8. 各 Claude Code に指示

```
Terminal Index: 0 | Your role: leader. instructions/leader.md 
  を読んでください。
  [この下に続けて指示を出せます]                             
```

---

## 役割構成

### firstPaneIsLeader = true（デフォルト）

| Pane | Role |
|------|------|
| 0 | leader |
| 1 | member_1 |
| 2 | member_2 |
| ... | ... |

### firstPaneIsLeader = false

| Pane | Role |
|------|------|
| 0 | member_1 |
| 1 | member_2 |
| 2 | member_3 |
| ... | ... |

### Leader (思考・タスク分配担当)

- ユーザーからのリクエストを受け取る
- タスクを分割して実行担当に割り当てる
- 成果を統合して報告
- **実作業は行わず、待機状態を保つ**

### Member (タスク実行担当)

- タスクを受け取り実装
- テストを書いて実行
- 完了したら報告
- **ユーザーの指示が最優先**

---

## 生成されるファイル

```
project/
├── .relay-config.json         # 設定ファイル (firstPaneIsLeader のみ)
├── terminal-relay-0.0.1.vsix  # Extension
├── relay/
│   ├── inbox/                 # 通知ファイル (leader, member_1-5)
│   ├── to/                    # タスク指示
│   ├── from/                  # 報告
│   ├── archive/               # アーカイブ
│   └── reports/               # 詳細報告
├── instructions/              # エージェント指示書 (leader.md, member.md)
├── logs/                      # ログ
└── scripts/                   # 通信スクリプト
```

---

## ペイン間の通信

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
| `GET /chat?terminal=N&text=TEXT` | チャット形式で送信（テキスト → 1秒待機 → Enter） |

### `/chat` エンドポイント（重要）

Claude Code のチャットウィンドウに人間が入力したかのようにメッセージを送信します：

1. テキストを入力（Enter なし）
2. 1秒待機
3. Enter を送信

この2回送信アプローチにより、Claude Code がメッセージを認識できるようになります。

---

## セキュリティ注意書き

本システムの VS Code Extension は、ローカル開発環境での使用を想定しています：

- HTTP サーバーは `localhost`（ポート 3773）でのみリッスンします
- 認証機能はありません
- ネットワークに公開しないでください

---

## トラブルシューティング

### `relay-init: command not found`

```bash
npm install -g https://github.com/yuremono/agent-relay.git
```

### `Extension server not responding on port 3773`

Extension がインストールされていないか、起動していません。

```bash
# VS Code
code --install-extension terminal-relay-0.0.1.vsix

# Cursor
cursor --install-extension terminal-relay-0.0.1.vsix
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
