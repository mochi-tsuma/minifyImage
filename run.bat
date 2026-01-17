@echo off
REM ---- ユーザー名を自動取得 ----
cd /d "%USERPROFILE%\Desktop\minifyImage"

REM ---- Node.js 実行 ----
node badge.js

REM ---- 実行結果確認用 ----
pause