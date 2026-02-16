# だるまあつめ

WebSocketを使用したリアルタイム通信により、2～6人が同時にプレイできるカードゲームWebアプリケーションです。

## 主な機能

- **リアルタイム通信**: WebSocketによる双方向通信で、遅延なくゲームをプレイ
- **マルチプレイヤー**: 2～6人が同時に参加可能
- **ゲームルーム管理**: ルームの作成・参加・退出
- **カードゲームロジック**: カード配布、プレイ、ターン制御、勝敗判定
- **簡易認証**: ニックネーム入力でゲームに参加
- **状態管理**: Redisによる高速な状態管理（DB不使用）

## 技術スタック

### バックエンド
- **Python 3.11+**: プログラミング言語
- **FastAPI**: 高速なWebフレームワーク
- **WebSocket**: リアルタイム通信（FastAPI内蔵）
- **Redis**: インメモリデータストアによる状態管理
- **Pydantic**: データバリデーション

### フロントエンド
- **React 18+**: UIライブラリ
- **TypeScript**: 型安全な開発
- **WebSocket Client**: リアルタイム通信
- **Vite**: 高速なビルドツール
- **Tailwind CSS**: スタイリング（推奨）

### インフラ
- **Docker / Docker Compose**: コンテナ化
- **Redis**: データストア
- **クラウドプロバイダー**: AWS / GCP / Azure（デプロイ先）

## システム構成

```
┌─────────────┐      WebSocket      ┌──────────────┐
│   React     │◄───────────────────►│   FastAPI    │
│  Frontend   │                     │   Backend    │
└─────────────┘                     └───────┬──────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │    Redis     │
                                    │ (State Store)│
                                    └──────────────┘
```

### WebSocket接続フロー
1. クライアントがニックネームを入力
2. WebSocketでバックエンドに接続
3. ゲームルームを作成または参加
4. Redis上でゲーム状態を管理
5. イベント（カードプレイ等）をリアルタイムで全参加者に配信

## プロジェクト構成

```
new-app/
├── backend/                # FastAPI バックエンド
│   ├── app/
│   │   ├── main.py        # エントリーポイント
│   │   ├── websocket/     # WebSocket接続管理
│   │   ├── models/        # データモデル（Pydantic）
│   │   ├── services/      # ゲームロジック
│   │   └── redis/         # Redis接続・操作
│   ├── requirements.txt   # Python依存関係
│   └── Dockerfile         # Dockerイメージ定義
│
├── frontend/              # React フロントエンド
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── pages/        # ページコンポーネント
│   │   ├── hooks/        # カスタムフック
│   │   └── services/     # WebSocket通信
│   ├── package.json      # npm依存関係
│   └── Dockerfile        # Dockerイメージ定義
│
├── docker-compose.yml     # Docker Compose設定
└── README.md             # このファイル
```

## 開発環境セットアップ

### 前提条件
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### 開発環境の起動

```bash
# リポジトリクローン
git clone <repository-url>
cd new-app

# Docker Composeで全サービスを起動
docker-compose up -d

# アクセス
# フロントエンド: http://localhost:3000
# バックエンドAPI: http://localhost:8000
# API Docs (Swagger): http://localhost:8000/docs
```

### ローカル開発

Docker Composeを使用することで、すべてのサービス（バックエンド、フロントエンド、Redis）を一括で管理できます。

#### サービスの起動

```bash
# フォアグラウンドで起動（ログをリアルタイム表示）
docker-compose up

# バックグラウンドで起動
docker-compose up -d
```

#### ホットリロード

ローカルのコード変更は自動的にコンテナ内に反映されます：
- **バックエンド**: FastAPIの `--reload` オプションにより、Pythonファイルの変更を自動検知
- **フロントエンド**: Viteのホットリロード機能により、React/TypeScriptファイルの変更を即座に反映

#### よく使うコマンド

```bash
# ログの確認
docker-compose logs -f          # 全サービスのログ
docker-compose logs -f backend  # バックエンドのみ
docker-compose logs -f frontend # フロントエンドのみ

# サービスの停止
docker-compose down

# イメージの再ビルド（依存関係を追加した場合など）
docker-compose build
docker-compose up -d --build

# コンテナ内でコマンドを実行
docker-compose exec backend python -m pytest          # テスト実行
docker-compose exec backend pip install <package>     # パッケージ追加
docker-compose exec frontend npm install <package>    # パッケージ追加

# 特定のサービスのみ再起動
docker-compose restart backend
docker-compose restart frontend
```

#### トラブルシューティング

```bash
# コンテナの状態確認
docker-compose ps

# Redis接続確認
docker-compose exec backend redis-cli -h redis ping

# 全コンテナを削除して再作成
docker-compose down -v
docker-compose up -d --build
```

## API仕様

### REST API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/rooms` | ルーム一覧取得 |

### WebSocket イベント

#### クライアント → サーバー

| イベント | データ | 説明 |
|---------|--------|------|
| `join_room` | `{room_id, nickname}` | ルームに参加 |
| `create_room` | `{nickname, max_players}` | ルームを作成 |
| `score_cards` | `{}` | 場のカードを得点化 |
| `draw_card` | `{}` | カードを引く |
| `steal_card` | `{target_player_id, card_number}` | 他プレイヤーのカードを横取り |
| `leave_room` | `{}` | ルームから退出 |

#### サーバー → クライアント

| イベント | データ | 説明 |
|---------|--------|------|
| `room_created` | `{room_id}` | ルーム作成完了 |
| `player_joined` | `{nickname, player_count}` | プレイヤー参加 |
| `game_started` | `{players, deck_count, first_player}` | ゲーム開始 |
| `card_drawn` | `{player, card, field}` | カードが引かれた |
| `cards_scored` | `{player, cards, score}` | 得点化が発生 |
| `burst` | `{player, lost_cards}` | バーストが発生 |
| `card_stolen` | `{from_player, to_player, card}` | 横取りが発生 |
| `turn_changed` | `{current_player}` | ターン変更 |
| `game_state` | `{fields, deck_count, scores, current_player}` | ゲーム状態更新 |
| `game_ended` | `{winner, rankings}` | ゲーム終了 |
| `error` | `{message, code}` | エラー通知 |

## デプロイ（Fly.io）

詳細な手順は [docs/deploy-flyio.md](docs/deploy-flyio.md) を参照してください。

## 今後の開発予定

- [ ] だるまあつめのゲーム実装
- [ ] チャット機能
- [ ] リプレイ機能
- [ ] ランキングシステム
- [ ] ユーザー登録・ログイン（オプション）
- [ ] スペクテーターモード
- [ ] パフォーマンス最適化
- [ ] 自動テスト追加

## ライセンス

MIT License

---

**開発ドキュメント**: 詳細な技術仕様やAPI設計は `/docs` ディレクトリを参照してください。
