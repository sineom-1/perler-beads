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
  "N": "#9A9A9A",
  "y": "#FFE98A",
  "r": "#9E1B2C",
  "b": "#B07A4A",
  "p": "#FBD3DE",
  "M": "#E5508A",
  "C": "#FFF1C9",
  "u": "#5BA8E8",
  "D": "#1F2E5C",
  "n": "#D6D6D6",
  "T": "#7FD6B8",
  "V": "#8E5CC6",
  "v": "#C9B3E8"
};

export const TEMPLATE_CATEGORIES = ["节日", "新年", "动物", "美食", "植物", "图标"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface BeadTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
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
      ".....KKKK.....",
      ".....KKKK.....",
      "....KKKKKK....",
      "...KKRRRRKK...",
      "...LWWWWWWL...",
      "..LWWKWWKWWL..",
      "..LWWWOOWWWL..",
      "..LWWWWWWWWL..",
      "...LWWWWWWL...",
      "..RRRRRRRRRR..",
      "..LWWWRRWWWL..",
      ".LWWWWRRWWWWL.",
      "LWWWWWKWWWWWWL",
      "LWWWWWWWWWWWWL",
      "LWWWWWKWWWWWWL",
      ".LWWWWWWWWWWL.",
      "..LWWWWWWWWL..",
      "...LLLLLLLL..."
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
    "category": "动物",
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
    "category": "动物",
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
  },
  {
    "id": "heart",
    "name": "爱心",
    "category": "图标",
    "rows": [
      "..rrr...rrr..",
      ".rRRRr.rRRRr.",
      "rRWWRRrRRRRRr",
      "rRWRRRRRRRRRr",
      "rRRRRRRRRRRRr",
      "rRRRRRRRRRRRr",
      ".rRRRRRRRRRr.",
      "..rRRRRRRRr..",
      "...rRRRRRr...",
      "....rRRRr....",
      ".....rRr.....",
      "......r......"
    ]
  },
  {
    "id": "star",
    "name": "笑脸星星",
    "category": "图标",
    "rows": [
      ".......K.......",
      "......KYK......",
      "......KYK......",
      ".....KYYYK.....",
      "KKKKKKYYYKKKKKK",
      "KYYYYYYYYYYYYYK",
      ".KYYYKYYYKYYYK.",
      "..KYPYYYYYPYK..",
      "...KYYKKKYYK...",
      "...KYYYYYYYK...",
      "..KYYYYKYYYYK..",
      "..KYYYK.KYYYK..",
      ".KYYK.....KYYK.",
      ".KKK.......KKK."
    ]
  },
  {
    "id": "smile",
    "name": "笑脸",
    "category": "图标",
    "rows": [
      "....OOOOOOO....",
      "...OYYYYYYYO...",
      "..OYYYYYYYYYO..",
      ".OYYYYYYYYYYYO.",
      "OYYYYYYYYYYYYYO",
      "OYYYYKYYYKYYYYO",
      "OYYYYKYYYKYYYYO",
      "OYYYYYYYYYYYYYO",
      "OYYPYYYYYYYPYYO",
      "OYYYKYYYYYKYYYO",
      "OYYYYKKKKKYYYYO",
      ".OYYYYYYYYYYYO.",
      "..OYYYYYYYYYO..",
      "...OYYYYYYYO...",
      "....OOOOOOO...."
    ]
  },
  {
    "id": "rainbow",
    "name": "彩虹",
    "category": "图标",
    "rows": [
      "........KKKKKKK........",
      "......KKRRRRRRRKK......",
      "....KKRRROOOOORRRKK....",
      "...KRRROOOOOOOOORRRK...",
      "..KRROOOYYYYYYYOOORRK..",
      ".KRROOYYYgggggYYYOORRK.",
      ".KROOYYgggggggggYYOORK.",
      "KRROOYggguuuuugggYOORRK",
      "KRWWWYguuuKKKuuugYWWWRK",
      "KRWWWgguKK...KKuggWWWRK",
      "WWWWWWWuK.....KuWWWWWWW",
      "WWWWWWWuK.....KuWWWWWWW",
      "KWWWWWKK.......KKWWWWWK"
    ]
  },
  {
    "id": "cloud",
    "name": "笑脸云",
    "category": "图标",
    "rows": [
      ".......uuu.......",
      "......uWWWu......",
      ".....uWWWWWu.....",
      "....uWWWWWWWu....",
      "..uuWWWWWWWWWuu..",
      ".uWWWWWWWWWWWWWu.",
      "uWWWWWKWWWKWWWWWu",
      "uWWWWPWWWWWPWWWWu",
      "uWWWWWWKKKWWWWWWu",
      ".uWWWWWWWWWWWWWu.",
      "..uuuuuuuuuuuuu.."
    ]
  },
  {
    "id": "lantern",
    "name": "红灯笼",
    "category": "新年",
    "rows": [
      "....KYYYYYK....",
      "....KKKKKKK....",
      "...KYYYYYYYK...",
      "...KYYYYYYYK...",
      "...KKRRrRRKK...",
      "..KrRRRrRRRrK..",
      ".KRrRRRrRRRrRK.",
      "KRRrRRRrRRRrRRK",
      "KRRrRRRrRRRrRRK",
      "KRRrRRRrRRRrRRK",
      "KRRrRRRrRRRrRRK",
      "KRRrRRRrRRRrRRK",
      "KRRrRRRrRRRrRRK",
      ".KRrRRRrRRRrRK.",
      "..KrRRRrRRRrK..",
      "...KYYYYYYYK...",
      "...KYYYYYYYK...",
      "....KKKYKKK....",
      ".....KRRRK.....",
      ".....KRRRK.....",
      ".....KrRrK....."
    ]
  },
  {
    "id": "hongbao",
    "name": "红包",
    "category": "新年",
    "rows": [
      "KKKKKKKKKKKKK",
      "KrrrrrrrrrrrK",
      "KRrrrrrrrrrRK",
      "KRRrrrrrrrRRK",
      "KRRRrrrrrRRRK",
      "KRRRRrrrRRRRK",
      "KRRRRYYYRRRRK",
      "KRRRYYYYYRRRK",
      "KRRRYYrYYRRRK",
      "KRRRYYYYYRRRK",
      "KRRRRYYYRRRRK",
      "KRRRRRRRRRRRK",
      "KRRRRRRRRRRRK",
      "KRYRYRYRYRYRK",
      "KRRRRRRRRRRRK",
      "KKKKKKKKKKKKK"
    ]
  },
  {
    "id": "mandarin",
    "name": "大吉橘子",
    "category": "新年",
    "rows": [
      "........KKK....",
      ".......KGgGK...",
      "......KBGGgGK..",
      "...KKKOBOKKK...",
      "..KOOOOOOOOOK..",
      ".KOOyYOOOOOOOK.",
      "KOOyYOOOOOOOOOK",
      "KOOyOOOOOOOOOOK",
      "KOOOOOOOOOOOOOK",
      "KOOOOOOOOOOOOOK",
      "KOOOOOOOOOOOOOK",
      "KOOOOOOOOOOOOOK",
      "KOOOOOOOOOOOOOK",
      ".KOOOOOOOOOOOK.",
      "..KOOOOOOOOOK..",
      "...KKKOOOKKK..."
    ]
  },
  {
    "id": "sheep",
    "name": "小羊（2027）",
    "category": "新年",
    "rows": [
      ".......NNNNNN.......",
      "......NWWWWWWN......",
      "....NNWWWWWWWWNN....",
      "...NWWWWWWWWWWWWN...",
      "..NWWWWWWWWWWWWWWN..",
      "..NWWWWWWWWWWWWWWN..",
      "..NWWWWWCCCCWWWWWN..",
      ".NWWWWWCCCCCCWWWWWN.",
      "NCCCCWCCCCCCCCWCCCCN",
      "NCCCCWCCKCCKCCWCCCCN",
      ".NNWWWCCCCCCCCWWWNN.",
      "..NWWWCPCPPCPCWWWN..",
      "..NWWWWCCKKCCWWWWN..",
      "...NWWWWCCCCWWWWN...",
      "....NNWWWWWWWWNN....",
      "......NWWWWWWN......",
      ".......NNNNNN......."
    ]
  },
  {
    "id": "firework",
    "name": "烟花",
    "category": "新年",
    "rows": [
      "........V........",
      "....O...u...O....",
      "....M...u..M.....",
      ".....M..u..M.....",
      ".V...M..Y..M..uV.",
      "..uu..Y.YYY.uu...",
      "....uY.....Y.....",
      ".....Y..Y........",
      "OMMMYY.YWY.YYMMMO",
      ".....Y..Y..Y.....",
      ".....Y.....Y.....",
      "..uuu.YYYYY.uuu..",
      ".V....M.Y..M...V.",
      ".....M..u..M.....",
      ".....M..u..M.....",
      "....O...u...O....",
      "........V........"
    ]
  },
  {
    "id": "bear",
    "name": "小熊",
    "category": "动物",
    "rows": [
      "..KKK.......KKK..",
      ".KBBBK.KKK.KBBBK.",
      "KBBbBBKBBBKBBbBBK",
      "KBbbBBBBBBBBBbbBK",
      "KBBBBBBBBBBBBBBBK",
      ".KBBBBBBBBBBBBBK.",
      ".KBBBBBBBBBBBBBK.",
      "KBBBBKBBBBBKBBBBK",
      "KBBBBBBBBBBBBBBBK",
      "KBBBBBCCCCCBBBBBK",
      "KBBPBCCKKKCCBPBBK",
      ".KBBBCCCKCCCBBBK.",
      ".KBBBCCCCCCCBBBK.",
      "..KBBBCCCCCBBBK..",
      "...KBBBBBBBBBK...",
      "....KKKBBBKKK...."
    ]
  },
  {
    "id": "bunny",
    "name": "兔子",
    "category": "动物",
    "rows": [
      "...NWWN..NWWN..",
      "...NWWN..NWWN..",
      "..NWWWWNNWWWWN.",
      "..NWPPWNNWPPWN.",
      "..NWPPWNNWPPWN.",
      "..NWPPWNNWPPWN.",
      "..NWPPWNNWPPWN.",
      "..NWPPWNNWPPWN.",
      "..NWWWWNNWWWWN.",
      "...NWWWWWWWWN..",
      "...NWWWWWWWWN..",
      "..NWWWWWWWWWWN.",
      ".NWWWWWWWWWWWWN",
      ".NWWWWWWWWWWWWN",
      "NWWWWKWWWWKWWWW",
      "NWWWWWWMMWWWWWW",
      ".NWPWWWKKWWWPWN",
      ".NWWWWWWWWWWWWN",
      "..NWWWWWWWWWWN.",
      "...NWWWWWWWWN..",
      "....NNWWWWNN...",
      "......NNNN....."
    ]
  },
  {
    "id": "chick",
    "name": "小鸡",
    "category": "动物",
    "rows": [
      "......KK.......",
      ".....KYYK......",
      "....KKKYYKK....",
      "...KYYYYYYYK...",
      "..KYYYYYYYYYK..",
      ".KYYYYYYYYYYYK.",
      ".KYYYYYYYYYYYK.",
      "KYYYYKYYYKYYYYK",
      "KYYYYYYYYYYYYYK",
      "KYYPYYOOOYYPYYK",
      ".KyYYYYOYYYYyK.",
      ".KYyyYYYYYyyYK.",
      "..KYYYYYYYYYK..",
      "...KYYYYYYYK...",
      "....KOKKKOK...."
    ]
  },
  {
    "id": "penguin",
    "name": "企鹅",
    "category": "动物",
    "rows": [
      ".....KKKKK.....",
      "....KDDDDDK....",
      "...KDDDDDDDK...",
      "..KDDDDDDDDDK..",
      ".KDDDDDDDDDDDK.",
      ".KDDWWWWWWWDDK.",
      "KDDDWKWWWKWDDDK",
      "KDDDWWWWWWWDDDK",
      "KDDDWWOOOWWDDDK",
      "KDDWPWWOWWPWDDK",
      "DDDWWWWWWWWWDDD",
      "DKDWWWWWWWWWDKD",
      "KKDDWWWWWWWDDKK",
      "..KDWWWWWWWDK..",
      "...KDWWWWWDK...",
      "....KDWWWDK....",
      "...KOOKKKOOK...",
      "....KK...KK...."
    ]
  },
  {
    "id": "frog",
    "name": "青蛙",
    "category": "动物",
    "rows": [
      "...KKK.....KKK...",
      "..KgggK...KgggK..",
      ".KgWWWgKKKgWWWgK.",
      ".KgWKWgggggWKWgK.",
      ".KgWKWgggggWKWgK.",
      ".KgggggggggggggK.",
      "KgggggggggggggggK",
      "KgggggggggggggggK",
      "KggPgggggggggPggK",
      "KggggGgggggGggggK",
      ".KggggGGGGGggggK.",
      "..KgGGGGGGGGGgK..",
      "...KKgggggggKK..."
    ]
  },
  {
    "id": "whale",
    "name": "小鲸鱼",
    "category": "动物",
    "rows": [
      ".....L.L.L..........",
      "......LLL...........",
      ".......L............",
      "....DDDDDDDD........",
      "..DDuuuuuuuuDD....DD",
      ".DuuuuuuuuuuuuD..DuD",
      "DuuuuuuuuuuuuuuDDuuD",
      "DuuKuuuuuuuuuuuuuuD.",
      "DuPuuuuuuuuuuuuuuD..",
      "DuuuLLLLLLLLLuuuD...",
      ".DLLLLLLLLLLLLLD....",
      "..DDLLLLLLLLLDD.....",
      "....DDDDDDDDD......."
    ]
  },
  {
    "id": "watermelon",
    "name": "西瓜",
    "category": "美食",
    "rows": [
      "GgRRRRRRRRRRRRRRRRRgG",
      "GgRRRRRRRRRRRRRRRRRgG",
      "GgWRRRKRRRRRRRKRRRWgG",
      ".gWRRRRRRRKRRRRRRRWg.",
      ".GWRRKRRRRRRRRRKRRWG.",
      ".GgWRRRRKRRRKRRRRWgG.",
      "..GgWRRRRRRRRRRRWgG..",
      "...GgWRRRRKRRRRWgG...",
      "....GgWWWRRRWWWgG....",
      ".....GGgggggggGG.....",
      "........GGGGG........"
    ]
  },
  {
    "id": "icecream",
    "name": "冰淇淋",
    "category": "美食",
    "rows": [
      "....KKRKK....",
      "..KKPpppPKK..",
      ".KPPpppppPPK.",
      ".KPPpppppyPK.",
      "KPPMPPpPPPPPK",
      "KPPPPPPPPPPPK",
      "KPyPPPPPMPPPK",
      ".KPPPMPPPPPK.",
      ".KPPPPPPPPPK.",
      "KpppppppppppK",
      "KSbSSbSSbSSbK",
      "KbSSbSSbSSbSK",
      ".KSbSSbSSbSK.",
      ".KbSSbSSbSSK.",
      "..KSbSSbSSK..",
      "..KbSSbSSbK..",
      "...KSbSSbK...",
      "...KbSSbSK...",
      "....KSbSK....",
      "....KbSSK....",
      ".....KSK.....",
      "......K......"
    ]
  },
  {
    "id": "milktea",
    "name": "珍珠奶茶",
    "category": "美食",
    "rows": [
      "........KMMK...",
      "........KMMK...",
      "........KMMK...",
      "........KMMK...",
      ".KKKKKKKKMMKKK.",
      "KnnnnnnnnnnnnnK",
      "KnnnnnnnnnnnnnK",
      ".KbbbbbbbbbbbK.",
      ".KbbbbbbbbbbbK.",
      ".KSSSSSSSSSSSK.",
      ".KCCCCCCCCCCCK.",
      ".KCCCCCCCCCCCK.",
      "..KCCCCCCCCCK..",
      "..KCCCCCCCCCK..",
      "..KCCCCCCCCCK..",
      "..KCCCCCCCCCK..",
      "..KCCCCBCCCCK..",
      "...KBCCCBCCK...",
      "...KCCBCCCBK...",
      "...KBBCCCBCK...",
      "...KCCCCCCCK...",
      "....KKKKKKK...."
    ]
  },
  {
    "id": "egg",
    "name": "煎蛋",
    "category": "美食",
    "rows": [
      "........n........",
      "....nnnnWnnnnnn..",
      "...nWWWWWWWWWWWn.",
      "..nWWWWWWWWWWWWWn",
      ".nWWWWWWWWWWWWWWn",
      "nWWWWWWyYYWWWWWWn",
      "nWWWWWyyYYYWWWWWn",
      "nWWWWWYYYYYWWWWWn",
      "nWWWWWYYYYOWWWWWn",
      "nWWWWWWYYOWWWWWWn",
      "nWWWWWWWWWWWWWWn.",
      ".nWWWWWWWWWWWWn..",
      "..nnWWWWWWWWWn...",
      "....nnnnWnnnn...."
    ]
  },
  {
    "id": "cherry",
    "name": "樱桃",
    "category": "美食",
    "rows": [
      "........KKKKK..",
      ".......KGgggGK.",
      ".......KGKgggK.",
      "......KGKGKKK..",
      ".....KGKKGK....",
      "....KGK..KGK...",
      "....KGK..KGK...",
      "...KGK...KGK...",
      "..KRRRK..KKKK..",
      ".KRRRRRKKRRRRK.",
      "KRRWRRRRRWRRRRK",
      "KRRRRRRRRRRRRRK",
      "KRRRRRRRRRRRRRK",
      ".KRRRRrKRRRRRRK",
      "..KRRRK.KRRRrK.",
      "...KKK...KKKK.."
    ]
  },
  {
    "id": "tulip",
    "name": "郁金香",
    "category": "植物",
    "rows": [
      ".K...K...K.",
      "KMK.KMK.KMK",
      "KMMKMMMKMMK",
      "KMMMMMMMMMK",
      "KMPMMrMMMMK",
      "KMPMMrMMMMK",
      "KMMMMrMMMMK",
      ".KMMMMMMMK.",
      "..KMMMMMK..",
      "...KKGKKKK.",
      ".KK.KGKKggK",
      "KggKKGKgggK",
      "KgggKGgggGK",
      ".KgggGggGK.",
      "..KggGgGK..",
      "...KgGGK...",
      "....KGK....",
      "....KGK....",
      ".....K....."
    ]
  },
  {
    "id": "cactus",
    "name": "仙人掌",
    "category": "植物",
    "rows": [
      ".....KMMMK.....",
      "....KgggggK....",
      ".K..KgGgggK....",
      "KgK.KgggggK..K.",
      "KggKKgggGgK.KgK",
      "KgggKgggggKKggK",
      "KgggKgGgggKKggK",
      "KgggggggggKgggK",
      "KgggKgggGgKgggK",
      ".KKKKgggggggggK",
      "....KgGgggKgggK",
      "....KgggggKKKK.",
      "....KgggGgK....",
      "....KgggggK....",
      "...KKgggggKK...",
      "..KOOOOOOOOOK..",
      "...KbSSSSSSK...",
      "...KSbSSSSSK...",
      "...KSSbSSSSK...",
      "...KSSSSSSSK..."
    ]
  },
  {
    "id": "mushroom",
    "name": "蘑菇",
    "category": "植物",
    "rows": [
      ".....KKKKKKK.....",
      "...KKRRRRRRRKK...",
      "..KRRRRRRRWWWRK..",
      ".KRRWRRRRRWWWRRK.",
      "KRRWWWRRRRWWWRRRK",
      "KRRRWRRRRRRRRRWRK",
      "KWRRRRRWWWRRRRRWK",
      "KCCCCCCCCCCCCCCCK",
      ".KKKKKyCCCCKKKKK.",
      ".....KyCCCCK.....",
      ".....KCCCCCK.....",
      ".....KCCCCCK.....",
      ".....KCCCCyK.....",
      ".....KCCCCCK.....",
      "......KKKKK......"
    ]
  },
  {
    "id": "clover",
    "name": "四叶草",
    "category": "植物",
    "rows": [
      "..GGG...GGG..",
      ".GgggG.GgggG.",
      "GgTgggGGTgggG",
      "GgggggGGggggG",
      "GgggggGGggggG",
      ".GgggG.GgggG.",
      "..GGG.G.GGG..",
      ".GGGGG.GGGGG.",
      "GgTgggGGTgggG",
      "GgggggGGggggG",
      "GgggggGGggggG",
      ".GgggG.GgggG.",
      "..GGG..GGGG..",
      "........G....",
      "........G....",
      ".........G..."
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
"!": ["#","#","#","#","#",".","#"],
"?": [".###.","#...#","....#","..##.","..#..",".....","..#.."],
".": [".",".",".",".",".",".","#"],
"-": ["...","...","...","###","...","...","..."],
"★": ["..#..","..#..","#####",".###.",".###.","##.##","#...#"],
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
