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
    "max_players": 4      // 2〜10
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

### `play_card` - カードをプレイ

```json
{
  "type": "play_card",
  "payload": {
    "card_id": "heart_7"  // カードID（例: "spade_A", "diamond_3"）
  }
}
```

**成功時レスポンス**: [`card_played`](#card_played---カードプレイ通知)（全参加者へブロードキャスト）

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

全参加者にブロードキャスト。各プレイヤーには自分の手札のみ送信。

```json
{
  "type": "game_started",
  "payload": {
    "players": ["たろう", "はなこ", "じろう"],
    "your_cards": ["heart_7", "spade_A", "diamond_3"],
    "first_player": "たろう"
  }
}
```

---

### `card_played` - カードプレイ通知

全参加者にブロードキャスト。

```json
{
  "type": "card_played",
  "payload": {
    "player": "たろう",
    "card": "heart_7"
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

### `game_ended` - ゲーム終了

全参加者にブロードキャスト。

```json
{
  "type": "game_ended",
  "payload": {
    "winner": "たろう",
    "rankings": ["たろう", "じろう", "はなこ"]
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
| `ROOM_FULL` | ルームが満員 |
| `GAME_NOT_STARTED` | ゲームがまだ開始していない |
| `NOT_YOUR_TURN` | 自分のターンではない |
| `INVALID_CARD` | 無効なカードID |
| `ALREADY_IN_ROOM` | すでにルームに参加している |

---

## ゲーム状態遷移

```
waiting（参加待ち）
    ↓ 全員揃ってホストが開始
playing（ゲーム中）
    ↓ 勝敗決定
finished（終了）
    ↓ 再戦 or 解散
waiting or 解散
```
