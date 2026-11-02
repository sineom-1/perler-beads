import { PDF_DPI, boardAxisNumbers, boardPageHeader, boardPitch, boldGuideOffsets, fitBeadCode, legendCapacity, pitchFits, planBoards, preferredScale } from "../src/lib/boardPdf";
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

  const boards = planBoards(48, 48, 29);
  if (boards.length !== 4) throw new Error(`48 图应按 29 分成 4 板，实际 ${boards.length}`);
  if (boards.map((board) => board.label).join(",") !== "A1,A2,B1,B2") {
    throw new Error(`分板标号错误 ${boards.map((board) => board.label).join(",")}`);
  }
  const edge = boards[3];
  if (edge.row1 - edge.row0 !== 19 || edge.col1 - edge.col0 !== 19) {
    throw new Error("边缘板应保留不足 29 的尺寸");
  }
  if (boardPitch(29) !== "5" || preferredScale(29, "a4") !== "5") throw new Error("29 板在 A4 上应默认 5mm 1:1");
  if (pitchFits(58, "a4", 5) || preferredScale(58, "a4") !== "fit") throw new Error("58 是 5mm 板，A4 放不下时应缩放到页面");
  if (preferredScale(87, "a4") !== "fit") throw new Error("87 板在 A4 上应缩小到页面");
  if (boardPitch(50) !== "2.6" || boardPitch(52) !== "2.6") throw new Error("50/52 应是 2.6mm 迷你板");
  if (preferredScale(50, "a4") !== "2.6" || preferredScale(52, "a4") !== "2.6") {
    throw new Error("50/52 板在 A4 上应默认 2.6mm 1:1");
  }
  const mini50 = planBoards(104, 104, 50);
  if (mini50.length !== 9 || mini50[2].col1 - mini50[2].col0 !== 4) {
    throw new Error("104 图按 50 板应分成 3×3，边缘 4 格");
  }
  const mini52 = planBoards(104, 104, 52);
  if (mini52.map((board) => board.label).join(",") !== "A1,A2,B1,B2") {
    throw new Error(`104 图按 52 板标号错误 ${mini52.map((board) => board.label).join(",")}`);
  }
  if (mini52.some((board) => board.col1 - board.col0 !== 52 || board.row1 - board.row0 !== 52)) {
    throw new Error("104 图按 52 板应是四块整板");
  }
  const perPage = legendCapacity({ w: 210, h: 297 }, 20);
  if (perPage < 60) throw new Error(`采购清单每页容量过小 ${perPage}`);
  if (Math.ceil(180 / perPage) < 2) throw new Error("多色采购清单应分成多页");

  const sheets = planBoards(58, 58, 29);
  const header = boardPageHeader(sheets[2]);
  if (!header.includes("全局行 30–58") || !header.includes("列 1–29")) {
    throw new Error(`分板页眉应保留全局范围 ${header}`);
  }
  if (boardAxisNumbers(sheets[2].row1 - sheets[2].row0).includes(30) || boldGuideOffsets(29)[0] !== 5) {
    throw new Error("加粗线和坐标应从每块板自己的边缘重新计数");
  }
  if (!fitBeadCode("A26", 2.6) || PDF_DPI < 200) throw new Error("2.6mm 1:1 应能放下色号，且页面至少 200dpi");
  const wide = planBoards(30, 60, 58);
  if (wide.length !== 2 || wide[1].col1 - wide[1].col0 !== 2) {
    throw new Error("58 分板应保留右侧不足一块的窄板");
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
