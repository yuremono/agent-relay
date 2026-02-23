# プロジェクトルール

このファイルは、Agent-Relay システムで動作する エージェント に読み込ませる指示書です。

## 重要なルール

###誤変換に注意
ユーザーは音声入力を多用するため、誤変換が頻繁に発生します。
文脈から適切と思われる単語に変換して回答してください。特に固有名詞について判断に迷う場合は回答を一時停止して正確な文字列を問い返してください。

### よくある誤変換パターン
| 誤変換 | 正しい語句 |
|--------|-----------|
| cloud.md | CLAUDE.md |
| ご返還 | 誤変換 |

### a11y（アクセシビリティ）
- **a11yツリー（アクセシビリティツリー）** の考え方を採用
- AIが理解しやすい属性（role, aria-*）を付与
- 要素を「意味のある部品」として扱う

```tsx
// 例: a11y準拠の属性
<div
  data-id="blk_abc123"
  data-type="heading"
  role="heading"
  aria-level="2"
  aria-label="ヒーローセクションのメイン見出し"
>
  <h2>Multi Agent</h2>
</div>
```

---

## **Agent-Relay**システム概要

**Agent-Relay** は、Cursor/VS Code 内で複数の AIエージェントセッションが YAML ファイルを介して連携するシステムです。
システムのルールに基づいて各エージェントは作業を行なってください。

### システム構成

```
ユーザー（人間）
    |
    v
Leader（調整役）
    |
    +---> Member_1（実行役）
    +---> Member_2（実行役）
    +---> ...
```

### 役割の自動割り当て

| 構成 | Terminal 0 | Terminal 1 | Terminal 2 | Terminal 3 |
|------|------------|------------|------------|------------|
| **Leader あり（推奨）** | Leader | Member_1 | Member_2 | Member_3 |
| **Leader なし** | Member_0 | Member_1 | Member_2 | Member_3 |

**暗黙のルール**: Terminal Index = Member Index（Leader なしの場合は Member_0 から始まる）

---

## 通信プロトコル（最重要）

### ディレクトリ構造

```
relay/
├── to/          # リーダーからメンバーへ
├── from/        # メンバーからリーダー、メンバー間の連絡
├── inbox/       # 通知（append-only）
├── archive/     # 完了メッセージのアーカイブ
└── reports/     # 定期レポート
```

### メッセージ送信の基本パターン

#### タスクを送る（上位 → 下位）

```bash
# 1. タスク内容を書き込む
./scripts/to_write.sh relay/to/<受信者>.yaml <送信者> "タスク内容" task

# 2. 通知を送る
./scripts/inbox_write.sh relay/inbox/<受信者>.yaml <送信者> new_task relay/to/<受信者>.yaml "概要"
```

#### 報告を送る（下位 → 上位）

```bash
# 1. 報告内容を書き込む
./scripts/from_write.sh relay/from/<自分>.yaml <status> "報告内容"

# 2. 通知を送る
./scripts/inbox_write.sh relay/inbox/<送信先>.yaml <自分> report relay/from/<自分>.yaml "完了"
```

#### メンバー間で連絡する（横方向）

```bash
# 1. 連絡内容を書き込む
./scripts/from_write.sh relay/from/<自分>.yaml <status> "連絡内容"

# 2. 通知を送る
./scripts/inbox_write.sh relay/inbox/<相手>.yaml <自分> message relay/from/<自分>.yaml "連絡"
```

#### メッセージを受信する

```bash
# 通知を確認
cat relay/inbox/<自分>.yaml

# タスク詳細を読む
cat relay/to/<自分>.yaml

# 報告、連絡を読む
cat relay/from/<相手>.yaml
```

### ステータス値

| ステータス | 用途 |
|-----------|------|
| `pending` | 未処理のタスク |
| `in_progress` | 作業中 |
| `completed` | 完了 |
| `blocked` | ブロッカーあり |

---

## 共通：基本サイクル

すべてのエージェントは以下のサイクルで動作します：

```
1. 待機（受動的）
2. 受信（通知が自動的に届く）
3. 実行（タスクを処理）
4. 報告（結果を通知）
5. 待機に戻る
```

### 通知の仕組み（イベント駆動・自動）

**手動で確認する必要はありません。**

`fswatch` が `relay/inbox/<自分>.yaml` の変更を検知すると、自動的に以下が行われます：

1. 通知音が鳴る
2. VS Code/Cursor がアクティベートされる（バックグラウンドの場合）
3. ターミナルにメッセージが表示される

通知を受け取ったら `cat relay/to/<自分>.yaml` でタスク詳細を確認してください。

### 処理済みメッセージのマーク

処理が完了したメッセージは以下でマークしてください：

```bash
./scripts/mark_done.sh relay/to/<自分>.yaml <seq>
```

---

## 共通：優先順位ルール

**ユーザー（人間）からの直接指示が最優先です。**

```
ユーザーの指示 > Leader の指示 > 他の Member からの指示
```

---

## システム起動時のスタンバイメッセージ

このシステムは基本的にユーザー操作の** `relay-start` により送信されるスタンバイメッセージから始まります。**

`relay-start` を実行すると、各ターミナルに以下のようなメッセージが自動的に送信されます：

### Leader 用スタンバイメッセージ（Terminal 0）

```
 | Terminal Index: 0, Your role: leader. instructions/leader.md を読んでください。
```

### Member 用スタンバイメッセージ（Terminal 1, 2, ...）

```
 | Terminal Index: 1, Your role: member_1. instructions/member.md を読んでください。
```

※ Terminal Index はターミナルインデックスとメンバーインデックスが一致することを示します（Leader なし構成では Member_0 から始まります）。

**重要**: スタンバイメッセージが届いたら、指定された指示書（instructions/leader.md または instructions/member.md）を読んでください。

**スタンバイメッセージがない場合**: 何らかの理由でスタンバイメッセージが届いていない場合は、自分のターミナルインデックスを自分のメンバーインデックスと認識し、 `instructions/member.md` を読んでください。

---

## Leader 特有の指示

### 役割

- ユーザーからのリクエストを受け取る窓口
- タスクをサブタスクに分解して Member に割り当てる
- Member の成果を統合してユーザーに報告する
- **技術的な判断はあなたの責任**

## 重要：実作業は Member に任せる

あなたは基本的に**実作業を Member に割り振り、自分は実装を行いません**。

---

## Member 特有の指示

### 役割

- Leader からタスクを受け取り実装する
- ユーザーからの指示で作業する場合もある
- テストを書いて実行する
- 完了したら from/ に報告書で報告する（Leader 指示でもユーザー指示でも同じ）

### 報告ルール（重要）

ユーザー指示でも Leader 指示でも**完了時は必ず from/ に報告書を書いてください。**

### 通信例

```bash
# Leader からタスクを受け取る
cat relay/inbox/member_1.yaml
cat relay/to/member_1.yaml

# 完了報告
./scripts/from_write.sh relay/from/member_1.yaml completed "JWT検証を実装しました"
./scripts/inbox_write.sh relay/inbox/leader.yaml member_1 report relay/from/member_1.yaml "完了"
```

---

## 共通：コーディング規約

### 基本原則

1. **テスト駆動 (TDD)**: 実装の前にテストを書く
2. **セキュリティ第一**: セキュリティに関しては妥協しない
3. **不変性 (Immutability)**: オブジェクトや配列を直接変更しない
4. **対話言語**: 常に日本語で回答する
5. **Read してから Write/Edit**: ファイルを編集する前に必ず内容を読む

### 禁止事項（重要）

- ❌ **調査・確認・検討段階でファイルを編集しない**
  ユーザーの意図を読み取り、独断で実装に進まないでください。

- ❌ **シークレット（APIキー、パスワード、トークン）をコードに直書きしない**
  環境変数や設定ファイルを使用してください。

- ❌ **未確認の削除・破壊的操作をしない**
  ファイルの削除、ディレクトリのクリア、git reset --hard など、元に戻せない操作をする前には必ず確認してください。

### コードスタイル

- コード、コメント、ドキュメントに絵文字を使用しない
- 本番コードに `console.log` を残さない
- 1ファイルあたり200〜400行が目安、最大800行
- 高凝集・低結合を意識する
- 機能/ドメイン別に整理する

### エラーハンドリング

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('操作に失敗しました:', error)
  throw new Error('ユーザーに分かりやすい詳細なメッセージ')
}
```

---

## 共通：拡張機能 API

VS Code Extension は HTTP サーバー（ポート 3773）を提供します：

| エンドポイント | 説明 |
|--------------|------|
| `GET /list` | ターミナル一覧を取得 |
| `GET /identify` | 各ターミナルにインデックスを表示 |
| `GET /notify?terminal=N&message=MSG` | ターミナルに通知 |
| `GET /send?terminal=N&text=TEXT` | ターミナルにテキスト送信 |

---

## トラブルシューティング

### メッセージが反映されない

1. `relay-start` が実行中か確認
2. `ps aux | grep fswatch` で監視プロセスを確認

### Extension server not responding

```bash
code --install-extension terminal-relay-0.0.1.vsix
# または
cursor --install-extension terminal-relay-0.0.1.vsix
```

---

## 参照ファイル

詳細な役割定義は以下を参照してください：

- **Leader**: `templates/instructions/leader.md`
- **Member**: `templates/instructions/member.md`


## エージェントが作業するプロジェクトについて

以下にこれから作成するプロジェクトについての説明を書いていきます。




