/**
 * Original bead templates drawn for this project (数豆格), not traced from any
 * existing character, brand or game. Released with the rest of the app under
 * AGPL-3.0; patterns made from them belong to whoever makes them.
 * '.' is an empty cell; other letters index TEMPLATE_COLORS. Colors are matched
 * to the chosen brand's palette when the template is loaded.
 */

export const TEMPLATE_AUTHOR = "数豆格原创";
export const TEMPLATE_LICENSE = "AGPL-3.0（成品可自由使用）";

export const TEMPLATE_COLORS: Record<string, string> = {
  "Y": "#F7D23E",
  "G": "#2E8B3E",
  "g": "#6CC04A",
  "R": "#D7263D",
  "B": "#7A4A2A",
  "W": "#FFFFFF",
  "K": "#2B2B2B",
  "O": "#F28C28",
  "P": "#F4A6B8",
  "S": "#C98B55",
  "L": "#9ED8F0",
  "U": "#2F6FD0",
  "N": "#9A9A9A"
};

export interface BeadTemplate {
  id: string;
  name: string;
  category: "节日" | "宠物" | "美食";
  rows: string[];
}

export const TEMPLATES: BeadTemplate[] = [
  {
    "id": "xmas-tree",
    "name": "圣诞树",
    "category": "节日",
    "rows": [
      "........Y........",
      ".......YYY.......",
      "........Y........",
      ".......GGG.......",
      "......GGRGG......",
      ".....GGGGGgG.....",
      "......GgGGG......",
      ".....GGGGUGGG....",
      "....GRGGGGGGgG...",
      ".....GGGgGGGG....",
      "....GGGGGGRGGG...",
      "...GGYGGGGGGGGG..",
      "..GGGGGGgGGGGUGG.",
      "...GGGGGGGGGGGG..",
      "..GGUGGGGGYGGGGG.",
      ".GGGGGGRGGGGGGGgG",
      "......BBBBB......",
      "......BBBBB......"
    ]
  },
  {
    "id": "snowman",
    "name": "雪人",
    "category": "节日",
    "rows": [
      "......KKKK......",
      "......KKKK......",
      ".....KKKKKK.....",
      "....KKRRRRKK....",
      ".....WWWWWW.....",
      "....WWKWWKWW....",
      "....WWWOOWWW....",
      "....WWWWWWWW....",
      ".....WWWWWW.....",
      "...RRRRRRRRRR...",
      "....WWWRRWWW....",
      "...WWWWRRWWWW...",
      "..WWWWWKWWWWWW..",
      "..WWWWWWWWWWWW..",
      "..WWWWWKWWWWWW..",
      "...WWWWWWWWWW...",
      "....WWWWWWWW...."
    ]
  },
  {
    "id": "gingerbread",
    "name": "姜饼人",
    "category": "节日",
    "rows": [
      ".....SSSSS.....",
      "....SSSSSSS....",
      "....SKSSSKS....",
      "....SSSSSSS....",
      "....SSWWWSS....",
      ".....SSSSS.....",
      "..SSSSSSSSSSS..",
      ".SSWSSSRSSSWSS.",
      ".SS.SSSSSSS.SS.",
      "....SSSRSSS....",
      "....SSSSSSS....",
      "....SSSRSSS....",
      "...SSSS.SSSS...",
      "..SSSS...SSSS..",
      "..SWSS...SSWS..",
      "..SSS.....SSS.."
    ]
  },
  {
    "id": "stocking",
    "name": "圣诞袜",
    "category": "节日",
    "rows": [
      "...WWWWWWW....",
      "...WWWWWWW....",
      "...WWWWWWW....",
      "...RRRRRRR....",
      "...RRGRRRR....",
      "...RRRRRGR....",
      "...RRRRRRR....",
      "...RGRRRRR....",
      "...RRRRRRR....",
      "..RRRRRGRRR...",
      ".RRRRRRRRRRR..",
      "RRGRRRRRRRWW..",
      "RRRRRRRRRWWW..",
      ".RRRRRRRRWW...",
      "..RRRRRRR....."
    ]
  },
  {
    "id": "gift",
    "name": "礼物盒",
    "category": "节日",
    "rows": [
      "....RR...RR....",
      "...R..R.R..R...",
      "...R...R...R...",
      "....RRRRRRR....",
      ".UUUUUURUUUUUU.",
      ".UUUUUURUUUUUU.",
      ".RRRRRRRRRRRRR.",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU..",
      "..UUUUURUUUUU.."
    ]
  },
  {
    "id": "bell",
    "name": "铃铛",
    "category": "节日",
    "rows": [
      ".GG.....GG.",
      "GGGG.R.GGGG",
      ".GGRRRRRGG.",
      "....YYY....",
      "...YYYYY...",
      "..YYWYYYY..",
      "..YWYYYYY..",
      "..YYYYYYY..",
      ".YYYYYYYYY.",
      ".YYYYYYYYY.",
      "YYYYYYYYYYY",
      "OOOOOOOOOOO",
      "....OOO...."
    ]
  },
  {
    "id": "cat",
    "name": "小猫",
    "category": "宠物",
    "rows": [
      ".K.........K.",
      ".KK.......KK.",
      ".KPK.....KPK.",
      ".KKKKKKKKKKK.",
      "KKKKKKKKKKKKK",
      "KKYYKKKKKYYKK",
      "KKYKKKKKKKYKK",
      "KKKKKKPKKKKKK",
      "WKKKKWWWKKKKW",
      "KKKKKKKKKKKKK",
      ".KKKKKKKKKKK.",
      "..KKKKKKKKK.."
    ]
  },
  {
    "id": "dog",
    "name": "小狗",
    "category": "宠物",
    "rows": [
      "..BB.....BB..",
      ".BBBSSSSSBBB.",
      ".BBSSSSSSSBB.",
      ".BBSKSSSKSBB.",
      ".BBSSSSSSSBB.",
      "..BSSWWWSSB..",
      "...SWWKWWS...",
      "...SWWWWWS...",
      "....SWPWS....",
      ".....SSS....."
    ]
  },
  {
    "id": "strawberry",
    "name": "草莓",
    "category": "美食",
    "rows": [
      ".....G.G.....",
      "...GGGGGGG...",
      "..RRGGGGGRR..",
      ".RRRRRRRRRRR.",
      ".RRWRRRRWRRR.",
      ".RRRRRWRRRRR.",
      "..RRWRRRRWR..",
      "..RRRRRRRRR..",
      "...RRRWRRR...",
      "....RRRRR....",
      ".....RRR....."
    ]
  },
  {
    "id": "donut",
    "name": "甜甜圈",
    "category": "美食",
    "rows": [
      "....SSSSS....",
      "..SPPPPPPPS..",
      ".SPPYPPPLPPS.",
      ".PPPPPP.PPPP.",
      "SPLPP...PPUPS",
      "SPPP.....PPPS",
      "SPPPP...PPPPS",
      ".SPPPP.PYPPS.",
      ".SSPUPPPPPSS.",
      "..SSSSSSSSS..",
      "....SSSSS...."
    ]
  }
];

/** Original 5×7 glyphs for the name-tag generator. */
export const GLYPHS: Record<string, string[]> = {
"A": [
".###.",
"#...#",
"#...#",
"#####",
"#...#",
"#...#",
"#...#"
],
"B": [
"####.",
"#...#",
"#...#",
"####.",
"#...#",
"#...#",
"####."
],
"C": [
".####",
"#....",
"#....",
"#....",
"#....",
"#....",
".####"
],
"D": [
"####.",
"#...#",
"#...#",
"#...#",
"#...#",
"#...#",
"####."
],
"E": [
"#####",
"#....",
"#....",
"####.",
"#....",
"#....",
"#####"
],
"F": [
"#####",
"#....",
"#....",
"####.",
"#....",
"#....",
"#...."
],
"G": [
".####",
"#....",
"#....",
"#.###",
"#...#",
"#...#",
".###."
],
"H": [
"#...#",
"#...#",
"#...#",
"#####",
"#...#",
"#...#",
"#...#"
],
"I": [
"#####",
"..#..",
"..#..",
"..#..",
"..#..",
"..#..",
"#####"
],
"J": [
"..###",
"...#.",
"...#.",
"...#.",
"...#.",
"#..#.",
".##.."
],
"K": [
"#...#",
"#..#.",
"#.#..",
"##...",
"#.#..",
"#..#.",
"#...#"
],
"L": [
"#....",
"#....",
"#....",
"#....",
"#....",
"#....",
"#####"
],
"M": [
"#...#",
"##.##",
"#.#.#",
"#.#.#",
"#...#",
"#...#",
"#...#"
],
"N": [
"#...#",
"##..#",
"#.#.#",
"#.#.#",
"#..##",
"#...#",
"#...#"
],
"O": [
".###.",
"#...#",
"#...#",
"#...#",
"#...#",
"#...#",
".###."
],
"P": [
"####.",
"#...#",
"#...#",
"####.",
"#....",
"#....",
"#...."
],
"Q": [
".###.",
"#...#",
"#...#",
"#...#",
"#.#.#",
"#..#.",
".##.#"
],
"R": [
"####.",
"#...#",
"#...#",
"####.",
"#.#..",
"#..#.",
"#...#"
],
"S": [
".####",
"#....",
"#....",
".###.",
"....#",
"....#",
"####."
],
"T": [
"#####",
"..#..",
"..#..",
"..#..",
"..#..",
"..#..",
"..#.."
],
"U": [
"#...#",
"#...#",
"#...#",
"#...#",
"#...#",
"#...#",
".###."
],
"V": [
"#...#",
"#...#",
"#...#",
"#...#",
".#.#.",
".#.#.",
"..#.."
],
"W": [
"#...#",
"#...#",
"#...#",
"#.#.#",
"#.#.#",
"##.##",
"#...#"
],
"X": [
"#...#",
".#.#.",
".#.#.",
"..#..",
".#.#.",
".#.#.",
"#...#"
],
"Y": [
"#...#",
"#...#",
".#.#.",
"..#..",
"..#..",
"..#..",
"..#.."
],
"Z": [
"#####",
"....#",
"...#.",
"..#..",
".#...",
"#....",
"#####"
],
"0": [
".###.",
"#...#",
"#..##",
"#.#.#",
"##..#",
"#...#",
".###."
],
"1": [
"..#..",
".##..",
"..#..",
"..#..",
"..#..",
"..#..",
".###."
],
"2": [
".###.",
"#...#",
"....#",
"...#.",
"..#..",
".#...",
"#####"
],
"3": [
"####.",
"....#",
"....#",
".###.",
"....#",
"....#",
"####."
],
"4": [
"...#.",
"..##.",
".#.#.",
"#..#.",
"#####",
"...#.",
"...#."
],
"5": [
"#####",
"#....",
"####.",
"....#",
"....#",
"#...#",
".###."
],
"6": [
".###.",
"#....",
"#....",
"####.",
"#...#",
"#...#",
".###."
],
"7": [
"#####",
"....#",
"...#.",
"..#..",
".#...",
".#...",
".#..."
],
"8": [
".###.",
"#...#",
"#...#",
".###.",
"#...#",
"#...#",
".###."
],
"9": [
".###.",
"#...#",
"#...#",
".####",
"....#",
"....#",
".###."
],
"♥": [
".#.#.",
"#####",
"#####",
"#####",
".###.",
"..#..",
"....."
]
};
