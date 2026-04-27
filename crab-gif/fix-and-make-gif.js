const { createCanvas, loadImage } = require("canvas");
const GIFEncoder = require("gif-encoder-2");
const fs = require("fs");

const SIZE = 128;      // 最终尺寸
const DELAY = 100;     // 动画速度

async function makeGif() {
  const encoder = new GIFEncoder(SIZE, SIZE);
  encoder.setDelay(DELAY);
  encoder.setRepeat(0);

  const stream = encoder.createReadStream();
  stream.pipe(fs.createWriteStream("crab-fixed.gif"));

  encoder.start();

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  for (let i = 1; i <= 6; i++) {
    ctx.clearRect(0, 0, SIZE, SIZE);

    const img = await loadImage(`frames/frame${i}.png`);

    // 🔥 核心：强制居中
    const x = (SIZE - img.width) / 2;
    const y = (SIZE - img.height) / 2;

    ctx.drawImage(img, x, y);

    encoder.addFrame(ctx);
  }

  encoder.finish();

  console.log("✅ 已生成 crab-fixed.gif");
}

makeGif();