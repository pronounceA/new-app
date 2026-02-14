# アーキテクチャ

## システム構成図

```
┌──────────────────────┐        WebSocket         ┌──────────────────────┐
│    React Frontend    │◄────────────────────────►│   FastAPI Backend    │
│  (Vite + TypeScript) │                           │  (Python 3.11+)      │
└──────────────────────┘                           └──────────┬───────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │        Redis         │
                                                   │   (State Store)      │
                                                   │   インメモリのみ     │
                                                   └──────────────────────┘
```

## 各レイヤーの責務

### Frontend（React + TypeScript）
- UIレンダリング・ゲーム盤面の表示
- WebSocketクライアントの接続・切断管理
- サーバーからのイベントを受信してUIに反映
- ユーザー操作をWebSocketイベントとして送信

### Backend（FastAPI）
- WebSocket接続の受付・`ConnectionManager` による接続管理
- 受信イベントのルーティングとゲームロジック実行
- Redisへのゲーム状態の読み書き
- 同ルームの全クライアントへのブロードキャスト

### Redis
- ゲームルーム・プレイヤー・ゲーム状態のインメモリ管理
- DBは使用しない（サーバー再起動で状態は消滅）
- TTLによる放置ルームの自動削除

---

## API仕様

### REST API

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/rooms` | 公開ルーム一覧取得 |

### WebSocket接続

```
ws://localhost:8000/ws/{player_id}
```

### WebSocketイベント一覧

#### クライアント → サーバー

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `create_room` | `{nickname, max_players}` | ルームを作成する（max_players: 2〜6） |
| `join_room` | `{room_id, nickname}` | 既存ルームに参加する |
| `score_cards` | `{}` | 場のカードを得点化する（ターン開始時・必須） |
| `draw_card` | `{}` | 山札からカードを1枚引く |
| `steal_card` | `{target_player_id, card_number}` | 他プレイヤーの場のカードを横取りする |
| `leave_room` | `{}` | ルームから退出する |

#### サーバー → クライアント

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `room_created` | `{room_id}` | ルーム作成完了通知 |
| `player_joined` | `{nickname, player_count, players}` | プレイヤー参加通知（全員へブロードキャスト） |
| `game_started` | `{players, deck_count, first_player}` | ゲーム開始通知 |
| `card_drawn` | `{player, card, field}` | カードが引かれた通知（全員へブロードキャスト） |
| `cards_scored` | `{player, cards, score}` | 得点化発生通知（全員へブロードキャスト） |
| `burst` | `{player, lost_cards}` | バースト発生通知（全員へブロードキャスト） |
| `card_stolen` | `{from_player, to_player, card}` | 横取り発生通知（全員へブロードキャスト） |
| `turn_changed` | `{current_player}` | ターン変更通知（全員へブロードキャスト） |
| `game_state` | `{fields, deck_count, scores, current_player}` | ゲーム状態全体更新 |
| `game_ended` | `{winner, rankings}` | ゲーム終了・勝者通知（全員へブロードキャスト） |
| `error` | `{message, code}` | エラー通知（送信元のみ） |

---

## Redisキー設計

| キー | 型 | 内容 | TTL |
|------|----|------|-----|
| `room:{room_id}` | Hash | ルーム情報（状態・最大人数・ホスト等） | 3時間 |
| `room:{room_id}:players` | List | 参加プレイヤー一覧（順番 = ターン順） | 3時間 |
| `game:{room_id}:deck` | List | 山札（シャッフル済み、右端が山札の上） | ゲーム終了まで |
| `game:{room_id}:field:{player_id}` | List | 各プレイヤーの場のカード（数字のみ） | ゲーム終了まで |
| `game:{room_id}:scores` | Hash | 各プレイヤーの得点（`player_id` → `score`） | ゲーム終了まで |
| `game:{room_id}:turn` | Hash | 現在のターン情報（`current_player_id`, `phase`） | ゲーム終了まで |

### フェーズ定義（`game:{room_id}:turn.phase`）

| フェーズ | 説明 |
|---------|------|
| `score` | 得点化待ち（場が空でない場合に開始） |
| `draw` | カードを引く待ち |
| `steal` | 横取り選択待ち（横取り可能な場合のみ） |

---

## エラーハンドリング方針

### WebSocket切断時
- `ConnectionManager` が切断を検知し、ルームから該当プレイヤーを除外
- 残りプレイヤーへ切断通知を送信
- ゲーム中の場合: そのプレイヤーのターンをスキップしゲームを継続（またはゲーム中断）

### Redis接続エラー時
- バックエンドが例外をキャッチし、`error` イベントをクライアントに送信
- 状態が破損した場合はルームを強制終了

### 無効なイベント受信時
- バックエンドでバリデーション（Pydantic）を実施
- バリデーション失敗時は `error` イベントで送信元クライアントに返す

---

## デプロイアーキテクチャ

```
インターネット
      ↓
ロードバランサー（HTTPS / WSS）
      ↓
┌──────────────┐  ┌──────────────┐
│  Frontend    │  │  Backend     │
│  Container   │  │  Container   │
│（静的配信）  │  │（FastAPI）   │
└──────────────┘  └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │    Redis     │
                   │（マネージド）│
                   └──────────────┘
```

**注意**: WebSocket接続にはロードバランサーのタイムアウト設定を長めに設定する必要がある。
