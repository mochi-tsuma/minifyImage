# minifyImage
png及びjpgのwebp変換とtinyPngAPIを使用した圧縮用。
※自分用ですが、誰かの役にたてば嬉しいです。

# 前提
- Mac環境前提
- node.js 20以上
    - pnpmも使用していますが、npmだけでも動きます。
- TinyPNGのAPI Keyは個別に取得
    - API KEY取得後に.envを作成して `TINYPNG_API_KEY=`の後ろに取得したkeyを設定

# 使用方法
1. before内に圧縮したい画像を格納
2. run.command(Windowsならrun.bat)をダブルクリックして実行
    - desktop上で実行前提なのでパスは必要に応じて変えてください
    - Macの場合初回うまく行かないときはディレクトリ直下で `chmod +x run.command`を実行
    - 直接node.jsで動かす場合はディレクトリ直下で `node badge.js`を入力して実行

# その他
画像圧縮後に元画像を自動で削除したい場合はbadge.jsの下の方に`clearBeforeDir()`という関数があるのでコメント外すと自動で削除されます。
