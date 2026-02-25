---
# ============================================================
# Member 設定 - YAML Front Matter（機械可読ルール定義）
# ============================================================

role: member

# 通知受信からの必須ワークフロー
# inbox に通知が届いた瞬間が step1。step7 まで止まらず完遂せよ。
workflow:
  - step: 1
    name: receive_wakeup
    description: "inbox通知が届く。これは確認依頼ではなく作業開始の合図"
    action: "次のステップへ即座に進め。ユーザーへの確認は不要"

  - step: 2
    name: read_inbox
    action: "cat relay/inbox/member_X.yaml"
    note: "先頭（最新）の1件を確認。通知元と種別を把握するだけでよい"

  - step: 3
    name: read_task
    action: "cat relay/to/member_X.yaml"
    note: "先頭（最新）のタスクを読む。ここに作業内容の詳細がある"

  - step: 4
    name: execute
    action: "タスクを実装する。確認不要、即実行"
    note: "破壊的操作・指示が不明確な場合のみ確認してよい"

  - step: 5
    name: write_report
    action: "./scripts/from_write.sh relay/from/member_X.yaml completed \"完了内容\""
    mandatory: true

  - step: 6
    name: notify_leader
    action: "./scripts/inbox_write.sh relay/inbox/leader.yaml member_X report relay/from/member_X.yaml \"完了\""
    mandatory: true
    note: "step5だけではLeaderに届かない。必ずstep6もセットで実行"

  - step: 7
    name: verify_delivery
    action: "head -5 relay/inbox/leader.yaml"
    success: "先頭に from: member_X が表示されていれば成功"
    failure: "表示されなければ step6 を再実行"

# 絶対禁止事項
forbidden:
  - id: F001
    action: confirmation_before_execution
    description: "「着手しますか？」「確認が必要ですか？」などの確認を取る"
    reason: "inbox通知は実行命令。ステップ1を受けたら即step2へ進め"

  - id: F002
    action: inbox_only_acknowledgment
    description: "inboxを読んで内容を報告するだけで終わる"
    reason: "inbox確認はstep2に過ぎない。step7まで完遂せよ"

  - id: F003
    action: from_write_only
    description: "from_write.sh だけ実行して inbox_write.sh を忘れる"
    reason: "from_write.sh だけでは Leader に届かない。step5とstep6は必ずセット"

  - id: F004
    action: wrong_working_directory
    description: "PROJECT_ROOT 以外から scripts/ を実行する"
    reason: "スクリプトに CWD チェックがある。必ず pwd && ls relay/ で確認してから実行"

  - id: F005
    action: absolute_or_relative_path
    description: "relay/... パスに /Users/... の絶対パスや ../ を使う"
    reason: "PROJECT_ROOT 相対パスのみ使用可"

# ファイルパス（X は自分のメンバー番号）
files:
  inbox:  "relay/inbox/member_X.yaml"   # 通知受信
  task:   "relay/to/member_X.yaml"      # タスク詳細（作業内容はここ）
  report: "relay/from/member_X.yaml"    # 完了報告

# 優先順位
priority:
  1: "ユーザー（人間）の直接指示"
  2: "Leader からのタスク"
---

# Member 指示書

## PROJECT_ROOT の確認

**PROJECT_ROOT = AGENTS.md と relay/ が存在するディレクトリ**

作業開始前に必ず確認：

```bash
pwd && ls relay/
# relay/ が見えれば OK
# 見えなければ: find ~ -name "AGENTS.md" -maxdepth 6 2>/dev/null
```

スクリプトは PROJECT_ROOT 以外から実行するとエラーで止まります。

---

## ワークフロー早見表

```
inbox通知着信
  → cat relay/inbox/member_X.yaml   （先頭1件を確認）
  → cat relay/to/member_X.yaml      （先頭のタスクを読む）
  → 実装・テスト                     （確認不要、即実行）
  → from_write.sh で報告書を書く    【必須】
  → inbox_write.sh で Leader に通知 【必須・忘れると届かない】
  → head -5 relay/inbox/leader.yaml （先頭に自分の通知があれば成功）
```

---

## コマンド例

### 完了報告（step5 + step6 セットで実行）

```bash
./scripts/from_write.sh relay/from/member_X.yaml completed "実装内容の説明"
./scripts/inbox_write.sh relay/inbox/leader.yaml member_X report relay/from/member_X.yaml "完了"
```

### ブロッカー発生時

```bash
./scripts/from_write.sh relay/from/member_X.yaml blocked "ブロック内容の説明"
./scripts/inbox_write.sh relay/inbox/leader.yaml member_X report relay/from/member_X.yaml "ブロック中"
```

---

## コンテキストリセット後の復帰手順

会話がリセットされた場合、以下の順で状況を再把握する：

```bash
# 1. 自分のタスクを確認（pendingなら作業再開）
cat relay/to/member_X.yaml

# 2. 自分の直近の報告を確認（何をやったか）
head -20 relay/from/member_X.yaml

# 3. status: pending のタスクがあれば実行、なければ待機
```

---

## 報告書フォーマット

`from_write.sh` が自動でフォーマットするので、第3引数に内容を書くだけでよい。
詳細な記録を残したい場合の例：

```
"## 完了報告\n\n実装内容：\n- auth.ts にJWT検証を実装\n- 単体テスト全件パス"
```
