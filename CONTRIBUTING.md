# コントリビューションガイド

このドキュメントは開発に参加するための手順・ルールをまとめています。

---

## 開発環境セットアップ

### 前提条件

| ツール | バージョン |
|--------|-----------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| Git | 任意の最新版 |

### 手順

```powershell
# 1. リポジトリをクローン
git clone <repository-url>
cd new-app

# 2. 環境変数ファイルを作成
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
# 必要に応じて .env を編集する

# 3. Docker Composeで起動
docker-compose up -d

# 4. 動作確認
# フロントエンド: http://localhost:3000
# バックエンドAPI: http://localhost:8000
# Swagger UI:  http://localhost:8000/docs
```

### ローカル開発（ホットリロード）

起動後、コードを変更すると自動で反映されます。

- **バックエンド**: FastAPIの `--reload` オプションにより自動再起動
- **フロントエンド**: ViteのHMR（Hot Module Replacement）により即座に反映

---

## ブランチ運用

### ブランチ命名規則

```
<type>/<簡潔な説明>
```

| type | 用途 | 例 |
|------|------|----|
| `feature` | 新機能 | `feature/chat-function` |
| `fix` | バグ修正 | `fix/websocket-disconnect` |
| `docs` | ドキュメント | `docs/api-spec` |
| `refactor` | リファクタリング | `refactor/game-service` |
| `test` | テスト追加 | `test/play-card-handler` |

### ブランチフロー

```
main（本番）
  └── develop（開発統合）
        └── feature/xxx（各機能）
```

1. `develop` から作業ブランチを切る
2. 実装・テストが完了したら `develop` にPRを出す
3. レビュー通過後にマージ
4. リリース時に `develop` → `main` にマージ

---

## プルリクエスト（PR）

### 作成前チェックリスト

- [ ] テストが通っている（`docker-compose exec backend python -m pytest`）
- [ ] lintエラーがない（`ruff check` / `npm run lint`）
- [ ] `.env` や秘密情報をコミットしていない
- [ ] 変更内容に関連するドキュメントを更新した

### PRの書き方

```
## 変更内容
（何をしたか）

## 変更理由
（なぜ変更が必要か）

## テスト方法
（レビュアーが動作確認する手順）

## 関連Issue
Closes #XXX
```

### レビュー基準

- 設計上の制約（DBなし・Redisのみ）を守っているか
- Pydanticによる型バリデーションが行われているか
- `any` 型を使用していないか（TypeScript）
- 非同期処理が正しく実装されているか
- WebSocketイベント命名規則に従っているか

---

## テスト

### バックエンド（pytest）

```powershell
# 全テスト実行
docker-compose exec backend python -m pytest

# カバレッジ付き
docker-compose exec backend python -m pytest --cov=app

# 特定ファイルのみ
docker-compose exec backend python -m pytest tests/test_game_service.py
```

### フロントエンド（Vitest）

```powershell
# 全テスト実行
docker-compose exec frontend npm run test

# ウォッチモード
docker-compose exec frontend npm run test:watch
```

---

## コードスタイル

### Python

```powershell
# フォーマット（black）
docker-compose exec backend black app/

# リント（ruff）
docker-compose exec backend ruff check app/

# 型チェック（mypy）
docker-compose exec backend mypy app/
```

### TypeScript

```powershell
# フォーマット（prettier）
docker-compose exec frontend npm run format

# リント（eslint）
docker-compose exec frontend npm run lint
```

---

## 環境変数の管理

- `.env` ファイルはGitにコミットしない（`.gitignore` に含める）
- `.env.example` に変数名とサンプル値を記載し、コミットする
- 新しい環境変数を追加した場合は `.env.example` も必ず更新する

---

## よく使うコマンドまとめ

```powershell
# 起動
docker-compose up -d

# ログ確認
docker-compose logs -f backend
docker-compose logs -f frontend

# テスト実行
docker-compose exec backend python -m pytest
docker-compose exec frontend npm run test

# 依存関係追加
docker-compose exec backend pip install <package>   # requirements.txt にも追記
docker-compose exec frontend npm install <package>

# 停止・クリーン
docker-compose down
docker-compose down -v    # ボリュームも削除（Redisデータが消える）

# 再ビルド
docker-compose up -d --build
```
