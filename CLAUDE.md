# NEKO KONEKO 公式サイト(未公開・PC 内のみ)

依存ゼロの静的サイトジェネレーター。QEI の公式サイト(`A:\Claude\artist\qei-site`)を 2026-10-27 に複製し、NEKO KONEKO 用にしたもの。
設計書・実装計画・公開禁止語の一覧は非公開の NEKO KONEKO Release Manager リポジトリの `docs/` にある。

## 守ること
- **まだ公開しない(2026-10-27 ユーザー指示)。** GitHub に登録しない・リモートを付けない・GitHub Pages の設定(`.github/workflows`・`CNAME`)を置かない。公開するかはユーザーと改めて相談する
- 公開する場合は Public リポジトリになる前提で書く: コード・テスト・コミットメッセージ・`data/` に、使用した制作ツール名・本名を書かない
- **AI 制作であることは公言するが、制作ツール名は出さない。** 本名・ISRC・UPC・歌詞・制作情報も出さない
- 公開禁止語は `src/forbidden.mjs` に SHA-256 だけを置き、`build()` が生成 HTML を照合する(QEI と同じハッシュ。同じ制作者・同じ制作方法のため)。語を追加するときは RM 側の一覧を更新し、ハッシュだけをここに足す
- `data/site.json`・`assets/artwork/`・`assets/logo.jpg` は NEKO KONEKO Release Manager の「書き出しのみ」が上書きする。手で編集しない(曲情報は RM で直す)
- 手で編集するのは `data/news.json`(お知らせ)と `data/profile.json`(X・配信サービスのアーティストページ `artistLinks`・連絡先・レーベル名・プロフィール文 `profile`・AI 公言文)だけ
- `data/profile.json` の未定の項目は空文字のままにする(推測で埋めない)。空の項目は画面に出ない(X・Contact セクション・OGP の絶対 URL など)
- 見た目は CLUB RED(黒地に赤、見出しは Dela Gothic One、ジャケットと顔の周りだけ赤い光)。ライトモードなし。npm 依存を追加しない
- 出力先 `site/` は git 管理外

## コマンド
- `npm test` / `npm run build`
- ローカル確認: `npm run build` → `python -m http.server 8080 -d site` → http://localhost:8080
