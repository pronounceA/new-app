# プロジェクト概要

WebSocketを使用したリアルタイム通信により、2〜10人が同時にカードゲームをプレイできるWebアプリケーション。
DBは使用せず、Redisのみで全ゲーム状態を管理する設計。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Python 3.11+, FastAPI, WebSocket（FastAPI内蔵）, Pydantic |
| フロントエンド | React 18+, TypeScript, Vite, Tailwind CSS |
| データストア | Redis（インメモリ・DBなし） |
| インフラ | Docker, Docker Compose |

## ディレクトリ構成

```
new-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # エントリーポイント
│   │   ├── websocket/       # WebSocket接続管理・イベントハンドラー
│   │   ├── models/          # Pydanticデータモデル
│   │   ├── services/        # ゲームロジック
│   │   └── redis/           # Redis接続・操作
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # UIコンポーネント（PascalCase）
│   │   ├── pages/           # ページコンポーネント
│   │   ├── hooks/           # カスタムフック（use〜）
│   │   ├── services/        # WebSocket通信ロジック
│   │   └── types/           # 型定義
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

## 開発環境

### 起動
```bash
docker-compose up -d
```

| サービス | URL |
|---------|-----|
| フロントエンド | http://localhost:3000 |
| バックエンドAPI | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

### よく使うコマンド
```powershell
docker-compose logs -f backend      # バックエンドログ
docker-compose logs -f frontend     # フロントエンドログ
docker-compose exec backend python -m pytest   # テスト実行
docker-compose down                 # 停止
docker-compose up -d --build        # 再ビルドして起動
```

## コーディング規約

### Python / FastAPI
- 非同期処理は `async/await` を使用する
- データモデルは必ずPydanticで定義する
- ファイル・変数・関数名は `snake_case`
- WebSocketハンドラーは `app/websocket/` に集約する
- 依存性注入（`Depends`）を積極的に使用する

### TypeScript / React
- コンポーネント名・ファイル名は `PascalCase`
- hooks・utils のファイル名は `camelCase`
- WebSocket通信は `services/` に集約し、カスタムhookでラップする
- `any` 型の使用禁止。型定義は `types/` に集約するか同一ファイルに記載する
- コンポーネントはアロー関数で定義する（`const Foo: React.FC = () => {}`）

### WebSocketイベント命名
- イベント名は `snake_case`
- クライアント → サーバー: 動詞_名詞（例: `play_card`, `join_room`）
- サーバー → クライアント: 名詞_過去形（例: `card_played`, `player_joined`）

### コミットメッセージ
```
feat: 新機能
fix: バグ修正
docs: ドキュメント
refactor: リファクタリング
test: テスト
chore: その他（依存関係更新等）
```

## 設計上の制約

- **DBは使用しない**: 全ゲーム状態はRedisのみで管理する
- **認証はニックネームのみ**: 本格的なユーザー登録は将来対応
- **同時接続**: 1ルームあたり最大6人
- **WebSocketのみ**: ゲーム中の操作はすべてWebSocket経由で行う

## 環境変数

**バックエンド** (`backend/.env`):
```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
CORS_ORIGINS=http://localhost:3000
```

**フロントエンド** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## ゲームルール概要

### カード構成
- 数字: 1〜10
- 1〜5: 各13枚、6〜10: 各9枚、合計110枚
- 手札はなし（引いたカードは直接自分の場に置かれる）

### ターン構造
1. **得点化**（場にカードがある場合は必須）: 場のカードを得点に変換して場を空にする
2. **カードを引く**: 山札からカードを1枚引き、自分の場に置く
3. **通常 or バースト**:
   - **通常**: ターン終了
   - **バースト**: 場に3枚以上ある状態で、引いたカードの数字が場の既存カードと一致した場合 → 場のカードをすべて失う（得点化不可）

### 横取り
- 引いたカードの数字が別プレイヤーの場にあるカードと一致する場合、任意でそのカードを横取りできる
- 横取りしたカードは自分の得点に加算される

### 勝利条件
- 山札がなくなった時点で最も得点が高いプレイヤーが勝利

## 参考ドキュメント

- `.claude/architecture.md` - システム構成・API仕様詳細
- `.claude/project_context.md` - ビジネスコンテキスト・ゲームフロー
- `.claude/conventions.md` - コーディング規約詳細
- `CONTRIBUTING.md` - 開発参加ガイド
