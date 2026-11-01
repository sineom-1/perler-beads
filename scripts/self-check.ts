import { colorDistance, findClosest } from "../src/lib/color";
import { displayCode, getColorByHex, getPalette, paletteCount } from "../src/lib/palette";
import { buildPattern, removeBorderBackground, tally } from "../src/lib/pixelate";

async function main() {
  const red = { r: 253, g: 84, b: 61 };
  const blue = { r: 15, g: 84, b: 192 };
  if (colorDistance(red, red, "ciede2000") !== 0) throw new Error("CIEDE2000 相同色应为 0");
  if (colorDistance(red, red, "oklab") !== 0) throw new Error("Oklab 相同色应为 0");
  const blackWhite = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, "ciede2000");
  const redBlue = colorDistance(red, blue, "ciede2000");
  const oklabRedBlue = colorDistance(red, blue, "oklab");
  if (blackWhite < 90 || blackWhite > 110) throw new Error(`黑白 CIEDE2000 异常: ${blackWhite}`);
  if (redBlue < 30) throw new Error(`红蓝 CIEDE2000 过小: ${redBlue}`);
  if (oklabRedBlue <= 0) throw new Error("Oklab 距离异常");

  if (paletteCount("72") !== 72) throw new Error(`72 色数量 ${paletteCount("72")}`);
  if (getPalette("72").length !== 72) throw new Error("72 色板解析失败");
  if (getPalette("168").length !== 168) throw new Error(`168 色数量 ${getPalette("168").length}`);
  if (getPalette("291").length !== 291) throw new Error(`291 色数量 ${getPalette("291").length}`);
  if (displayCode("#FD543D", "MARD") !== "A14") throw new Error("MARD 色号映射错误");
  if (displayCode("#FD543D", "COCO") !== "C05") throw new Error("COCO 色号映射错误");
  if (displayCode("#FD543D", "漫漫") !== "B14") throw new Error("漫漫色号映射错误");

  const width = 12;
  const height = 12;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const border = x < 2 || y < 2 || x >= 10 || y >= 10;
      const rgb = border ? [253, 251, 255] : [253, 84, 61];
      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = 255;
    }
  }

  const pattern = await buildPattern(
    { width, height, data },
    {
      cols: 12,
      rows: 12,
      palette: getPalette("291"),
      mode: "dominant",
      threshold: 0,
      metric: "oklab",
    },
  );
  const center = pattern.grid[6][6];
  if (center.hex !== "#FD543D" || center.key !== "A14") {
    throw new Error(`中心色错误 ${center.key} ${center.hex}`);
  }
  if (pattern.total !== 12 * 12) throw new Error(`总数错误 ${pattern.total}`);

  const removed = removeBorderBackground(pattern.grid);
  if (removed.hex !== "#FDFBFF") throw new Error(`背景色错误 ${removed.hex}`);
  if (removed.removed !== 80) throw new Error(`去背景格数错误 ${removed.removed}`);
  const after = tally(removed.grid);
  if (after.total !== 64) throw new Error(`去背景后总数 ${after.total}`);
  if (after.counts.length !== 1 || after.counts[0].key !== "A14") {
    throw new Error("去背景后应只剩红色");
  }

  const full = getPalette("291").filter((color) => color.key !== "B08");
  const b08 = getColorByHex("#1C9C4F");
  if (!b08) throw new Error("缺少 B08");
  const remapped = findClosest(b08.rgb, full, "oklab");
  if (remapped.key !== "B07") {
    throw new Error(`排除 B08 应落到 B07，实际 ${remapped.key}`);
  }

  const side = 24;
  const pixels = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const index = (y * side + x) * 4;
      const face = x >= 4 && x < 20 && y >= 4 && y < 20;
      const rgb = face ? [255, 200, 0] : [255, 255, 255];
      pixels[index] = rgb[0];
      pixels[index + 1] = rgb[1];
      pixels[index + 2] = rgb[2];
      pixels[index + 3] = 255;
    }
  }
  const smiley = await buildPattern(
    { width: side, height: side, data: pixels },
    {
      cols: side,
      rows: side,
      palette: getPalette("168"),
      mode: "dominant",
      threshold: 30,
      metric: "oklab",
    },
  );
  const yellow = smiley.counts.find((item) => item.key === "A26");
  const white = smiley.counts.find((item) => item.key === "T01");
  if (!yellow || yellow.count !== 16 * 16) {
    throw new Error(`黄脸被吞掉了 ${yellow?.count ?? 0}`);
  }
  if (!white || white.count !== side * side - 16 * 16) {
    throw new Error(`白底数量错误 ${white?.count ?? 0}`);
  }
  const peeled = removeBorderBackground(smiley.grid);
  const peeledTally = tally(peeled.grid);
  if (peeledTally.total !== 16 * 16 || peeledTally.counts[0]?.key !== "A26") {
    throw new Error("去背景不应剥掉黄脸");
  }

  console.log(
    JSON.stringify({
      ok: true,
      ciede2000BlackWhite: Number(blackWhite.toFixed(2)),
      ciede2000RedBlue: Number(redBlue.toFixed(2)),
      oklabRedBlue: Number(oklabRedBlue.toFixed(2)),
      palette168: getPalette("168").length,
      removed: removed.removed,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
