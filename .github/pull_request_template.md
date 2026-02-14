## 変更内容

（何をしたか簡潔に記載）

## 変更理由

（なぜこの変更が必要か）

## 変更の種類

- [ ] 新機能 (`feat`)
- [ ] バグ修正 (`fix`)
- [ ] リファクタリング (`refactor`)
- [ ] ドキュメント (`docs`)
- [ ] テスト (`test`)
- [ ] その他 (`chore`)

## テスト方法

（レビュアーが動作確認するための手順）

```powershell
# 例
docker-compose exec backend python -m pytest tests/test_xxx.py
```

## チェックリスト

- [ ] テストが通っている
- [ ] lintエラーがない
- [ ] `.env` や秘密情報をコミットしていない
- [ ] DBを使用していない（Redisのみ）
- [ ] Pydanticによる型バリデーションを実装している（バックエンド変更時）
- [ ] `any` 型を使用していない（フロントエンド変更時）
- [ ] WebSocketイベント命名規則に従っている（WebSocket変更時）
- [ ] 関連ドキュメントを更新した（`docs/api.md` 等）

## 関連Issue

Closes #
