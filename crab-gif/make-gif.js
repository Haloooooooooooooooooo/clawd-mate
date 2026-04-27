const sharp = require("sharp");
const GIFEncoder = require("gif-encoder-2");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

const spritePath = "sprite.png";

// 👉 你的布局：3列 × 2行
const columns = 3;
const rows = 2;

// 👉 每一块大小（你这张图固定是512）
const sourceFrameWidth = 512;
const sourceFrameHeight = 512;

// 👉 输出尺寸
const outputSize = 128;

// 👉 动画速度（100ms）
const delay = 100;

const frameDir = "frames";

if (!fs.existsSync(frameDir)) {
  fs.mkdirSync(frameDir);
}

async function cutFrames() {
  let index = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const left = col * sourceFrameWidth;
      const top = row * sourceFrameHeight;

      const outputPath = path.join(
        frameDir,
        `frame${index}.png`
      );

      await sharp(spritePath)
        .extract({
          left,
          top,
          width: sourceFrameWidth,
          height: sourceFrameHeight,
        })
        .resize(outputSize, outputSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ 已生成 ${outputPath}`);
      index++;
    }
  }
}

async function makeGif() {
  const encoder = new GIFEncoder(outputSize, outputSize);

  encoder.setDelay(delay);
  encoder.setRepeat(0);
  encoder.setQuality(10);

  const stream = encoder.createReadStream();
  stream.pipe(fs.createWriteStream("crab.gif"));

  encoder.start();

  const canvas = createCanvas(outputSize, outputSize);
  const ctx = canvas.getContext("2d");

  for (let i = 1; i <= 6; i++) {
    ctx.clearRect(0, 0, outputSize, outputSize);

    const img = await loadImage(path.join(frameDir, `frame${i}.png`));
    ctx.drawImage(img, 0, 0, outputSize, outputSize);

    encoder.addFrame(ctx);
  }

  encoder.finish();

  console.log("🎉 GIF生成完成：crab.gif");
}

async function main() {
  await cutFrames();
  await makeGif();
}

main();