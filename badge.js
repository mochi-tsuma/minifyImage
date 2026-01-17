/**
 * badge.js
 * 入力:  A/before
 * 出力:  A/after
 *
 * 仕様:
 * - png  -> jpg + webp を生成
 * - jpg/jpeg -> webp を生成
 * - 生成したファイルは TinyPNG API で圧縮して after に保存（上書き保存）
 */

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
const { glob } = require("glob");

const ROOT = process.cwd();
const BEFORE_DIR = path.join(ROOT, "before");
const AFTER_DIR = path.join(ROOT, "after");

const API_KEY = process.env.TINYPNG_API_KEY;

function isJpeg(ext) {
  return ext === ".jpg" || ext === ".jpeg";
}

function isPng(ext) {
  return ext === ".png";
}

async function ensureDirs() {
  await fs.mkdir(AFTER_DIR, { recursive: true });
}

function baseNameNoExt(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function withExt(outDir, base, ext) {
  return path.join(outDir, `${base}${ext}`);
}

/**
 * TinyPNG 圧縮（Tinify API 互換）
 * https://tinypng.com/developers/reference/nodejs
 *
 * 仕様上、変換済みの出力ファイルを TinyPNG に投げて、
 * 返ってきた圧縮結果を after の同パスに上書きします。
 */
async function tinifyCompressBuffer(inputBuffer) {
  if (!API_KEY) {
    throw new Error("環境変数が設定されていません。");
  }

  const auth = Buffer.from(`api:${API_KEY}`).toString("base64");

  // 1) /shrink にアップロード
  const shrinkRes = await axios.post("https://api.tinify.com/shrink", inputBuffer, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/octet-stream",
    },
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (shrinkRes.status < 200 || shrinkRes.status >= 300) {
    const msg = shrinkRes.data?.message || JSON.stringify(shrinkRes.data);
    throw new Error(`TinyPNG /shrink 失敗: status=${shrinkRes.status} body=${msg}`);
  }

  const outputUrl = shrinkRes.headers.location;
  if (!outputUrl) {
    throw new Error("TinyPNG のレスポンスに Location ヘッダがありません。");
  }

  // 2) 圧縮済みをダウンロード
  const outRes = await axios.get(outputUrl, {
    headers: { Authorization: `Basic ${auth}` },
    responseType: "arraybuffer",
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (outRes.status < 200 || outRes.status >= 300) {
    throw new Error(`TinyPNG ダウンロード失敗: status=${outRes.status}`);
  }

  return Buffer.from(outRes.data);
}

async function writeCompressedFile(outPath, buffer) {
  const compressed = await tinifyCompressBuffer(buffer);
  await fs.writeFile(outPath, compressed);
}

async function clearBeforeDir() {
  const entries = await fs.readdir(BEFORE_DIR);
  for (const entry of entries) {
    const targetPath = path.join(BEFORE_DIR, entry);
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function convertAndCompressOne(srcPath) {
  const ext = path.extname(srcPath).toLowerCase();
  const base = baseNameNoExt(srcPath);

  const tasks = [];

  if (isPng(ext)) {
    // png -> jpg
    const jpgPath = withExt(AFTER_DIR, base, ".jpg");
    tasks.push(
      (async () => {
        const buf = await sharp(srcPath)
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();
        await writeCompressedFile(jpgPath, buf);
        return jpgPath;
      })()
    );

    // png -> webp
    const webpPath = withExt(AFTER_DIR, base, ".webp");
    tasks.push(
      (async () => {
        const buf = await sharp(srcPath)
          .webp({ quality: 85 })
          .toBuffer();
        await writeCompressedFile(webpPath, buf);
        return webpPath;
      })()
    );
  } else if (isJpeg(ext)) {
    // jpg/jpeg -> webp
    const webpPath = withExt(AFTER_DIR, base, ".webp");
    tasks.push(
      (async () => {
        const buf = await sharp(srcPath)
          .webp({ quality: 85 })
          .toBuffer();
        await writeCompressedFile(webpPath, buf);
        return webpPath;
      })()
    );
  } else {
    // 対象外は無視
    return { srcPath, outputs: [], skipped: true };
  }

  const outputs = await Promise.all(tasks);
  return { srcPath, outputs, skipped: false };
}

async function main() {
  await ensureDirs();

  // before 内の png/jpg/jpeg を再帰的に拾う
  const patterns = [
    path.join(BEFORE_DIR, "**/*.png"),
    path.join(BEFORE_DIR, "**/*.jpg"),
    path.join(BEFORE_DIR, "**/*.jpeg"),
  ];
  const filesNested = await Promise.all(patterns.map((p) => glob(p)));
  const files = [...new Set(filesNested.flat())];

  if (files.length === 0) {
    console.log("before 内に対象画像がありません。");
    return;
  }

  console.log(`入力: ${files.length} 件`);
  console.log(`出力先: ${AFTER_DIR}`);

  // 逐次処理（TinyPNG のレート制限対策）
  const results = [];
  for (const f of files) {
    try {
      const r = await convertAndCompressOne(f);
      results.push(r);
      if (r.skipped) {
        console.log(`SKIP: ${path.relative(ROOT, f)}`);
      } else {
        console.log(`OK: ${path.relative(ROOT, f)} -> ${r.outputs.map((o) => path.basename(o)).join(", ")}`);
      }
    } catch (e) {
      console.error(`ERROR: ${path.relative(ROOT, f)} : ${e.message}`);
    }
  }

  const okCount = results.filter((r) => !r.skipped && r.outputs.length).length;
  console.log(`完了: ${okCount}/${files.length}（変換対象ベース）`);

  // 完了後に自動的にbeforeディレクトリを空にする場合はコメント外す
  // await clearBeforeDir();
  // console.log("before ディレクトリを空にしました。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});