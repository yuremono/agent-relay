# Agent-Relay

Cursor/VS Code 内で完結する、複数の Claude Code /  Cursor CLI セッションが YAML ファイルを介して連携するシステム。

※ Cursor CLI に対応していますが、以下 Claude Code に統一させていただきます。

## 特徴

- **ターミナル間通信**: YAML ファイルベースのメッセージキューでターミナル同士が連携
- **自動通知**: `fswatch` によるファイル監視で、通知を自動的に各ターミナルに送信
- **柔軟な役割設定**: Leader あり/なし構成を選択可能
- **アーカイブ機能**: 完了したタスクを自動的にアーカイブ

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

### Linux について

本システムは macOS を前提としています（`fswatch` 使用）。Linux では `inotifywait` などの代替ツールで動作可能ですが、スクリプトの修正が必要です。

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

※Tarminal IndexはOSまたはアプリ毎に自動付与されます。(番号を変えることができません)

Claude Codeを先に起動することで

Terminal Index: 0,Terminal Index: 1,Terminal Index: 3,のように並び順通りの番号が付きます。

`Open New External Terminal` , `ターミナル：エディター領域で新しいターミナルを作成` がオススメです。

```bash
relay-init
```

#### relay-init のオプション

| オプション | 説明 |
|-----------|------|
| `--dry-run` | 変更を適用せずに表示のみ |
| `--force` | 既存ファイルを上書き |
| `--non-interactive` | デフォルト設定で自動実行 |
| `--help` | ヘルプを表示 |

設定項目：
- Pane 0 を leader にするかどうか（Y/n）

Terminal Index: 0 に対する初回メッセージに反映されます。

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

### ペイン数の上限

デフォルトで **Leader + Member 0〜5** の通信用ファイルが用意されています。

6ペイン以上に拡張する場合は、`relay/` 配下の通信用ファイルを追加してください：

```bash
# member_6 を追加する場合
cp relay/inbox/member_5.yaml relay/inbox/member_6.yaml
cp relay/to/member_5.yaml relay/to/member_6.yaml
cp relay/from/member_5.yaml relay/from/member_6.yaml
```

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
├── CLAUDE_SAMPLE.md           # プロジェクト用 CLAUDE.md のサンプル
├── AGENTS.md                  # エージェント用プロジェクトルール
├── relay/
│   ├── inbox/                 # 通知ファイル (leader, member_0-5)
│   ├── to/                    # タスク指示
│   ├── from/                  # 報告
│   ├── archive/               # 完了タスクのアーカイブ
│   └── reports/               # 定期レポート（将来の拡張用）
├── instructions/              # エージェント指示書 (leader.md, member.md)
├── logs/                      # ログ (watcher.log)
└── scripts/                   # 通信スクリプト
```

### .relay-config.json

プロジェクトの設定ファイルです：

```json
{
  "firstPaneIsLeader": true,
  "createdAt": "2026-02-23T12:00:00.000Z"
}
```

### アーカイブ機能

`relay/archive/` には、完了したタスクが自動的にアーカイブされます：

- ファイルが 600 行を超えると自動的にアーカイブ実行
- `status: "done"` のメッセージがアーカイブ対象
- 月別ディレクトリ（`YYYYMM`）に保存

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
2. 1.5秒待機
3. Enter を送信

この2回送信アプローチにより、Claude Code がメッセージを確実に認識できるようになります。

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
