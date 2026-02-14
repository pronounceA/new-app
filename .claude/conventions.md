# コーディング規約

## Python / FastAPI

### 基本ルール
- Python 3.11+ の機能を積極的に使用する
- 型ヒントは必須（引数・戻り値すべてに付ける）
- 非同期処理は `async/await` を使用する（FastAPIの恩恵を最大化）
- 1関数は1つの責務のみ持つ

### 命名規則
| 対象 | 規則 | 例 |
|------|------|----|
| ファイル | snake_case | `game_service.py` |
| 関数・変数 | snake_case | `get_room_state()` |
| クラス | PascalCase | `GameService` |
| 定数 | UPPER_SNAKE_CASE | `MAX_PLAYERS = 10` |

### Pydantic
- 入力データは必ずPydanticモデルでバリデーションする
- レスポンスモデルも定義し、APIの型安全性を保証する

```python
# Good
class PlayCardRequest(BaseModel):
    card_id: str

# Bad
async def play_card(data: dict):  # dict はNG
```

### ディレクトリ別の責務
| ディレクトリ | 責務 |
|-------------|------|
| `app/websocket/` | WebSocket接続管理・イベントルーティング |
| `app/models/` | Pydanticモデル定義のみ（ロジックを持たない） |
| `app/services/` | ゲームロジック（Redis操作を含む） |
| `app/redis/` | Redis接続・低レベルのCRUD操作 |

### テスト（pytest）
- テストファイル名: `test_{対象ファイル名}.py`
- テスト関数名: `test_{テスト内容}` （日本語コメントで補足可）
- WebSocketのテストは `pytest-asyncio` を使用

---

## TypeScript / React

### 基本ルール
- `any` 型の使用禁止
- `null` チェックは Optional chaining（`?.`）と Nullish coalescing（`??`）を使用
- `useEffect` の依存配列は必ず正確に記載する

### 命名規則
| 対象 | 規則 | 例 |
|------|------|----|
| コンポーネントファイル | PascalCase | `GameBoard.tsx` |
| hooks・utils ファイル | camelCase | `useWebSocket.ts` |
| 型定義ファイル | PascalCase or camelCase | `GameTypes.ts` |
| コンポーネント名 | PascalCase | `const GameBoard: React.FC` |
| カスタムhook | `use` プレフィックス | `useWebSocket()` |
| 定数 | UPPER_SNAKE_CASE | `MAX_PLAYERS` |

### コンポーネント定義スタイル
```typescript
// Good: アロー関数 + 明示的な型
const GameBoard: React.FC<GameBoardProps> = ({ players, cards }) => {
  return <div>...</div>;
};

export default GameBoard;
```

### WebSocket通信
- WebSocket通信ロジックは `src/services/` に集約する
- コンポーネントからは `src/hooks/useWebSocket.ts` 経由でのみ使用する
- イベントの型定義は `src/types/` に集約する

```typescript
// src/types/websocket.ts にイベント型を定義
type WebSocketEvent =
  | { type: "room_created"; payload: { room_id: string } }
  | { type: "player_joined"; payload: { nickname: string; player_count: number } }
  // ...
```

### ディレクトリ別の責務
| ディレクトリ | 責務 |
|-------------|------|
| `src/components/` | 再利用可能なUIコンポーネント（ロジックを持たない） |
| `src/pages/` | ページ単位のコンポーネント（ルーティングの単位） |
| `src/hooks/` | カスタムフック（ロジックのカプセル化） |
| `src/services/` | WebSocket通信・外部通信ロジック |
| `src/types/` | 型定義（WebSocketイベント型・ゲーム状態型等） |

### テスト（Vitest + Testing Library）
- テストファイル: `{対象}.test.tsx`
- コンポーネントテスト: `@testing-library/react` を使用
- WebSocketのモック: `vi.mock()` を使用

---

## WebSocketイベント設計規約

### 命名規則
- イベント名は `snake_case`
- クライアント → サーバー: **動詞_名詞**（命令形）
  - 例: `play_card`, `join_room`, `create_room`, `leave_room`
- サーバー → クライアント: **名詞_過去形**（完了通知）
  - 例: `card_played`, `player_joined`, `room_created`, `game_started`

### メッセージフォーマット
```json
{
  "type": "play_card",
  "payload": {
    "card_id": "heart_7"
  }
}
```

### エラーレスポンス
```json
{
  "type": "error",
  "payload": {
    "message": "あなたのターンではありません",
    "code": "NOT_YOUR_TURN"
  }
}
```

---

## コミットメッセージ

```
<type>: <概要（日本語可）>

<任意: 詳細説明>
```

| type | 用途 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメント変更 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テスト追加・修正 |
| `chore` | ビルド設定・依存関係更新等 |

例:
```
feat: ゲーム終了時の勝者通知を実装

- game_ended イベントを追加
- Redis上のゲーム状態をクリアする処理を追加
```

---

## コードスタイルツール

### Python
- フォーマッター: `black`
- リンター: `ruff`
- 型チェック: `mypy`

```powershell
docker-compose exec backend black app/
docker-compose exec backend ruff check app/
docker-compose exec backend mypy app/
```

### TypeScript
- フォーマッター: `prettier`
- リンター: `eslint`

```powershell
docker-compose exec frontend npm run lint
docker-compose exec frontend npm run format
```
