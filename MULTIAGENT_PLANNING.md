# マルチエージェントシステム 開発計画書

**作成日**: 2026年2月15日  
**最終更新**: 2026年2月15日  
**目的**: Cursor/VS Code 内で完結する、複数の Claude Code セッションが YAML ファイルを介して自律的に連携するシステムの構築

---

## 📋 プロジェクト概要

### コンセプト
- **tmux 不要**: VS Code/Cursor の標準ターミナル機能のみ使用
- **ポーリング不要**: fswatch + VS Code Extension によるイベント駆動
- **API コスト ゼロ**: エージェント間通信に API を使用しない
- **軽量 Extension**: フォーカス変更とテキスト送信のみを担当する最小限の Extension

### エージェント階層

```
User (ユーザー/人間)
    ↓
Officer (窓口・統合)
    ↓
Leader (分析・分担)
    ↓
Member (実装・実行) × 複数
```

| 役割 | 略称 | 主要責務 | 通信経路 |
|------|------|----------|----------|
| Officer | O | ユーザー窓口、最終統合 | User ↔ O ↔ L / M → O |
| Leader | L | タスク分解と分担、技術相談 | O ↔ L ↔ M |
| Member | M | 実装・テスト実行 | L ↔ M / M → O |

---

## 🏗️ システムアーキテクチャ

### 通信メカニズム（マルチエージェント将軍方式を参考）

**将軍プロジェクトの設計思想を採用**: inbox（通知）+ to/from（内容）の分離、各エージェントは自分専用ファイルにのみ書き込む

```
【上位 → 下位】Officer → Leader:
1. Officer が relay/to/leader.yaml に詳細を書き込む（Officer専用）
2. Officer が relay/inbox/leader.yaml に通知を追記 (inbox_write.sh 使用)
3. fswatch が inbox/leader.yaml の変更を検知
4. notify_leader.sh が実行される
    ↓
VS Code/Cursor がバックグラウンドか確認
    ↓
バックグラウンドの場合のみ:
  - 通知音を再生 (macOS の標準サウンド)
  - VS Code/Cursor をアクティブ化 (AppleScript)
    ↓
curl で Extension の HTTP サーバーにリクエスト (http://localhost:3773/chat?terminal=1&text=...)
    ↓
Extension が Leader のペイン(インデックス1)にフォーカスを変更
    ↓
Extension がテキストを送信 ("relay/inbox/leader.yaml を確認してください")
    ↓
Leader が inbox を確認し、relay/to/leader.yaml を読む
    ↓
Leader が起動して作業開始

【下位 → 上位】Member → Leader:
1. Member が relay/from/member_1.yaml に詳細を書き込む（Member_1専用）
2. Member が relay/inbox/leader.yaml に通知を追記 (inbox_write.sh)
3. fswatch が検知 → Leader が通知を受け取り、from/member_1.yaml を読む
```

**重要**:
- **inbox**: 通知専用（追記方式 + flock でコンフリクト防止）
- **to/**: 上位 → 下位の連絡内容（各送信者が異なるファイルに書き込む）
- **from/**: 下位 → 上位の連絡内容（各送信者が自分専用ファイルに書き込む）
- **reports**: 詳細報告（タイムスタンプ付、各Memberが自分専用ファイルに書き込む）
- ファイル監視は fswatch (macOS/Linux)
- VS Code がバックグラウンドの場合、自動的にアクティブ化 (macOS: AppleScript)
- フォーカス切り替え時のみ通知音を再生 (ユーザーの作業を邪魔しない)
- 通知は軽量 VS Code Extension の HTTP サーバー経由
- Extension はフォーカス変更とテキスト送信のみを担当(50行程度)
- ポーリングは一切行わない

---

## 📁 ディレクトリ構造

```
mcp-multiagent/
├── package.json              # npm scripts & dependencies
├── README.md                 # ユーザー向けドキュメント
├── PLANNING.md               # この計画書
│
├── extension/                # VS Code/Cursor Extension
│   ├── package.json          # Extension の設定
│   ├── tsconfig.json         # TypeScript 設定
│   ├── src/
│   │   └── extension.ts      # メインロジック (50行程度)
│   └── README.md
│
├── bin/
│   ├── init.js               # プロジェクト初期化スクリプト
│   └── startup.sh            # システム起動スクリプト (npm start から呼ばれる)
│
├── scripts/
│   ├── inbox_write.sh        # inbox への追記スクリプト (共通)
│   ├── notify_officer.sh     # Officer への通知 (curl)
│   ├── notify_leader.sh      # Leader への通知 (curl)
│   └── notify_member.sh      # Member への通知 (curl)
│
├── templates/                # 初期化時に展開されるテンプレート (bin/init.js が使用)
│   ├── relay/                # 通信関連ファイル
│   │   ├── inbox/            # 通知専用（追記方式）
│   │   │   ├── officer.yaml
│   │   │   ├── leader.yaml
│   │   │   └── member_1.yaml
│   │   ├── to/               # 上位 → 下位（各送信者が異なるファイルに書く）
│   │   │   ├── leader.yaml   # Officer が書く
│   │   │   ├── member_1.yaml # Leader が書く
│   │   │   └── member_2.yaml # Leader が書く
│   │   ├── from/             # 下位 → 上位（各送信者が自分専用ファイルに書く）
│   │   │   ├── officer.yaml  # Officer が書く（Member宛）
│   │   │   ├── leader.yaml   # Leader が書く（Officer宛）
│   │   │   ├── member_1.yaml # Member_1 が書く
│   │   │   └── member_2.yaml # Member_2 が書く
│   │   └── reports/          # 詳細報告
│   │       └── .gitkeep
│   └── instructions/
│          ├── officer.md
│          ├── leader.md
│          └── member.md
│
└── (ユーザープロジェクトに生成される)
    ├── relay/                # 通信関連ファイル
    │   ├── inbox/            # 通知専用（追記方式、flockで保護）
    │   │   ├── officer.yaml  # Leader, Member が追記
    │   │   ├── leader.yaml   # Officer, Member が追記
    │   │   ├── member_1.yaml # Officer, Leader が追記
    │   │   └── member_2.yaml # Officer, Leader が追記
    │   ├── to/               # 上位 → 下位（1対1、送信者別）
    │   │   ├── leader.yaml   # Officer だけが書く
    │   │   ├── member_1.yaml # Leader だけが書く
    │   │   └── member_2.yaml # Leader だけが書く
    │   ├── from/             # 下位 → 上位（送信者別）
    │   │   ├── leader.yaml   # Leader だけが書く
    │   │   ├── member_1.yaml # Member_1 だけが書く
    │   │   └── member_2.yaml # Member_2 だけが書く
    │   ├── reports/          # 詳細報告（タイムスタンプ付）
    │   │   ├── member_1_20260215_103045.yaml
    │   │   └── member_2_20260215_103045.yaml
    │   └── history/          # アーカイブ (将来実装)
    │       └── task_001.yaml
    ├── instructions/         # 各エージェントの役割定義 (ユーザーが編集可能)
    │   ├── officer.md
    │   ├── leader.md
    │   └── member.md
    └── CLAUDE.md             # 起動時の自動読み込み用
```

### 通信パターンとファイル構成

**コンフリクト回避の原則**: 各エージェントは自分専用のファイルにのみ書き込む

| 方向 | 送信元 | 送信先 | inbox | 内容ファイル | 書き込み者 |
|------|--------|--------|-------|-------------|------------|
| 上位→下位 | Officer | Leader | `inbox/leader.yaml` | `to/leader.yaml` | Officerのみ |
| 上位→下位 | Officer | Member_1 | `inbox/member_1.yaml` | `to/member_1.yaml` | Officerのみ |
| 上位→下位 | Leader | Member_1 | `inbox/member_1.yaml` | `to/member_1.yaml` | Leaderのみ |
| 上位→下位 | Leader | Member_2 | `inbox/member_2.yaml` | `to/member_2.yaml` | Leaderのみ |
| 下位→上位 | Leader | Officer | `inbox/officer.yaml` | `from/leader.yaml` | Leaderのみ |
| 下位→上位 | Member_1 | Leader | `inbox/leader.yaml` | `from/member_1.yaml` | Member_1のみ |
| 下位→上位 | Member_2 | Leader | `inbox/leader.yaml` | `from/member_2.yaml` | Member_2のみ |

**ポイント**:
- **inbox**: 受信者が監視するファイル（追記のみ、flockで保護）
- **to/**: 上位 → 下位の連絡内容（送信者別、上書きOK）
- **from/**: 下位 → 上位の連絡内容（送信者別、上書きOK）
- **reports**: 詳細報告（タイムスタンプ付、各Member専用）

---

## 📝 YAML スキーマ

### 1. inbox ファイル（通知専用）

```yaml
# relay/inbox/leader.yaml
messages:
  - timestamp: "2026-02-15T10:00:00Z"
    from: "officer"
    type: "new_task"
    file: "relay/to/leader.yaml"
    message: "新しいタスク指示あり。確認されたし。"

  - timestamp: "2026-02-15T10:05:00Z"
    from: "member_1"
    type: "report_received"
    file: "relay/from/member_1.yaml"
    message: "任務完了。報告書確認されたし。"
```

**ポイント**:
- inbox は**通知のリスト**（追記のみ、flockで保護）
- 実際の内容は `file` で指定されたファイルにある
- 追記方式なので複数の送信者が書き込んでもコンフリクトしない

### 2. to/ ファイル（上位 → 下位）

```yaml
# relay/to/leader.yaml（Officerだけが書き込む）
task_id: "task_001"
from: "officer"
to: "leader"
status: "pending"
timestamp: "2026-02-15T10:30:00Z"

message: |
  ## タスク指示

  React でログイン画面を作成してください。

  ### 要件
  - メールアドレスとパスワードによる認証
  - エラーハンドリング
  - レスポンシブ対応
```

### 3. from/ ファイル（下位 → 上位）

```yaml
# relay/from/member_1.yaml（Member_1だけが書き込む）
task_id: "task_001"
from: "member_1"
to: "leader"
status: "completed"
timestamp: "2026-02-15T10:30:45Z"

message: |
  ## 完了報告

  実装が完了しました。詳細は reports/ をご覧ください。
```

### 4. reports ファイル（詳細報告・タイムスタンプ付）

```yaml
# relay/reports/member_1_20260215_103045.yaml
task_id: "task_001"
worker_id: "member_1"
timestamp: "2026-02-15T10:30:45Z"
status: done  # done | failed | blocked

result:
  summary: "ログイン機能の実装完了"
  files_modified:
    - "src/auth/login.tsx"
  notes: "テストカバレッジ 85%達成"
```

**重要**:
- Member は個別の報告ファイルを作成することで、複数の Member が同時に報告してもファイル競合が発生しない
- 報告後、Member は `inbox/leader.yaml` に通知を追記する

### ファイル例まとめ

#### to/member_1.yaml（Leader → Member_1）
```yaml
# relay/to/member_1.yaml（Leaderだけが書き込む）
task_id: "task_001"
from: "leader"
to: "member_1"
status: "assigned"
timestamp: "2026-02-15T11:00:00Z"

message: |
  ## 実装タスク

  ログイン画面のUI実装をお願いします。
```

#### from/leader.yaml（Leader → Officer）
```yaml
# relay/from/leader.yaml（Leaderだけが書き込む）
task_id: "task_001"
from: "leader"
to: "officer"
status: "in_progress"
timestamp: "2026-02-15T10:45:00Z"

message: |
  ## 進捗報告

  タスクを2人のMemberに割り当てました。
```

---

## 🚀 運用フロー

### 1. システム起動

```bash
# ユーザーのプロジェクトディレクトリで
cd ~/my-project

# Extension をインストール(初回のみ)
code --install-extension mcp-multiagent-extension.vsix

# システム起動
mcp-start

# 出力例:
# ✅ ファイル監視開始
# ✅ Extension の HTTP サーバー起動確認
# 
# 次のステップ: VS Code/Cursor で分割ターミナルを3つ作成してください
#   ペイン0 (Officer): claude --model opus
#   ペイン1 (Leader):  claude --model opus
#   ペイン2 (Member):  claude --model sonnet
```

### 2. ターミナルの準備

```
VS Code/Cursor のターミナルパネルで:
1. Cmd + \ を2回実行 (ターミナルを3分割)
2. 各ペインで Claude Code を起動
   - ペイン0 (左): claude --model opus    # Officer
   - ペイン1 (中): claude --model opus    # Leader
   - ペイン2 (右): claude --model sonnet  # Member
```

### 3. 各エージェントの初期化

**CLAUDE.md が自動読み込みされる** (将軍プロジェクト方式)

```markdown
# CLAUDE.md

## 起動手順
1. 自分がどのペインか確認 (左: Officer, 中: Leader, 右: Member)
2. 該当する instructions ファイルを読む:
   - Officer → instructions/officer.md
   - Leader → instructions/leader.md
   - Member → instructions/member.md
3. 役割を理解し、自分の inbox を監視する準備をする:
   - Officer → relay/inbox/officer.yaml
   - Leader → relay/inbox/leader.yaml
   - Member → relay/inbox/member_1.yaml
4. 新しい指示が来るまで待機
```

### 4. タスクの実行（to/from方式）

```
User → Officer: "React でログイン画面を作成してください"
    ↓
Officer が relay/to/leader.yaml に詳細を書き込む（Officer専用）
    ↓
Officer が relay/inbox/leader.yaml に通知を追記 (inbox_write.sh)
    ↓
fswatch が inbox/leader.yaml の変更を検知 → notify_leader.sh 実行
    ↓
Extension がペイン1 (Leader) にフォーカスを変更してテキスト送信
    ↓
Leader が inbox を確認し、to/leader.yaml を読む
    ↓
Leader がタスクを分解
    ↓
Leader が relay/to/member_1.yaml に詳細を書き込む（Leader専用）
    ↓
Leader が relay/inbox/member_1.yaml に通知を追記 (inbox_write.sh)
    ↓
fswatch が inbox/member_1.yaml の変更を検知 → notify_member.sh 実行
    ↓
Extension がペイン2 (Member) にフォーカスを変更してテキスト送信
    ↓
Member が inbox を確認し、to/member_1.yaml を読む
    ↓
Member が作業開始
    ↓
Member が relay/reports/member_1_*.yaml を作成（Member_1専用）
    ↓
Member が relay/from/member_1.yaml に完了報告を書き込む（Member_1専用）
    ↓
Member が relay/inbox/leader.yaml に通知を追記 (inbox_write.sh)
    ↓
fswatch が inbox/leader.yaml の変更を検知 → notify_leader.sh 実行
    ↓
Leader が from/member_1.yaml を確認し、タスク完了を確認
    ↓
Leader が relay/from/leader.yaml に統合報告を書き込む（Leader専用）
    ↓
Leader が relay/inbox/officer.yaml に通知を追記 (inbox_write.sh)
    ↓
fswatch が inbox/officer.yaml の変更を検知 → notify_officer.sh 実行
    ↓
Officer がユーザーに報告
```

---

## 🔧 実装の詳細

### package.json

```json
{
  "name": "mcp-multiagent",
  "version": "1.0.0",
  "description": "Multi-agent system for Claude Code using VS Code Extension",
  "bin": {
    "mcp-init": "./bin/init.js",
    "mcp-start": "./bin/startup.sh"
  },
  "scripts": {
    "start": "concurrently \"npm run watch:officer\" \"npm run watch:leader\" \"npm run watch:member1\"",
    "watch:officer": "fswatch -o relay/inbox/officer.yaml | while read; do ./scripts/notify_officer.sh; done",
    "watch:leader": "fswatch -o relay/inbox/leader.yaml | while read; do ./scripts/notify_leader.sh; done",
    "watch:member1": "fswatch -o relay/inbox/member_1.yaml | while read; do ./scripts/notify_member.sh 1; done",
    "build:extension": "cd extension && npm run compile && vsce package"
  },
  "dependencies": {
    "concurrently": "^8.0.0"
  },
  "devDependencies": {
    "fswatch": "^1.17.1"
  },
  "files": [
    "bin/",
    "scripts/",
    "templates/",
    "extension/mcp-multiagent-extension.vsix"
  ]
}
```

### extension/package.json

```json
{
  "name": "terminal-relay",
  "displayName": "Terminal Relay",
  "description": "Terminal communication relay for multi-agent system",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.85.0"
  },
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "terminal-relay.startServer",
        "title": "Terminal Relay: Start Server"
      },
      {
        "command": "terminal-relay.stopServer",
        "title": "Terminal Relay: Stop Server"
      },
      {
        "command": "terminal-relay.testFocus",
        "title": "Terminal Relay: Test Focus"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0"
  }
}
```

**注意**: ポート番号は3773を使用（設定で変更可能）

### extension/src/extension.ts

**注意**: 実際に動作確認済みのコードは「検証テスト結果」セクションを参照してください。

```typescript
// 基本構造（詳細は検証テスト結果セクション参照）
import * as vscode from 'vscode';
import * as http from 'http';

export function activate(context: vscode.ExtensionContext) {
    // HTTP サーバーを起動
    const server = http.createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);

        // /chat エンドポイント（チャット送信用）
        if (url.pathname === '/chat') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMessage(terminal, text);
            res.end(`OK: Chat sent to terminal ${terminal}`);
        }
        // 他のエンドポイント...
    });

    server.listen(3773, () => {
        vscode.window.showInformationMessage('Terminal Relay: Server started on port 3773');
    });
}

// 【重要】2回送信アプローチ
function sendChatMessage(index: number, text: string) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        // 1回目: テキストだけ送る（改行なし）
        terminals[index].sendText(text, false);

        // 2回目: 1秒待ってからEnterを送る
        setTimeout(() => {
            terminals[index].sendText('', true);
        }, 1000);
    }
}
```

### scripts/notify_officer.sh

```bash
#!/bin/bash
# Officer への通知

LOG_FILE="logs/watcher.log"
mkdir -p logs

echo "[$(date)] Officer に通知送信" >> "$LOG_FILE"

# 現在アクティブなアプリを取得
CURRENT_APP=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)

# VS Code/Cursor がバックグラウンドか確認
if [[ "$CURRENT_APP" != "Visual Studio Code" && "$CURRENT_APP" != "Cursor" ]]; then
    echo "[$(date)] VS Code がバックグラウンド → アクティブ化 + 通知音" >> "$LOG_FILE"
    
    # 通知音を再生
    afplay /System/Library/Sounds/Glass.aiff &
    
    # VS Code をアクティブにする
    osascript -e 'tell application "Visual Studio Code" to activate' 2>> "$LOG_FILE"
    
    sleep 0.5
fi

# Extension の HTTP サーバーにリクエスト（ポート3773）
curl -s http://localhost:3773/notify/officer >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$(date)] エラー: Extension サーバーに接続できません" >> "$LOG_FILE"
fi
```

### scripts/notify_leader.sh

```bash
#!/bin/bash
# Leader への通知

LOG_FILE="logs/watcher.log"
mkdir -p logs

echo "[$(date)] Leader に通知送信" >> "$LOG_FILE"

# 現在アクティブなアプリを取得
CURRENT_APP=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)

# VS Code/Cursor がバックグラウンドか確認
if [[ "$CURRENT_APP" != "Visual Studio Code" && "$CURRENT_APP" != "Cursor" ]]; then
    echo "[$(date)] VS Code がバックグラウンド → アクティブ化 + 通知音" >> "$LOG_FILE"
    
    # 通知音を再生 (軽いガラスの音)
    afplay /System/Library/Sounds/Glass.aiff &
    
    # VS Code をアクティブにする (Cursor の場合は "Cursor" に変更)
    osascript -e 'tell application "Visual Studio Code" to activate' 2>> "$LOG_FILE"
    
    # アクティブ化を待つ
    sleep 0.5
else
    echo "[$(date)] VS Code は既にアクティブ" >> "$LOG_FILE"
fi

# Extension の HTTP サーバーにリクエスト（ポート3773）
curl -s http://localhost:3773/notify/leader >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$(date)] エラー: Extension サーバーに接続できません" >> "$LOG_FILE"
fi
```

**通知音のカスタマイズ**:
- `Glass.aiff`: 軽いガラスの音 (デフォルト)
- `Pop.aiff`: ポップ音
- `Ping.aiff`: ピンポン音
- `Tink.aiff`: iOS 風通知音
- カスタム音: `afplay ./sounds/notification.mp3`

### scripts/inbox_write.sh

```bash
#!/bin/bash
# inbox への追記スクリプト（共通使用、flockで排他制御）
# 使用方法: ./inbox_write.sh <inbox_file> <from> <type> <content_file> <message>

INBOX_FILE=$1      # 例: relay/inbox/leader.yaml
FROM=$2            # 例: officer
TYPE=$3            # 例: new_task, report_received
CONTENT_FILE=$4    # 例: relay/to/leader.yaml
MESSAGE=$5         # 例: "新しいタスク指示あり"

TIMESTAMP=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

# 新しいメッセージエントリを作成
NEW_ENTRY="- timestamp: \"$TIMESTAMP\"
  from: \"$FROM\"
  type: \"$TYPE\"
  file: \"$CONTENT_FILE\"
  message: \"$MESSAGE\""

# flockで排他制御しながらinboxファイルに追記
(
  flock -x 200
  echo "$NEW_ENTRY" >> "$INBOX_FILE"
) 200>"$INBOX_FILE.lock"

LOG_FILE="logs/watcher.log"
mkdir -p logs
echo "[$(date)] inbox_write.sh: $INBOX_FILE に通知を追記 (from: $FROM)" >> "$LOG_FILE"
```

### scripts/notify_member.sh

```bash
#!/bin/bash
# Member への通知

MEMBER_INDEX=$1  # 1, 2, 3...
LOG_FILE="logs/watcher.log"
mkdir -p logs

echo "[$(date)] Member${MEMBER_INDEX} に通知送信" >> "$LOG_FILE"

# 現在アクティブなアプリを取得
CURRENT_APP=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)

# VS Code/Cursor がバックグラウンドか確認
if [[ "$CURRENT_APP" != "Visual Studio Code" && "$CURRENT_APP" != "Cursor" ]]; then
    echo "[$(date)] VS Code がバックグラウンド → アクティブ化 + 通知音" >> "$LOG_FILE"
    
    # 通知音を再生
    afplay /System/Library/Sounds/Glass.aiff &
    
    # VS Code をアクティブにする
    osascript -e 'tell application "Visual Studio Code" to activate' 2>> "$LOG_FILE"
    
    sleep 0.5
fi

# Extension の HTTP サーバーにリクエスト（ポート3773）
curl -s http://localhost:3773/notify/member/${MEMBER_INDEX} >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$(date)] エラー: Extension サーバーに接続できません" >> "$LOG_FILE"
fi
```

### bin/startup.sh

```bash
#!/bin/bash

echo "🚀 MCP Multi-Agent System 起動中..."

# Extension が起動しているか確認（ポート3773）
if ! curl -s http://localhost:3773 > /dev/null 2>&1; then
    echo "⚠️  警告: Extension の HTTP サーバーが起動していません"
    echo "   VS Code/Cursor で Extension がインストールされているか確認してください"
    echo ""
fi

# ファイル監視をバックグラウンドで開始
npm start &
WATCH_PID=$!
echo "✅ ファイル監視開始 (PID: $WATCH_PID)"

echo ""
echo "次のステップ: VS Code/Cursor で分割ターミナルを作成してください"
echo "  1. Cmd + \\ を2回実行 (ターミナルを3分割)"
echo "  2. 各ペインで Claude Code を起動:"
echo "     - ペイン0 (左): claude --model opus    # Officer"
echo "     - ペイン1 (中): claude --model opus    # Leader"
echo "     - ペイン2 (右): claude --model sonnet  # Member"
echo ""
echo "停止するには: Ctrl+C または pkill -f fswatch"
```

---

## 📚 Instructions ファイルのテンプレート

(前回と同じ内容なので省略)

---

## 🎯 開発の優先順位

### Phase 1: Extension の実装
- [ ] `extension/package.json` の作成
- [ ] `extension/src/extension.ts` の実装
- [ ] Extension のビルド (`.vsix` ファイル生成)
- [ ] Extension のインストールと動作確認

### Phase 2: 基本構造の実装
- [ ] `package.json` の作成
- [ ] `bin/startup.sh` の実装
- [ ] `scripts/notify_*.sh` の実装 (curl 使用)
- [ ] `templates/` ディレクトリの準備
- [ ] YAML テンプレートの作成
- [ ] Instructions ファイルの作成

### Phase 3: 初期化スクリプト
- [ ] `bin/init.js` の実装 (プロジェクト初期化)
- [ ] Extension の自動インストール機能
- [ ] テンプレートの展開ロジック
- [ ] `mcp-init` コマンドのテスト

### Phase 4: 動作テスト
- [ ] 分割ターミナルの動作確認
- [ ] Extension の通知機能テスト
- [ ] 1エージェント (Officer のみ) で動作確認
- [ ] 2エージェント (Officer → Leader) で通信テスト
- [ ] 3エージェント (Officer → Leader → Member) で完全テスト

### Phase 5: 実用化機能
- [ ] ループ防止ロジック
- [ ] エラーハンドリング
- [ ] ログ機能
- [ ] ドキュメント整備

### Phase 6: 配布準備
- [ ] npm パッケージ化
- [ ] Extension の Marketplace 公開(オプション)
- [ ] README の充実
- [ ] 使用例の追加
- [ ] GitHub 公開

---

## 🐛 既知の課題と対策

### 課題1: Extension のポート競合

**問題**: 複数のプロジェクトで Extension を使うと、ポート 3000 が競合する

**対策**:
- 環境変数でポート番号を変更可能に: `MCP_PORT=3001`
- または、プロジェクトごとに Extension の設定を変更

### 課題2: ペインの順序依存

**問題**: Officer/Leader/Member のペイン順序が固定

**対策**:
- 起動時のガイダンスで明確に指示
- 将来的に、ペイン名で識別する機能を追加

### 課題3: Extension のインストール

**問題**: ユーザーが手動で Extension をインストールする必要がある

**対策**:
- `mcp-init` で自動インストールを実行
- `code --install-extension mcp-multiagent-extension.vsix`

### 課題4: Cursor での動作確認

**問題**: Cursor で Extension が正しく動作するか未検証

**対策**:
- VS Code で動作確認後、Cursor でもテスト
- 必要に応じて Cursor 専用の調整

---

## 📖 ユーザー向けドキュメント

### インストール方法

```bash
# グローバルインストール
npm install -g mcp-multiagent

# プロジェクトで初期化
cd my-project
mcp-init

# Extension が自動インストールされます
# (または手動: code --install-extension ~/.mcp-multiagent/mcp-multiagent-extension.vsix)

# システム起動
mcp-start
```

### トラブルシューティング

**Extension サーバーが起動しない**
- VS Code/Cursor で Extension がインストールされているか確認
- コマンドパレット (Cmd+Shift+P) で "Extensions" を検索
- "MCP Multi-Agent" が表示されるか確認

**ファイル監視が動作しない**
- `npm start` を確認
- `logs/watcher.log` を確認
- fswatch がインストールされているか確認: `which fswatch`

**通知が届かない**
- `curl http://localhost:3773/chat?terminal=1&text=test` を手動実行してテスト
- Extension のログを確認 (VS Code の "Output" パネル)
- ペインの順序が正しいか確認 (左: Officer, 中: Leader, 右: Member)

---

## 🎓 Claude Code への引き継ぎ指示

この計画書を Claude Code に渡す際の指示テンプレート:

```
この PLANNING.md を読んで、MCP マルチエージェントシステムを開発してください。

【開発の進め方】
1. まず extension/ ディレクトリで VS Code Extension を実装
2. Extension をビルドして .vsix ファイルを生成
3. package.json と基本的なディレクトリ構造を作成
4. bin/startup.sh と scripts/notify_*.sh を実装 (curl 使用)
5. templates/ ディレクトリにテンプレートファイルを配置
6. 動作確認用の簡単なテストを実行

【注意事項】
- Extension は TypeScript で実装します
- fswatch は macOS/Linux 用です
- Extension のポート番号は 3000 固定 (将来的に変更可能に)
- 将来的に npm パッケージとして配布予定です

【最初のタスク】
extension/package.json と extension/src/extension.ts を作成してください。
```

---

## 📝 備考

- この計画書は随時更新される可能性があります
- 実装中に発見した問題は、この計画書に追記してください
- ユーザーからのフィードバックを受けて、仕様を調整します

### 変更履歴
- v6 (2026-02-15): 検証テスト完了 - チャット送信の2回アプローチ確立、URLエンコード制約の記録、動作確認済みExtension コード追加
- v5 (2026-02-15): マルチエージェント将軍方式を採用 - to/from ディレクトリ分離、各エージェント専用ファイルでコンフリクト回避、flock追加
- v4 (2026-02-15): ディレクトリ構造を改善 - queue/ → relay/、tasks/ → messages/ に変更しファイル名を簡潔に
- v3 (2026-02-15): NOTE.md「推奨: ハイブリッド案」を反映 - queue/ ディレクトリ構造、inbox 通知方式を採用
- v2 (2026-02-15): `code --command` から Extension + HTTP サーバー方式に変更
- v1 (2026-02-15): 初版作成

---

## 🧪 検証テスト結果（2026-02-15）

### テスト環境
- **エディタ**: Cursor Editor
- **テスト構成**: 3ペイン（Pane0: Officer, Pane1: Leader, Pane2: Member）
- **各ペインでClaude Codeを起動**

### 検証項目と結果

| 項目 | 結果 | 備考 |
|------|------|------|
| Extension HTTPサーバー起動 | ✅ 成功 | ポート3773で動作 |
| ファイル監視（fswatch） | ✅ 成功 | YAMLファイル変更を検知 |
| ターミナルフォーカス移動 | ✅ 成功 | API経由で制御可能 |
| テキスト送信（チャット入力欄） | ✅ 成功 | 後述の方法で解決 |
| Pane0 → Pane1 通信 | ✅ 成功 | チャット送信確認 |
| Pane1 → Pane2 通信 | ✅ 成功 | チャット送信確認 |
| ファイルベース通信 | ✅ 成功 | YAML読み書き確認 |

### 重要な技術的発見

#### 1. チャット送信の2回アプローチ（最重要）

**問題**: Claude Codeのチャット入力欄にテキストを送信し、自動的に「送信」するには特殊なアプローチが必要

**解決策**: tmuxのsend-keysと同様に「2回に分けて送信」する
```typescript
// 1回目: テキストだけ送る（改行なし）
terminal.sendText(text, false);  // addNewLine = false

// 2回目: 1秒待ってからEnterを送る
setTimeout(() => {
    terminal.sendText('', true);  // addNewLine = true = Enter
}, 1000);
```

**重要**: 間隔は1秒（1000ms）必要。短いと正しく動作しない可能性がある。

#### 2. URLエンコードの制約

**事実**: curlコマンドで日本語を送信する場合、URLエンコードが必要
```
例: "Leaderより連絡です" → "Leader%E3%82%88%E3%82%8A%E9%80%A3%E7%B5%A1%E3%81%A7%E3%81%99"
```

**対策**:
- コマンド作成時はURLエンコードを使用
- 補足説明として日本語訳を添付
- 技術的な制約のため回避不可

#### 3. GUI上のフォーカス表示

**事実**: APIでターミナルフォーカスを制御しても、GUI上のタブ選択状態（背景色）は変わらない場合がある

**影響**: 実用上は問題ない。テキスト送信自体は正しく動作するため、Claude Codeは通知を受け取れる。

#### 4. 全てのEnter送信方法が動作

検証した5つの方法すべてが成功：
1. `sendText('', true)` - 空文字+改行
2. `sendSequence('\r')` - CR
3. `sendSequence('\n')` - LF
4. `sendText('\n', false)` - 改行文字
5. `sendSequence(charCode 13)` - 文字コード指定

**結論**: 重要なのは「2回に分けて送る」ことであり、Enterの送信方法自体は何でも動作する。

### 実際に動作したExtension コード

```typescript
// extension/src/extension.ts（動作確認済み）
import * as vscode from 'vscode';
import * as http from 'http';

let server: http.Server | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Terminal Relay');
    outputChannel.appendLine('Terminal Relay extension activated');

    const startServerCmd = vscode.commands.registerCommand(
        'terminal-relay.startServer',
        () => startServer()
    );

    const stopServerCmd = vscode.commands.registerCommand(
        'terminal-relay.stopServer',
        () => stopServer()
    );

    const testFocusCmd = vscode.commands.registerCommand(
        'terminal-relay.testFocus',
        () => testTerminalFocus()
    );

    context.subscriptions.push(startServerCmd, stopServerCmd, testFocusCmd, outputChannel);

    // Auto-start server
    startServer();
}

function startServer() {
    if (server) {
        outputChannel.appendLine('Server already running');
        vscode.window.showInformationMessage('Terminal Relay: Server already running');
        return;
    }

    server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${getPort()}`);
        outputChannel.appendLine(`Request: ${url.pathname}`);

        if (url.pathname === '/focus') {
            const index = parseInt(url.searchParams.get('index') || '0', 10);
            focusTerminal(index);
            res.end(`OK: Focus terminal ${index}`);
        } else if (url.pathname === '/send') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendToTerminal(terminal, text);
            res.end(`OK: Sent to terminal ${terminal}`);
        } else if (url.pathname === '/chat') {
            // チャット送信用エンドポイント（2回送信アプローチ）
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMessage(terminal, text);
            res.end(`OK: Chat sent to terminal ${terminal}`);
        } else if (url.pathname === '/test') {
            testTerminalFocus();
            res.end('OK: Test executed');
        } else {
            res.end('Terminal Relay is running. Use /focus, /send, /chat, or /test');
        }
    });

    const port = getPort();
    server.listen(port, () => {
        outputChannel.appendLine(`Server started on port ${port}`);
        vscode.window.showInformationMessage(`Terminal Relay: Server started on port ${port}`);
    });
}

function stopServer() {
    if (server) {
        server.close();
        server = null;
        outputChannel.appendLine('Server stopped');
        vscode.window.showInformationMessage('Terminal Relay: Server stopped');
    }
}

function getPort(): number {
    const config = vscode.workspace.getConfiguration('terminalRelay');
    return config.get<number>('port', 3773);
}

function focusTerminal(index: number) {
    outputChannel.appendLine(`Focusing terminal ${index}`);
    vscode.commands.executeCommand('workbench.action.terminal.focusAtIndex', index);
    vscode.commands.executeCommand('workbench.action.terminal.focus');
}

function sendToTerminal(index: number, text: string) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text);
        outputChannel.appendLine(`Sent to terminal ${index}: ${text.substring(0, 50)}...`);
    } else {
        outputChannel.appendLine(`Terminal ${index} not found. Available: ${terminals.length}`);
    }
}

function sendChatMessage(index: number, text: string) {
    const terminals = vscode.window.terminals;

    if (index >= 0 && index < terminals.length) {
        // 【重要】tmuxの2回送信アプローチ
        // 1. テキストだけ送る（改行なし）
        terminals[index].sendText(text, false);
        outputChannel.appendLine(`Chat text sent to terminal ${index}: ${text}`);

        // 2. 1秒待ってからEnterを送る
        setTimeout(() => {
            terminals[index].sendText('', true);
            outputChannel.appendLine(`Enter sent to terminal ${index}`);
        }, 1000);
    } else {
        outputChannel.appendLine(`Terminal ${index} not found. Available: ${terminals.length}`);
    }
}

function testTerminalFocus() {
    outputChannel.appendLine('=== Terminal Focus Test ===');

    if (vscode.window.terminals.length === 0) {
        vscode.window.createTerminal('Test Terminal');
        outputChannel.appendLine('Created test terminal');
    }

    const terminals = vscode.window.terminals;
    outputChannel.appendLine(`Terminals: ${terminals.length}`);

    terminals.forEach((t, i) => {
        outputChannel.appendLine(`  [${i}] ${t.name}`);
    });

    vscode.commands.executeCommand('workbench.action.terminal.focusAtIndex', 0);

    setTimeout(() => {
        if (terminals.length > 0) {
            terminals[0].sendText('echo "Terminal focus test successful!"\n');
        }
    }, 1000);

    vscode.window.showInformationMessage('Terminal Focus Test: Check terminal panel');
}

export function deactivate() {
    stopServer();
}
```

### テストで使用したcurlコマンド例

```bash
# チャット送信（URLエンコード必須）
# 日本語: "Officerより連絡です"
curl "http://localhost:3773/chat?terminal=1&text=Officer%E3%82%88%E3%82%8A%E9%80%A3%E7%B5%A1%E3%81%A7%E3%81%99"

# ファイル書き込み
echo "- timestamp: \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" > relay/to/leader.yaml
echo "  from: officer" >> relay/to/leader.yaml
echo "  task: 新機能の実装計画を作成せよ" >> relay/to/leader.yaml
```

### 次のステップ（実装時の参考）

1. **Extension**: 上記のコードをベースに実装
2. **通信フロー**:
   - 送信元: ファイル書き込み → curl でチャット通知
   - 受信元: チャット受信 → ファイル読み込み → 応答
3. **URLエンコード**: Node.jsの `encodeURIComponent()` を使用

---

**計画書作成者**: Claude (Web版)
**実装担当者**: Claude Code (ローカル)
**最終承認者**: ユーザー
