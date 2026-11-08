# -*- coding: utf-8 -*-
"""
把《意大利中餐馆从业意大利语》markdown 解析为站点数据 data/data.js
输出: window.APP_DATA = {...};
用法: python tools/build_data.py
"""
import os
import re
import json
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = r"C:\Users\迪丽希斯\OneDrive\Desktop\italiano_ristorante_cinese (1).md"
# 第二个职业：美发沙龙手册（格式与餐饮不同，用独立解析器）
SALON_SRC = r"C:\Users\迪丽希斯\OneDrive\Desktop\意大利美发沙龙从业意大利语手册（28 板块 · 上岗即用版）.md"
OUT = os.path.join(ROOT, "data", "data.js")

# ---------------------------------------------------------------- 章节元信息
CHAPTERS = [
    ("一", "迎客与礼貌用语", "Accoglienza e saluti"),
    ("二", "点餐环节", "Ordinazione"),
    ("三", "中餐菜单意大利语", "Menù cinese"),
    ("四", "上菜与服务", "Servizio e portata"),
    ("五", "结账", "Il conto"),
    ("六", "后厨基础沟通", "Cucina: basi"),
    ("七", "外卖与打包", "Asporto e confezione"),
    ("八", "常见客诉与应对", "Lamentele e risposte"),
    ("九", "必备数字与金额", "Numeri e importi"),
    ("十", "外卖与电话接单", "Telefono e ordini"),
    ("十一", "后厨深度指令", "Cucina: taglio, fuoco, servizio"),
    ("十二", "食材与调料采购", "Acquisti e fornitori"),
    ("十三", "过敏与忌口", "Allergie e intolleranze"),
    ("十四", "营业与预订电话", "Prenotazioni"),
    ("十五", "礼貌客服与节日用语", "Servizio cortese e feste"),
    ("十六", "川菜专项", "Cucina Sichuan"),
    ("十七", "北方面食专项", "Noodles del nord"),
    ("十八", "粤菜与海鲜专项", "Cucina cantonese e pesce"),
    ("十九", "酒水专项", "Vini e bevande"),
    ("二十", "日餐与泰餐混业", "Sushi e cucina thailandese"),
    ("二十一", "应急与安全处理", "Emergenze e sicurezza"),
    ("二十二", "卫生合规与检查", "Igiene e ASL"),
    ("二十三", "外卖平台接单", "Piattaforme di delivery"),
    ("二十四", "人事与排班", "Personale e turni"),
    ("二十五", "银行税务与发票", "Banca, tasse e fatture"),
    ("二十六", "设备与维修", "Attrezzature e riparazioni"),
    ("二十七", "客人常见问题 FAQ", "Domande frequenti"),
    ("二十八", "线上评价回复", "Recensioni online"),
]

MODULES = [
    ("m1", "门店 front of house", "Accoglienza · ordinazione · cassa", "迎客 · 点餐 · 上菜 · 结账 · 预订 · 客服节日"),
    ("m2", "菜单专项", "Menù speciali", "中餐菜单 · 川菜 · 面食 · 粤海鲜 · 酒水 · 日泰"),
    ("m3", "后厨厨房", "Cucina", "后厨 · 火候切配 · 采购"),
    ("m4", "外卖与配送", "Asporto e delivery", "打包 · 电话接单 · 外卖平台"),
    ("m5", "运营与管理", "Gestione", "客诉 · 过敏 · 应急 · 卫生 · 人事 · 设备 · FAQ · 评价"),
    ("m6", "基础工具箱", "Strumenti base", "数字 · 金额 · 语法"),
]

# ---------------------------------------------------------------- 语法专题
GRAMMAR = [
    {
        "key": "g1", "title": "尊称 Lei 与熟客 tu", "titleIt": "Lei e tu", "module": "m1",
        "blocks": [
            {"zh": "对陌生客人、长者、正式场合一律用 Lei（您）：动词取「第三人称单数」，招呼用 Lei 的礼貌形式。对熟客、年轻人、同事可用 tu。",
             "it": "Lei vs tu",
             "ex": [{"it": "Buonasera, si accomodi.", "zh": "晚上好，请坐。（Lei 形式）"},
                    {"it": "Buonasera, siediti pure.", "zh": "晚上好，随便坐。（tu 形式）"},
                    {"it": "Vorrei un tavolo per quattro.", "zh": "我想要一张四人桌。（Lei 下的礼貌说法）"},
                    {"it": "Voglio un tavolo per quattro.", "zh": "我要一张四人桌。（tu 下口语，服务场景偏冲）"}]},
            {"zh": "Lei 动词速记：volere→vuole / potere→può / dare→dà / dire→dice / prendere→prende / uscire→esce。礼貌请求常用条件式 vorrei（我想要）。",
             "it": "Vorrei / Vuole / Può",
             "ex": [{"it": "Vuole ordinare adesso?", "zh": "现在可以点餐吗？"},
                    {"it": "Può ripetere l'ordine?", "zh": "能重复一下点的菜吗？"}]},
            {"zh": "招呼与道别：进门先 Buongiorno / Buonasera + benvenuti(a)；离开时 Buona giornata / Buona serata / Arrivederci / Torni presto（欢迎常来）。",
             "it": "Formule di cortesia",
             "ex": [{"it": "Buongiorno, benvenuti!", "zh": "日安，欢迎光临！"},
                    {"it": "Buonasera, arrivederci!", "zh": "晚上好，再见！"}]},
        ],
    },
    {
        "key": "g2", "title": "条件式与礼貌请求", "titleIt": "Condizionale e richieste gentili", "module": "m1",
        "blocks": [
            {"zh": "Vorrei + 名词/动词原形 是最安全的服务用语（比 voglio 礼貌）；Le consiglio + 名词 表示「我推荐」，Prego / Certo 用于爽快答应。",
             "it": "Vorrei / Le consiglio",
             "ex": [{"it": "Vorrei l'anatra alla pechinese.", "zh": "我想要北京烤鸭。"},
                    {"it": "Le consiglio il pollo Kung Pao, è la nostra specialità.", "zh": "我推荐宫保鸡丁，是我们的招牌。"},
                    {"it": "Vorrei prenotare un tavolo per stasera.", "zh": "我想订今晚的桌。"}]},
            {"zh": "Potrebbe + 原形（您能不能…）更客气； Pronto 接电话； Mi dica 请说 / 请指示。",
             "it": "Potrebbe...? / Mi dica",
             "ex": [{"it": "Potrebbe aspettare due minuti?", "zh": "能等两分钟吗？"},
                    {"it": "Mi dica l'indirizzo, per favore.", "zh": "请告诉我地址。"}]},
            {"zh": "节日祝福：Buon Natale e Felice Anno Nuovo、Buona Pasqua、Felice Festa della Primavera、Buon Ferragosto（8/15 意大利重要假日）、Tanti auguri（通用）。",
             "it": "Auguri",
             "ex": [{"it": "Buon Natale e Felice Anno Nuovo!", "zh": "圣诞新年快乐！"},
                    {"it": "Felice Festa della Primavera!", "zh": "春节快乐！"},
                    {"it": "Tanti auguri!", "zh": "祝一切顺利！（生日节日通用）"}]},
        ],
    },
    {
        "key": "g3", "title": "命令式：请坐、稍等、重复", "titleIt": "Imperativo", "module": "m1",
        "blocks": [
            {"zh": "Lei 命令式：去掉词尾 -e 加 -i / -a / -o（accomodare→si accomodi、aspettare→mi aspetti、ripetere→ripeta、sedersi→si sieda / si accomodi）。",
             "it": "Si accomodi / Mi aspetti",
             "ex": [{"it": "Si accomodi, per favore.", "zh": "请坐，谢谢。"},
                    {"it": "Un attimo, mi aspetti un secondo.", "zh": "稍等一下。"},
                    {"it": "Ripeta l'ordine, per favore.", "zh": "请重复一下点单。"}]},
            {"zh": "tu 命令式（同事、熟客、年轻人）：去掉 -e（accomodati / aspetta / ripeti / siediti），加 pure 表「随意、请便」。",
             "it": "Imperativo tu",
             "ex": [{"it": "Siediti pure.", "zh": "随便坐。"},
                    {"it": "Aspetta un attimo.", "zh": "等一下。"},
                    {"it": "Ripeti, per favore.", "zh": "请重复一下。"}]},
            {"zh": "后厨命令常用 tu 且直接：Alza il fuoco、Taglia le verdure、Sbrigati（快点）、Manca il riso（还差米饭）。",
             "it": "Istruzioni in cucina",
             "ex": [{"it": "Alza il fuoco, deve rosolare la carne.", "zh": "开大火，把肉煸一下。"},
                    {"it": "Ci mancano due porzioni di riso.", "zh": "还差两份米饭。"}]},
        ],
    },
    {
        "key": "g4", "title": "介词与烹饪方式 al / alla / con / in", "titleIt": "Preposizioni e modi di cottura", "module": "m2",
        "blocks": [
            {"zh": "al / alla + 烹饪或风味：al vapore（蒸）、alla piastra（煎/烙）、al limone（柠檬）、al curry（咖喱）、alla cantonese（粤式）；阴性名词用 alla。",
             "it": "al vapore / alla piastra",
             "ex": [{"it": "I ravioli al vapore.", "zh": "蒸饺。"},
                    {"it": "I ravioli alla piastra.", "zh": "煎饺。"},
                    {"it": "Il pesce al vapore.", "zh": "清蒸鱼。"},
                    {"it": "Il pollo al limone.", "zh": "柠檬鸡。"}]},
            {"zh": "con + 配料：con riso / con noodles / con aglio / con anacardi（配米饭、面条、蒜、腰果）。",
             "it": "con + ingrediente",
             "ex": [{"it": "Vorrei il riso con gamberi.", "zh": "我要虾仁炒饭。"},
                    {"it": "Un contorno con pomodoro.", "zh": "一份番茄配菜。"}]},
            {"zh": "di / in / da：di soia（豆类面）、in salsa di fagioli neri（黑椒酱）、al Yuxiang（音译式）、da portare via（带走）、da questa parte（这边）。",
             "it": "di / in / da",
             "ex": [{"it": "Gli spaghetti di soia.", "zh": "黄豆粉面条（担担面类）。"},
                    {"it": "Un piatto da portare via.", "zh": "一份外带。"},
                    {"it": "Da questa parte, per favore.", "zh": "这边请。"}]},
        ],
    },
    {
        "key": "g5", "title": "数字、金额与数量", "titleIt": "Numeri, importi e quantità", "module": "m6",
        "blocks": [
            {"zh": "金额 = 数字 + euro；.50 读「e cinquanta」：ventidue euro e cinquanta。整十整百：venti / trenta / quaranta / cinquanta / cento。",
             "it": "Importi",
             "ex": [{"it": "Sono in tutto venti euro.", "zh": "一共 20 欧。"},
                    {"it": "Totale dodici euro e cinquanta.", "zh": "共 12.5 欧。"},
                    {"it": "Il totale è ventidue euro.", "zh": "总额 22 欧。"}]},
            {"zh": "数量：un / due / tre + 量词（piatto / porzione / bottiglia / chilo / pezzo）；半公斤 = mezzo chilo。",
             "it": "Quantità",
             "ex": [{"it": "Un piatto, per favore.", "zh": "来一份。"},
                    {"it": "Due porzioni di riso.", "zh": "两份米饭。"},
                    {"it": "Mi serve mezzo chilo di carne.", "zh": "我要半公斤肉。"},
                    {"it": "Tre bottiglie di birra.", "zh": "三瓶啤酒。"}]},
            {"zh": "时间：alle otto（八点）、alle otto e mezza（八点半）、entro mezz'ora（半小时内）、circa / approssimativamente（大约）。",
             "it": "Orari",
             "ex": [{"it": "Arriviamo in trenta minuti.", "zh": "我们 30 分钟送到。"},
                    {"it": "Ci vediamo alle venti e trenta.", "zh": "我们八点半见。"}]},
        ],
    },
    {
        "key": "g6", "title": "过敏、忌口与补救表达", "titleIt": "Allergie, divieti e rimedi", "module": "m5",
        "blocks": [
            {"zh": "senza + 名词 = 不要…：senza aglio（不要蒜）、senza glutine（无麸质）、senza latticini（无乳制品）、senza piccante（不辣）。",
             "it": "senza...",
             "ex": [{"it": "Senza aglio, per favore.", "zh": "请不要放蒜。"},
                    {"it": "Un piatto senza glutine.", "zh": "一份无麸质的。"}]},
            {"zh": "essere allergico / intollerante a + 名词：冠词要缩合为 ai / al / alla（ai gamberetti、al glutine、al latte）。",
             "it": "allergico (a) / intollerante (a)",
             "ex": [{"it": "Sono intollerante ai gamberetti.", "zh": "我对虾不耐受。"},
                    {"it": "È allergico a qualcosa?", "zh": "您对什么过敏吗？"}]},
            {"zh": "道歉与补救：Mi scusi（不好意思，借过）、Mi dispiace（抱歉）、Ha ragione（您说得对）、Lo scaldo subito（我马上加热）、Controllo subito（我马上核对）。",
             "it": "Scuse e rimedi",
             "ex": [{"it": "Mi scusi, questo piatto è freddo.", "zh": "不好意思，这菜凉了。"},
                    {"it": "Mi dispiace, lo scaldo subito.", "zh": "抱歉，我马上加热。"},
                    {"it": "Ha ragione, porto quello giusto.", "zh": "您说得对，我换对的来。"}]},
        ],
    },
]

PHONE_ITEMS = []


# ---------------------------------------------------------------- 工具
def split_cn_brackets(s):
    if "（" in s and "）" in s:
        i = s.rfind("（")
        j = s.rfind("）")
        if i < j:
            return s[:i].strip(), s[i + 1:j].strip()
    return s.strip(), ""


def clean_it(s):
    return re.sub(r"\s+", " ", s.replace("**", "").replace("`", "")).strip()


def norm_zh(s):
    return re.sub(r"\s+", " ", s).strip(" ・·|")


# ---------------------------------------------------------------- 解析
def read_section(lines, cn_title):
    items = []
    tip = ""
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # 表格
        if line.startswith("|"):
            buf = []
            while i < n and lines[i].strip().startswith("|"):
                buf.append(lines[i].strip())
                i += 1
            parse_table(buf, items)
            continue

        # 对话 / 注释
        if line.startswith(">"):
            content = line.lstrip(">").strip()
            # 整段对话的中文串讲：> （……）
            if content.startswith("（") and content.endswith("）") and content.count("（") == 1:
                if items and items[-1].get("t") == "d":
                    items[-1]["sum"] = norm_zh(content[1:-1])
                i += 1
                continue
            if content[:1] in ("💡", "📌"):
                tip = content.lstrip("💡📌 ").strip()
                i += 1
                continue
            # 相邻的 > 行合并成同一段对话（文档里每行都带 A: / B: 前缀）
            last = items[-1] if items else None
            m = re.match(r"^(A|B|Tu|Io|客|你|店员|客人)\s*[：:]\s*(.+)$", content)
            if m:
                if last and last.get("t") == "d":
                    last["lines"].append({"who": m.group(1), "it": clean_it(m.group(2))})
                else:
                    items.append({"t": "d", "lines": [{"who": m.group(1), "it": clean_it(m.group(2))}]})
            else:
                if last and last.get("t") == "d":
                    last["lines"].append({"who": "A", "it": clean_it(content)})
            i += 1
            continue

        # 菜单式：中文 **Italiano**（note）
        m0 = re.match(r"^[-*]\s+([\u4e00-\u9fff][^\*]{0,20}?)\s*\*\*(.+?)\*\*\s*(.*)$", line)
        if m0:
            zh = norm_zh(m0.group(1))
            it = clean_it(m0.group(2))
            outside, zh2 = split_cn_brackets(m0.group(3))
            note = norm_zh(outside) or zh2
            items.append({"t": "v", "it": it, "zh": zh, "note": note})
            i += 1
            continue

        # 句子式：[- (客|你):] **Italiano**（中文）
        m = re.match(r"^[-*]\s+(?:([^\s*：:]{1,6})\s*[：:]\s*)?\*\*(.+?)\*\*\s*(.*)$", line)
        if m:
            sp = (m.group(1) or "").strip()
            outside, zh = split_cn_brackets(m.group(3))
            if sp in ("客", "客人", "你", "店员", "我方", "对方", "A", "B"):
                item = {"t": "p", "it": clean_it(m.group(2)), "sp": sp}
                if zh:
                    item["zh"] = norm_zh(zh)
                if outside:
                    item["note"] = norm_zh(outside)
            else:
                item = {"t": "p", "it": clean_it(m.group(2)), "zh": norm_zh(zh), "note": norm_zh(outside)}
            items.append(item)
            i += 1
            continue

        # 基础数字串
        m = re.match(r"^[-*]?\s*\*\*(.+?)\*\*[：:]?\s*(.*)$", line)
        if m and "基础数字" in m.group(1):
            for pair in re.findall(r"([a-zA-Zà-ÿ']{2,12})\s+(\d+)", m.group(2)):
                items.append({"t": "v", "it": pair[0], "zh": pair[1]})
            i += 1
            continue

        i += 1
    split_dialogue_zh(items)
    items = expand_variants(items)
    return items, tip


def split_dialogue_zh(items):
    """把对话末尾那行「> （中文1 / 中文2 / …）」拆成逐句中文，挂到每句台词下面。

    原始文档只给了一整段中文串讲（用 / 分隔），页面原来只在对话框顶部显示一遍；
    这里按 / 拆开一一对应，每句气泡下方就能看到自己的中文。
    句数对不上（比如某句中文里本身含 /）就不瞎配，保留整段串讲兜底。
    """
    for it in items:
        if it.get("t") != "d" or not it.get("sum"):
            continue
        parts = [norm_zh(x) for x in re.split(r"[／/]", it["sum"])]
        parts = [x for x in parts if x]
        if len(parts) != len(it["lines"]):
            print("  ! 对话中文句数 %d ≠ 台词 %d 句，保留整段串讲：%s"
                  % (len(parts), len(it["lines"]), it["sum"][:50]))
            continue
        for ln, zh in zip(it["lines"], parts):
            if not ln.get("zh"):
                ln["zh"] = zh
        it.pop("sum")            # 已经下放到每句，顶部不再重复显示


ROLE_RE = re.compile(r"^(客|客人|你|我方|店员|对方|A|B|Tu|Io)[：:]?$")
NOTE_MARK_RE = re.compile(
    r"^\s*(?:tu|Lei|voi)\s*[：:]|^\s*(?:对客人|对同事|对同辈|对熟人|同辈|熟人|敬体|简体|生日|节日|通用)")

# 源文档里少数中文拆不开 / 拆出来不完整，这里按原样修好后再拆（不写脆弱的通用算法）
ZH_FIX = {
    "绿 / 红 / 黄咖喱": "绿咖喱 / 红咖喱 / 黄咖喱",
    "男 / 女服务员": "男服务员 / 女服务员",
    "猪 / 牛肉": "猪肉 / 牛肉",
    "几点开门 / 关门？": "几点开门？/ 几点关门？",
    "我丢了手机 / 伞。": "我丢了手机。/ 我丢了伞。",
    "无麸质 / 无乳制品？可补充问": "无麸质？/ 无乳制品？",
    "祝愿多多！/ 生日节日通用": "祝愿多多！（生日、节日通用）",
    "明天你晚班？/ tu": "明天你晚班？（对同辈 tu）",
    "日安 / 晚安，欢迎光临！": "日安，欢迎光临！/ 晚安，欢迎光临！",
}

# 同理，少数意语后段省略了公共前缀（fuoco alto / medio / basso），
# 直接拆会掉成孤零零的medio，这里显式补全后再拆
IT_FIX = {
    "Panini al vapore / fritti": "Panini al vapore / Panini fritti",
    "Buongiorno / Buonasera, benvenuti!": "Buongiorno, benvenuti! / Buonasera, benvenuti!",
    "fuoco alto / medio / basso": "fuoco alto / fuoco medio / fuoco basso",
    "la carne di maiale / di manzo": "la carne di maiale / la carne di manzo",
    "Baozi di carne / di verdura": "Baozi di carne / Baozi di verdura",
    "il vino frizzante / spumante": "il vino frizzante / il vino spumante",
    "Curry verde / rosso / giallo": "Curry verde / Curry rosso / Curry giallo",
    "Non c'è l'acqua / la luce.": "Non c'è l'acqua. / Non c'è la luce.",
    "Ho perso il mio telefono / ombrello.": "Ho perso il mio telefono. / Ho perso il mio ombrello.",
    "allergico / allergica (a)": "allergico (a) / allergica (a)",
}


def _segs(s):
    """按 / （半角或全角）切成段"""
    return [x.strip() for x in re.split(r"[／/]", s) if x.strip()]


def _paren_expand(s, zh=False):
    """PREFIX（A / B）SUFFIX -> [PREFIX A SUFFIX, PREFIX B SUFFIX]

    中文侧要顺语序：茶（绿 / 红）-> 绿茶 / 红茶；段里已含前缀字时直接用段
    （啤酒（生啤 / 瓶啤）-> 生啤 / 瓶啤，不拼成「生啤啤酒」）。
    """
    m = re.match(r"^(.*?)\s*[（(]\s*([^（()）]*[／/][^（()）]*)\s*[）)]\s*(.*)$", s)
    if not m:
        return None
    pre, inner, suf = m.group(1).strip(), m.group(2), m.group(3).strip()
    segs = _segs(inner)
    if len(segs) < 2:
        return None
    out = []
    for x in segs:
        if zh and pre and not (set(x) & set(pre)):
            t = x + pre          # 绿茶 / 小虾 / 蒸饺子
        elif zh and pre:
            t = x                # 生啤 / 细卷（段里已经带了这个字）
        elif pre or suf:
            t = (pre + " " + x + " " + suf).strip()
        else:
            t = x
        out.append(re.sub(r"\s+", " ", t).strip())
    return out


def _pad_punct(segs):
    """末段有句末标点就给前面各段补上：叉子 / 刀 / 筷子。-> 叉子。/ 刀。/ 筷子。"""
    if len(segs) < 2:
        return segs
    m = re.search(r"([。！？!?.])$", segs[-1])
    if not m:
        return segs
    p = m.group(1)
    return [x if re.search(r"[。！？!?.]$", x) else x + p for x in segs[:-1]] + [segs[-1]]


def split_item(it):
    """把一行里用 / 并列的多个意语（配多组中文）拆成独立条目。

    文档里大量写成「benvenuto / benvenuti —— 欢迎 / 欢迎多位」，一行挤了两组
    （甚至三、四组）内容，朗读也是念一长串。这里拆成独立行，各配各的中文、
    各自的音频。拆不开 / 不该拆的返回 None，原行保留。
    """
    if it.get("t") == "d":
        return None
    it_text = it.get("it") or ""
    zh_text = (it.get("zh") or "").strip()
    note_text = (it.get("note") or "").strip()
    sp = it.get("sp") or ""

    # 「客：」「你：」这类角色行：真正的中文写在 note 里
    if ROLE_RE.match(zh_text) and note_text:
        sp = sp or zh_text.rstrip("：:")
        zh_text, note_text = note_text, ""
    zh_text = ZH_FIX.get(zh_text, zh_text)
    it_text = IT_FIX.get(it_text.replace("\u2019", "'"), it_text)

    # zh 里混着「tu: …」「对客人用 Lei: …」这类变体说明 -> 抽出来放进 note
    keep, marks = [], []
    for s in _segs(zh_text):
        (marks if NOTE_MARK_RE.search(s) else keep).append(s)
    if marks:
        note_text = "；".join([x for x in [note_text] + marks if x])
        zh_text = " / ".join(keep)

    it_parts = _paren_expand(it_text) or _segs(it_text)
    zh_parts = _paren_expand(zh_text, zh=True) or _segs(zh_text)
    if len(it_parts) < 2 or len(it_parts) > 5:
        return None
    if len(zh_parts) == 0:
        return None
    if len(zh_parts) > 1 and len(zh_parts) != len(it_parts):
        print("  ! 意语 %d 段 / 中文 %d 段对不上，整行保留：%s" % (len(it_parts), len(zh_parts), it_text[:44]))
        return None
    if any(len(x) < 2 for x in it_parts):
        return None

    it_parts = _pad_punct(it_parts)
    zh_parts = _pad_punct(zh_parts) if len(zh_parts) > 1 else zh_parts * len(it_parts)

    out = []
    for i, a in enumerate(it_parts):
        d = {k: v for k, v in it.items() if k not in ("it", "zh", "note", "sp")}
        d["it"] = a
        d["zh"] = zh_parts[i]
        if note_text:
            d["note"] = note_text
        else:
            d.pop("note", None)
        if sp:
            d["sp"] = sp
        out.append(d)
    return out


def expand_variants(items):
    """对整个章节做变体拆分。拆出来的第一条沿用原 id（_idx + 空后缀），
    后续用 b / c / d 后缀，保证老用户的收藏与掌握度不会因为插入行而错位。"""
    out = []
    for idx, it in enumerate(items):
        parts = split_item(it)
        if not parts:
            it["_idx"] = idx
            out.append(it)
            continue
        for k, p in enumerate(parts):
            p["_idx"] = idx
            p["_suf"] = "" if k == 0 else chr(ord("b") + k - 1)
            out.append(p)
    return out


def parse_table(rows, items):
    bodies = []
    for l in rows[1:]:
        cells = [c.strip() for c in l.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            continue
        if any(("意文" in c or "中文" in c) for c in cells):
            continue
        bodies.append(cells)
    for cells in bodies:
        if len(cells) == 2:
            it, zh = cells
            note = ""
        elif len(cells) >= 3:
            it, zh, note = cells[0], cells[1], cells[2]
        else:
            continue
        it, zh, note = clean_it(it), clean_it(zh), clean_it(note)
        if re.fullmatch(r"\*{0,2}\d{2,3}\*{0,2}", it):
            items.append({"t": "phone", "num": it.replace("*", ""), "zh": zh})
        else:
            items.append({"t": "v", "it": it, "zh": norm_zh(zh), "note": note})


# ---------------------------------------------------------------- 通用：id / 连续序号
def assign_ids(sections):
    """给章节里所有条目分配 id / audio / audioZh。

    规则：普通条目 {secId}_{base}{suf}；对话每句 {itemId}_{j}；语法例句 {secId}_{bi}_{ei}。
    与餐饮原规则完全一致（s01_0 / s01_12_0 / g1_0_0 …），美发用 h01 前缀，
    因此两个职业共用 audio/ 目录也不会互相覆盖。
    """
    for sec in sections:
        for k, it in enumerate(sec["items"]):
            base = it.pop("_idx", k)
            suf = it.pop("_suf", "")
            iid = "%s_%d%s" % (sec["id"], base, suf)
            it["id"] = iid
            if it["t"] == "d":
                it.pop("audio", None)
                for j, ln in enumerate(it["lines"]):
                    lid = "%s_%d" % (iid, j)
                    ln["id"] = lid
                    ln["audio"] = lid + ".mp3"
                    if ln.get("zh"):
                        ln["audioZh"] = lid + "_zh.mp3"
            else:
                it["audio"] = iid + ".mp3"
                if it.get("zh"):
                    it["audioZh"] = iid + "_zh.mp3"
        for bi, b in enumerate(sec.get("blocks") or []):
            for ei, e in enumerate(b["ex"]):
                eid = "%s_%d_%d" % (sec["id"], bi, ei)
                e["id"] = eid
                e["audio"] = eid + ".mp3"
                if e.get("zh"):
                    e["audioZh"] = eid + "_zh.mp3"


def assign_seq(sections, modules):
    """按目录显示顺序（模块分组，与前端 openSections 一致）写连续 seq。"""
    sid2sec = {s["id"]: s for s in sections}
    seq = 0
    for m in modules:
        for sid in m["sectionIds"]:
            s = sid2sec.get(sid)
            if s is not None and "seq" not in s:
                seq += 1
                s["seq"] = seq
    for s in sections:
        if "seq" not in s:
            seq += 1
            s["seq"] = seq


# ---------------------------------------------------------------- 美发沙龙手册解析
# 与餐饮格式不同：3 列表格（意|中|说明，另有 4 张特殊表）、
#   * **意语** —— 中文。      （例句）
#   > 客：意语 —— 中文         （情景对话，中文就在同一行）
#   **情景：……**              （对话小标题）
#   💡 …… / 📌 本节要点：……    （补充提示 / 章节要点）
SALON_MODULES = [
    ("hm1", "接待与沟通", "Accoglienza e consulenza", [1, 2, 3, 4, 5, 8, 15]),
    ("hm2", "技术专项", "Taglio · colore · permanente", [11, 16, 17, 18, 19, 20]),
    ("hm3", "洗护与工具", "Lavaggio e strumenti", [6, 7, 13]),
    ("hm4", "预约与线上", "Prenotazioni e online", [10, 14, 23, 28]),
    ("hm5", "运营与合规", "Gestione e normative", [12, 21, 22, 24, 25, 26]),
    ("hm6", "基础工具箱", "Strumenti base", [9, 27]),
]
SALON_STAFF = {"你", "老板", "师", "助", "供", "检", "应", "员工", "师傅", "接线员", "店员", "同事"}


def split_dash(s):
    """'意语 —— 中文' -> (意语, 中文)；只按第一个破折号切。"""
    parts = re.split(r"\s*——\s*", s, maxsplit=1)
    if len(parts) == 2:
        return clean_it(parts[0]), norm_zh(parts[1])
    return clean_it(parts[0]), ""


def strip_cn_paren(s):
    """'Quanto guadagna?（收入）' -> ('Quanto guadagna?', '收入')，中文注释不进 TTS。"""
    m = re.search(r"[（(]([\u4e00-\u9fff][^（）()]*)[）)]", s)
    if not m:
        return clean_it(s), ""
    return clean_it(s[:m.start()] + s[m.end():]), norm_zh(m.group(1))


def parse_salon_table(rows, items, notes):
    """按表头语义识别列：标准 / 反向 / 禁忌 / 评价 / 平台 / 4 列 FAQ。"""
    if not rows:
        return

    def cells(l):
        return [c.strip() for c in l.strip().strip("|").split("|")]

    head = [clean_it(c) for c in cells(rows[0])]
    ht = " ".join(head)
    body = []
    for l in rows[1:]:
        c = cells(l)
        if all(re.fullmatch(r":?-{2,}:?", x) for x in c):
            continue
        body.append(c)
    if ht.startswith("#"):            # 目录表，跳过
        return
    if "客人怎么问" in ht:
        mode = "faq4"
    elif ht.startswith("中文说法"):
        mode = "reverse"
    elif ht.startswith("不要说"):
        mode = "taboo"
    elif ht.startswith("星级"):
        mode = "review"
    elif ht.startswith("平台"):
        mode = "platform"
    else:
        mode = "std"

    def add(it_text, zh_text, note=""):
        it_text, zh_text, note = clean_it(it_text), norm_zh(zh_text), norm_zh(note)
        if it_text:
            items.append({"t": "v", "it": it_text, "zh": zh_text, "note": note})

    for c in body:
        if len(c) < 3:
            continue
        if mode == "faq4":
            if len(c) < 4:
                continue
            label, q_it, q_zh, ans = c[0], c[1], c[2], c[3]
            a_it, a_zh = split_dash(ans)
            add(q_it, q_zh, label + "（客人问）")
            add(a_it, a_zh, label + "（应答）")
        elif mode == "reverse":
            add(c[1], c[0], c[2])
        elif mode == "taboo":
            it0, extra = strip_cn_paren(c[0])
            # 禁忌表里纯中文的「不要说」不是意语句子，转成提示，避免用意语嗓音念中文
            if not re.search(r"[A-Za-zà-ÿÀ-Ÿ]", it0):
                notes.append("避免：" + it0 + "（" + norm_zh(c[1]) + "）；建议：" + norm_zh(c[2]))
                continue
            add(it0, c[1], "建议：" + c[2] + (("；" + extra) if extra else ""))
        elif mode in ("review", "platform"):
            add(c[1], c[2], c[0])
        else:
            add(c[0], c[1], c[2])


def read_salon_section(lines):
    """解析一个板块，返回 (items, tip, notes)。"""
    items, notes, tip = [], [], ""
    scene = ""
    i, n = 0, len(lines)
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("|"):
            buf = []
            while i < n and lines[i].strip().startswith("|"):
                buf.append(lines[i].strip())
                i += 1
            parse_salon_table(buf, items, notes)
            continue
        if re.fullmatch(r"[*\-_]{3,}", line):
            i += 1
            continue
        if line.startswith("### "):
            scene = norm_zh(line[4:])
            i += 1
            continue
        m = re.match(r"^\*\*情景[：:]\s*(.+?)\*\*\s*$", line)
        if m:
            scene = norm_zh(m.group(1))
            i += 1
            continue
        if line.startswith(">"):
            c = line.lstrip(">").strip()
            m = re.match(r"^([^：:]{1,12})\s*[：:]\s*(.+)$", c)
            who, rest = (m.group(1).strip(), m.group(2)) if m else ("", c)
            it_part, zh_part = split_dash(rest)
            ln = {"who": who or "A", "it": it_part, "zh": zh_part,
                  "side": "b" if (who in SALON_STAFF or who.startswith("你")) else "a"}
            last = items[-1] if items else None
            if last and last.get("t") == "d" and last.get("scene") == scene:
                last["lines"].append(ln)
            else:
                items.append({"t": "d", "scene": scene, "lines": [ln]})
            i += 1
            continue
        m = re.match(r"^[-*]\s+\*\*(.+?)\*\*\s*——\s*(.+)$", line)
        if m:
            items.append({"t": "p", "it": clean_it(m.group(1)), "zh": norm_zh(m.group(2))})
            i += 1
            continue
        if line.startswith("💡") or line.startswith("📌"):
            t = clean_it(re.sub(r"^本节要点[：:]\s*", "", line.lstrip("💡📌 ").strip()))
            if line.startswith("📌"):
                tip = t
            else:
                notes.append(t)
            i += 1
            continue
        if len(line) > 10 and re.search(r"[\u4e00-\u9fff]", line) and not line.startswith("#"):
            notes.append(clean_it(line))
        i += 1
    # 对话中文已逐句下放，不走 split_dialogue_zh；并列说法仍统一拆成独立行
    return expand_variants(items), tip, notes


def parse_salon():
    """按 '## 板块N · 中文名（意文名）' 切出 28 个板块。"""
    with open(SALON_SRC, encoding="utf-8") as f:
        raw = f.read().split("\n")
    starts = [(i, l.strip()) for i, l in enumerate(raw)
              if re.match(r"^## 板块\d+\s*·", l.strip())]
    ending = next((i for i, l in enumerate(raw) if l.strip().startswith("## 结语")), len(raw))
    sections = []
    for k, (start, head) in enumerate(starts):
        m = re.match(r"^## 板块(\d+)\s*·\s*(.+)$", head)
        num, title_all = int(m.group(1)), m.group(2).strip()
        mm = re.match(r"^(.+?)\s*[（(]([^（）()]*)[）)]\s*$", title_all)
        cn_title = mm.group(1).strip() if mm else title_all
        it_title = mm.group(2).strip() if mm else ""
        end = starts[k + 1][0] if k + 1 < len(starts) else ending
        items, tip, notes = read_salon_section(raw[start + 1:end])
        if not items:
            print("!! 美发板块无内容:", title_all)
            continue
        sections.append({
            "id": "h%02d" % num, "no": str(num), "title": cn_title, "titleIt": it_title,
            "tip": tip, "notes": notes, "items": items,
        })
    return sections


def main():
    with open(SRC, encoding="utf-8") as f:
        raw = f.read().split("\n")

    sections = []
    for ci, (no, cn_title, it_title) in enumerate(CHAPTERS, 1):
        idx = None
        for i, l in enumerate(raw):
            if l.startswith("## ") and cn_title in l:
                idx = i
                break
        if idx is None:
            print("!! 未找到章节:", cn_title)
            continue
        end = len(raw)
        for i in range(idx + 1, len(raw)):
            if raw[i].startswith("## "):
                end = i
                break
        items, tip = read_section(raw[idx + 1:end], cn_title)
        if not items:
            continue
        sid = "s%02d" % ci
        sec = {"id": sid, "no": no, "title": cn_title, "titleIt": it_title, "tip": tip, "items": items}
        sections.append(sec)

    for g in GRAMMAR:
        blocks = []
        for b in g["blocks"]:
            blocks.append({**b, "ex": [dict(e) for e in b["ex"]]})
        sections.append({
            "id": g["key"], "no": "", "title": "语法 · " + g["title"], "titleIt": g["titleIt"],
            "grammar": True, "module": g["module"], "items": [], "blocks": blocks,
        })

    # id / audio 规则与原逻辑完全一致，餐饮既有 657 条音频文件名不变
    assign_ids(sections)

    title2mod = {}
    for mid, _, _, desc in MODULES:
        for t in desc.split(" · "):
            if t.strip():
                title2mod[t.strip()] = mid
    mod_map = {m[0]: [] for m in MODULES}
    no2sid = {no: "s%02d" % i for i, (no, _c, _t) in enumerate(CHAPTERS, 1)}
    for s in sections:
        if s.get("grammar"):
            mod_map[s["module"]].append(s["id"])
            continue
        hit = "m5"
        for no, cn, _t in CHAPTERS:
            if s["id"] == no2sid[no]:
                for tok, mid in title2mod.items():
                    if tok in cn:
                        hit = mid
                        break
                break
        mod_map[hit].append(s["id"])

    modules = [{"id": m[0], "title": m[1], "titleIt": m[2], "sectionIds": mod_map[m[0]]}
               for m in MODULES if mod_map.get(m[0])]

    # 连续章节序号：按目录显示顺序（模块分组，与前端 openSections 完全一致）
    assign_seq(sections, modules)

    # ---- 第二个已上线职业：美发沙龙（28 板块，独立解析器）----
    salon_sections = parse_salon()
    assign_ids(salon_sections)
    salon_modules = [{"id": mid, "title": t, "titleIt": ti,
                      "sectionIds": ["h%02d" % n for n in nums]}
                     for mid, t, ti, nums in SALON_MODULES]
    assign_seq(salon_sections, salon_modules)

    professions = [
        {
            "id": "ristorante", "name": "餐饮 · 中餐馆", "nameIt": "Ristorante cinese",
            "icon": "🍜", "color": "#0f9d58", "status": "ready",
            "desc": "意大利中餐馆上岗即用：迎客、点餐、菜单、后厨、外卖、结账、客诉、应急全场景",
            "modules": modules, "sections": sections,
        },
        {
            "id": "parrucchiere", "name": "美发 · 沙龙", "nameIt": "Parrucchiere / Salone di bellezza",
            "icon": "✂️", "color": "#a855f7", "status": "ready",
            "desc": "意大利美发沙龙上岗即用：迎客、需求咨询、剪染烫、洗护工具、预约、客诉、卫生合规全场景（28 板块）",
            "modules": salon_modules, "sections": salon_sections,
        },
        {"id": "medico", "name": "医疗 · 诊所与护理", "nameIt": "Medico e infermiere", "icon": "🩺", "color": "#2f80ed", "status": "placeholder"},
        {"id": "legale", "name": "法律 · 律师与公证", "nameIt": "Avvocato e notaio", "icon": "⚖️", "color": "#7b3fe4", "status": "placeholder"},
        {"id": "hotel", "name": "酒店服务 · 前台客房", "nameIt": "Ricevimento alberghiero", "icon": "🏨", "color": "#e08b00", "status": "placeholder"},
        {"id": "ingegneria", "name": "工程 · 工地与技术", "nameIt": "Ingegnere e cantiere", "icon": "🏗️", "color": "#596d82", "status": "placeholder"},
        {"id": "commercio", "name": "商贸 · 销售与采购", "nameIt": "Commercio e affari", "icon": "🏪", "color": "#d93025", "status": "placeholder"},
    ]

    data = {
        "meta": {
            "title": "意大利语职场实战",
            "subtitle": "Italiano per professioni — 餐饮 / 美发 / 医疗 / 法律 / 酒店 / 工程 / 商贸",
            "voice": "it-IT-IsabellaNeural",
            "generated": datetime.datetime.now().strftime("%Y-%m-%d"),
        },
        "professions": professions,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.APP_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

    def stat(secs):
        v = p = d = g = 0
        for s in secs:
            for it in s["items"]:
                if it["t"] == "v":
                    v += 1
                elif it["t"] == "p":
                    p += 1
                elif it["t"] == "d":
                    d += len(it["lines"])
            if s.get("blocks"):
                g += sum(len(b["ex"]) for b in s["blocks"])
        return v, p, d, g

    print(f"[OK] {OUT}")
    for label, secs, mods in (("餐饮", sections, modules), ("美发", salon_sections, salon_modules)):
        v, p, d, g = stat(secs)
        print(f"  {label}: sections={len(secs)} vocab={v} phrase={p} dialoglines={d} grammarEx={g}")
        for m in mods:
            print(f"    {m['id']}: {len(m['sectionIds'])} sections -> {m['title']}")


if __name__ == "__main__":
    main()
