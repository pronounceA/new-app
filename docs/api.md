# API仕様書

## REST API

ベースURL: `http://localhost:8000`

### ヘルスチェック

```
GET /health
```

**レスポンス**
```json
{
  "status": "ok"
}
```

---

### ルーム一覧取得

```
GET /rooms
```

**レスポンス**
```json
[
  {
    "room_id": "abc123",
    "host_nickname": "たろう",
    "player_count": 3,
    "max_players": 5,
    "status": "waiting"   // "waiting" | "playing"
  }
]
```

---

## WebSocket API

### 接続

```
ws://localhost:8000/ws/{player_id}
```

- `player_id`: クライアントが生成するUUID等の一意なID

### メッセージフォーマット

すべてのメッセージはJSON形式。

```json
{
  "type": "<イベント名>",
  "payload": { ... }
}
```

---

## クライアント → サーバー イベント

### `create_room` - ルーム作成

```json
{
  "type": "create_room",
  "payload": {
    "nickname": "たろう",
    "max_players": 4      // 2〜6
  }
}
```

**成功時レスポンス**: [`room_created`](#room_created---ルーム作成完了)

---

### `join_room` - ルーム参加

```json
{
  "type": "join_room",
  "payload": {
    "room_id": "abc123",
    "nickname": "はなこ"
  }
}
```

**成功時レスポンス**: [`player_joined`](#player_joined---プレイヤー参加通知)（全参加者へブロードキャスト）

---

### `score_cards` - 得点化

ターン開始時に場のカードを得点化する。場にカードがある場合は必須。

```json
{
  "type": "score_cards",
  "payload": {}
}
```

**成功時レスポンス**: [`cards_scored`](#cards_scored---得点化通知)（全参加者へブロードキャスト）

---

### `draw_card` - カードを引く

得点化の後に山札からカードを1枚引く。

```json
{
  "type": "draw_card",
  "payload": {}
}
```

**成功時レスポンス**: [`card_drawn`](#card_drawn---カードを引いた通知)（全参加者へブロードキャスト）

バースト発生時は追加で [`burst`](#burst---バースト通知) が全参加者へ送信される。

---

### `steal_card` - 横取り

引いたカードの数字が他プレイヤーの場のカードと一致する場合に任意で実行できる。

```json
{
  "type": "steal_card",
  "payload": {
    "target_player_id": "player_uuid",
    "card_number": 7
  }
}
```

**成功時レスポンス**: [`card_stolen`](#card_stolen---横取り通知)（全参加者へブロードキャスト）

---

### `leave_room` - ルーム退出

```json
{
  "type": "leave_room",
  "payload": {}
}
```

---

## サーバー → クライアント イベント

### `room_created` - ルーム作成完了

```json
{
  "type": "room_created",
  "payload": {
    "room_id": "abc123"
  }
}
```

---

### `player_joined` - プレイヤー参加通知

全参加者にブロードキャスト。

```json
{
  "type": "player_joined",
  "payload": {
    "nickname": "はなこ",
    "player_count": 2,
    "players": ["たろう", "はなこ"]
  }
}
```

---

### `game_started` - ゲーム開始

全参加者にブロードキャスト。手札はなし。

```json
{
  "type": "game_started",
  "payload": {
    "players": ["たろう", "はなこ", "じろう"],
    "deck_count": 110,
    "first_player": "たろう"
  }
}
```

---

### `card_drawn` - カードを引いた通知

全参加者にブロードキャスト。

```json
{
  "type": "card_drawn",
  "payload": {
    "player": "たろう",
    "card": 7,
    "field": [3, 7]
  }
}
```

- `card`: 引いたカードの数字
- `field`: 引いた後のそのプレイヤーの場のカード一覧

---

### `cards_scored` - 得点化通知

全参加者にブロードキャスト。

```json
{
  "type": "cards_scored",
  "payload": {
    "player": "たろう",
    "cards": [3, 7, 5],
    "score": 15
  }
}
```

- `cards`: 得点化されたカードの数字一覧
- `score`: 今回の得点化で加算された得点

---

### `burst` - バースト通知

バースト発生時に全参加者にブロードキャスト。

```json
{
  "type": "burst",
  "payload": {
    "player": "たろう",
    "lost_cards": [3, 7, 7]
  }
}
```

- `lost_cards`: バーストにより失われた場のカード一覧（得点化不可）

---

### `card_stolen` - 横取り通知

全参加者にブロードキャスト。

```json
{
  "type": "card_stolen",
  "payload": {
    "from_player": "はなこ",
    "to_player": "たろう",
    "card": 7
  }
}
```

---

### `turn_changed` - ターン変更通知

全参加者にブロードキャスト。

```json
{
  "type": "turn_changed",
  "payload": {
    "current_player": "はなこ"
  }
}
```

---

### `game_state` - ゲーム状態更新

全参加者にブロードキャスト。接続再確立時や整合性確認時に送信。

```json
{
  "type": "game_state",
  "payload": {
    "fields": {
      "たろう": [3, 5],
      "はなこ": [],
      "じろう": [8]
    },
    "deck_count": 87,
    "scores": {
      "たろう": 20,
      "はなこ": 15,
      "じろう": 8
    },
    "current_player": "はなこ"
  }
}
```

---

### `game_ended` - ゲーム終了

全参加者にブロードキャスト。山札がなくなった時点で送信。

```json
{
  "type": "game_ended",
  "payload": {
    "winner": "たろう",
    "rankings": [
      {"player": "たろう", "score": 45},
      {"player": "じろう", "score": 38},
      {"player": "はなこ", "score": 27}
    ]
  }
}
```

---

### `error` - エラー通知

送信元クライアントのみに送信。

```json
{
  "type": "error",
  "payload": {
    "message": "あなたのターンではありません",
    "code": "NOT_YOUR_TURN"
  }
}
```

**エラーコード一覧**

| コード | 説明 |
|--------|------|
| `ROOM_NOT_FOUND` | 指定したルームが存在しない |
| `ROOM_FULL` | ルームが満員（最大6人） |
| `GAME_NOT_STARTED` | ゲームがまだ開始していない |
| `NOT_YOUR_TURN` | 自分のターンではない |
| `INVALID_PHASE` | 現在のフェーズで許可されていない操作 |
| `CANNOT_STEAL` | 横取り条件を満たしていない |
| `ALREADY_IN_ROOM` | すでにルームに参加している |

---

## ゲーム状態遷移

```
waiting（参加待ち）
    ↓ 全員揃ってホストが開始
playing（ゲーム中）
  ↓ ターンフロー
  [score_cards] → [draw_card] → バースト or [steal_card（任意）] → turn_changed
    ↓ 山札がなくなった時点
finished（終了）
    ↓ 再戦 or 解散
waiting or 解散
```

### ターンフェーズ

| フェーズ | 有効なイベント |
|---------|--------------|
| `score` | `score_cards`（場が空の場合はスキップして `draw` へ） |
| `draw` | `draw_card` |
| `steal` | `steal_card`、または何もしないでターン終了 |
