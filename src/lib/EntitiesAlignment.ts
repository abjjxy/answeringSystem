import { DBAlignmentInfo } from '../types';

/**
 * Biographical entity matching with CTEXT (Chinese Text Project) and CBDB (China Biographical Database).
 * Implements rule-based disambiguation based on Dynasty, Native Region and Parents.
 */
export class EntitiesAlignment {
  // Mock external databases with raw records
  private static ctextDB: Record<string, any> = {
    "728461": {
      id: "728461",
      name: "文彭",
      dynasty: "明",
      native: "长洲 (江苏苏州)",
      father: "文徵明",
      office: "两京国子监博士",
      sources: ["《明史·文苑传》", "《印人传·卷一》"],
      link: "https://ctext.org/wiki.pl?if=gb&char=728461"
    },
    "105658": {
      id: "105658",
      name: "王羲之",
      dynasty: "东晋",
      native: "琅琊临沂 (山阴)",
      father: "王旷",
      office: "右军将军、会稽内史",
      sources: ["《晋书·王羲之传》"],
      link: "https://ctext.org/wiki.pl?if=gb&char=105658"
    },
    "1002578": {
      id: "1002578",
      name: "颜真卿",
      dynasty: "唐",
      native: "琅琊临沂",
      father: "颜惟贞",
      office: "吏部尚书、太子太师、平原太守",
      sources: ["《旧唐书·颜真卿传》", "《新唐书·颜真卿传》"],
      link: "https://ctext.org/wiki.pl?if=gb&res=1002578"
    },
    "728470": {
      id: "728470",
      name: "何震",
      dynasty: "明",
      native: "婺源 (安徽徽州)",
      teacher: "文彭",
      office: "布衣 (未出仕)",
      sources: ["《印人传·卷二》", "《广印人传》"],
      link: "https://ctext.org/wiki.pl?if=gb&char=728470"
    },
    "728520": {
      id: "728520",
      name: "丁敬",
      dynasty: "清",
      native: "钱塘 (浙江杭州)",
      office: "布衣 (推举博学鸿词未就)",
      sources: ["《国朝先正事略》", "《印人传·卷三》"],
      link: "https://ctext.org/wiki.pl?if=gb&char=728520"
    },
    "728551": {
      id: "728551",
      name: "邓石如",
      dynasty: "清",
      native: "怀宁 (安徽安庆)",
      office: "布衣 (毕沅幕友)",
      sources: ["《清史稿·艺术传》", "《完白山人传》"],
      link: "https://ctext.org/wiki.pl?if=gb&char=728551"
    }
  };

  private static cbdbDB: Record<string, any> = {
    "34112": {
      id: "34112",
      name: "文彭",
      birth_year: 1498,
      death_year: 1573,
      native_code: "320501", // Suzhou
      alt_names: ["文寿承", "文三桥"],
      kinship: { "father": "文徵明", "brother": "文嘉" },
      titles: ["国子监助教", "国子监博士"]
    },
    "93427": {
      id: "93427",
      name: "王羲之",
      birth_year: 303,
      death_year: 361,
      native_code: "371302", // Linyi
      alt_names: ["王逸少", "王右军"],
      kinship: { "father": "王旷", "son": "王献之" },
      titles: ["秘书郎", "江州刺史", "右军将军"]
    },
    "36181": {
      id: "36181",
      name: "颜真卿",
      birth_year: 709,
      death_year: 784,
      native_code: "371302",
      alt_names: ["颜鲁公", "颜清臣"],
      kinship: { "father": "颜惟贞" },
      titles: ["监察御史", "平原太守", "刑部尚书", "礼部尚书"]
    },
    "41334": {
      id: "41334",
      name: "何震",
      birth_year: 1530,
      death_year: 1604,
      native_code: "341025", // Huizhou
      alt_names: ["何主臣", "何雪渔"],
      kinship: {},
      titles: []
    },
    "50392": {
      id: "50392",
      name: "丁敬",
      birth_year: 1695,
      death_year: 1765,
      native_code: "330101", // Hangzhou
      alt_names: ["丁敬身", "丁砚林"],
      kinship: {},
      titles: []
    },
    "50450": {
      id: "50450",
      name: "邓石如",
      birth_year: 1743,
      death_year: 1805,
      native_code: "340822", // Anqing
      alt_names: ["邓顽伯", "完白山人"],
      kinship: { "son": "邓传密" },
      titles: []
    }
  };

  /**
   * Complete rule-based Ambiguity Resolution over a target candidate list.
   * Compares Active Dynasty and Parent Relatives to filter out false matches.
   */
  public static resolveAmbiguity(
    name: string,
    candidates: any[],
    context: { dynasty?: string; father?: string; birthYear?: number }
  ): any {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Evaluate matching weight based on metadata rules
    let bestCandidate = candidates[0];
    let maxScore = -1;

    for (const c of candidates) {
      let score = 0;

      // Rule A: Check dynastic compatibility
      if (context.dynasty && c.dynasty) {
        if (context.dynasty.toLowerCase().includes(c.dynasty.toLowerCase()) || 
            c.dynasty.toLowerCase().includes(context.dynasty.toLowerCase())) {
          score += 5;
        }
      }

      // Rule B: Check birth year closeness (within 10 years margin)
      if (context.birthYear && c.birth_year) {
        const diff = Math.abs(context.birthYear - c.birth_year);
        if (diff <= 3) score += 8;
        else if (diff <= 10) score += 4;
      }

      // Rule C: Lineage match (Father name check)
      if (context.father && c.father && context.father === c.father) {
        score += 10;
      }

      if (score > maxScore) {
        maxScore = score;
        bestCandidate = c;
      }
    }

    return bestCandidate;
  }

  /**
   * Aligns local person to external databases.
   * Pulls structural entries from ctext and CBDB and fuses them into our graph schema.
   */
  public static getAlignment(personId: string, label: string, ctextId?: string, cbdbId?: string): DBAlignmentInfo {
    // Collect simulated entries
    const ctextRec = ctextId ? this.ctextDB[ctextId] : null;
    const cbdbRec = cbdbId ? this.cbdbDB[cbdbId] : null;

    let dbType: 'ctext' | 'cbdb' | 'both' | 'none' = 'none';
    if (ctextRec && cbdbRec) dbType = 'both';
    else if (ctextRec) dbType = 'ctext';
    else if (cbdbRec) dbType = 'cbdb';

    const status = (ctextRec || cbdbRec) ? 'aligned' : 'not_found';

    const officePlayed: string[] = [];
    const altNames: string[] = [];
    let birthPlaceInfo = '';
    let parentInfo = '';
    let sourceRecordUrl = '';

    if (ctextRec) {
      if (ctextRec.office) officePlayed.push(ctextRec.office);
      if (ctextRec.father) parentInfo = `父：${ctextRec.father}`;
      if (ctextRec.link) sourceRecordUrl = ctextRec.link;
      if (ctextRec.native) birthPlaceInfo = ctextRec.native;
    }

    if (cbdbRec) {
      if (cbdbRec.titles && cbdbRec.titles.length > 0) {
        cbdbRec.titles.forEach((t: string) => {
          if (!officePlayed.includes(t)) officePlayed.push(t);
        });
      }
      if (cbdbRec.alt_names && cbdbRec.alt_names.length > 0) {
        cbdbRec.alt_names.forEach((t: string) => altNames.push(t));
      }
      if (cbdbRec.kinship && cbdbRec.kinship.father && !parentInfo) {
        parentInfo = `父：${cbdbRec.kinship.father}`;
      }
    }

    // Default supplement data for characters with no precise ID in db for a unified view
    const introduction = "集成古代历史学者词条，并对齐中国历代传记数据库(CBDB)与古籍数字图书馆(CTEXT)";

    return {
      personId,
      label,
      ctextId,
      cbdbId,
      dbType,
      status,
      supplementalData: {
        officePlayed: officePlayed.length > 0 ? officePlayed : ["布衣/无官职记录"],
        altNames: altNames.length > 0 ? altNames : [label],
        birthPlaceInfo: birthPlaceInfo || "中国传统历史籍贯",
        parentInfo: parentInfo || "无家系关系记录",
        sourceRecordUrl: sourceRecordUrl || "https://ctext.org"
      }
    };
  }

  /**
   * Generates sample ambiguity scenarios to test.
   */
  public static testDisambiguationSample(): any {
    const candidates = [
      { id: "M1", name: "文彭", dynasty: "明", birth_year: 1498, father: "文徵明", desc: "名震吴门，文二代" },
      { id: "M2", name: "文彭", dynasty: "清", birth_year: 1812, father: "文国贤", desc: "晚清书法举人" }
    ];

    // Find match for Wen Peng born near 1498 with father Wen Zhengming
    const match = this.resolveAmbiguity("文彭", candidates, {
      dynasty: "明",
      birthYear: 1498,
      father: "文徵明"
    });

    return {
      candidates,
      result: match
    };
  }
}
