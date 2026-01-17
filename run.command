# 初回のみターミナルで以下実行(パスは書き換えるか対象ディレクトリ直下まで移動してください)
# chmod +x run.command
set -e
cd "$HOME/Desktop/minifyImage"
node badge.js
osascript -e 'display notification "badge.js finished" with title "Badge Batch"'