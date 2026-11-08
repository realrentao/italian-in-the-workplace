# 意大利语职场实战 · Italiano per professioni

面向中文使用者的意大利语**职业场景**学习站。当前已上线 2 个职业：**餐饮 · 中餐馆**（34 章）与 **美发 · 沙龙**（28 章），共 62 章 / 1820 条可发音内容 / 3640 个配音（意语 + 中文各一半，均为 edge-tts）。其余 5 个职业导航位留白，等你后续补充内容。

两个职业的数据来自各自的 md 手册，各自有独立解析器（格式不同），但共用同一套前端与音频管线：

| 职业 | 源文档 | 解析器 | 章节/条目 id 前缀 |
| --- | --- | --- | --- |
| 餐饮 · 中餐馆 | `italiano_ristorante_cinese (1).md` | `read_section()` + `parse_table()` | `s01`… / `g1`… |
| 美发 · 沙龙 | `意大利美发沙龙从业意大利语手册（28 板块 · 上岗即用版）.md` | `parse_salon()` + `read_salon_section()` | `h01`… |

> 前缀必须不同：`audio/` 是共享目录，`IDX` / `SECITEM` 是全局索引，同名 id 会互相覆盖。

## 打开方式

直接双击 `index.html` 即可（纯静态、零依赖、无需服务器）。
若浏览器限制本地文件读取，可用任意静态服务器：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 目录结构

```
italian-professions/
├─ index.html          页面骨架（顶栏 / 侧栏 / 主区 / 播放器 / 两个弹层）
├─ css/style.css       全部样式（浅色 + 深色双主题，响应式）
├─ js/app.js           主程序：导航、渲染、播放器、收藏、搜索、进度统计
├─ js/study.js         学习模块：词汇卡片 / 选择题 / 填空题 / 情景模拟 / 统计
├─ data/data.js        站点数据（window.APP_DATA，单文件，改内容只动这里）
├─ audio/              3640 个 mp3（意语 Isabella / Elsa，中文 Xiaoxiao / Yunxi）
├─ tools/
│  ├─ build_data.py    解析两份 md → data/data.js（含两份独立解析器 + assign_ids/assign_seq）
│  ├─ gen_audio.py     edge-tts 批量配音（意 + 中、断点续传 / 并发 / 失败重试）
│  ├─ smoke.js         Playwright 冒烟测试（27 步桌面 + 5 步移动端）
│  ├─ verify_study_audio.js  校验练习面板的发音全部走 edge-tts mp3
│  ├─ verify_dialogue_zh.js  校验对话中文逐句落在每句台词下方
│  ├─ verify_variants.js     校验「一行多说法」拆分结果
│  ├─ verify_audio_zh.js     校验中文配音 / 点读 / 连播双语 / 朗读高亮
│  ├─ verify_seq.js          校验目录、侧栏、章节头序号连续 1..N
│  ├─ verify_salon.js        校验第二个职业（美发）完整接入与跨职业隔离
│  ├─ verify_back_button.js  校验职业目录页「返回导航页」按钮
│  ├─ verify_slash.py  斜杠朗读 A/B 试听对照（产物在 tools/slash_ab/）
│  ├─ probe_steps.js   逐步骤探针：定位「某一步之后某按钮失灵」这类问题
│  └─ shots/           自动化测试产出的截图
```

## 站点功能

| 模块 | 说明 |
| --- | --- |
| 职业浏览 | 左侧导航 + 首页卡片，点击进入该职业的**章节目录页** |
| 侧栏随页切换 | 首页显示「职业分类」；进入职业后**隐藏职业分类、只留章节导航**（避免层级来回跳） |
| 目录页 | 各职业章节按模块分组（餐饮 34 章 / 美发 28 章，各 6 组），**序号连续 1..N**（不采用原文跳号数字）；每章一张导航卡：条数、掌握度、进度条；「继续学」一键跳到第一个没学完的章；顶部有「← 返回导航页」按钮 |
| 单章页 | 一章一页：面包屑（第 N 章）+ 本章工具（连播 / 小测 / 填空 / 情景模拟 / **整章收藏**）+ 底部上一章 / 目录 / 下一章；键盘 `←` `→` 直接翻章 |
| 内容形态 | 核心词汇、常用句型、情景对话（气泡按角色左右分）、语法讲解（规则 + 例句）、中文释义、使用场景注 |
| 手册要点 | 📌 本节要点显示在章节顶部；💡 补充提示收进可折叠块；美发对话保留 `**情景：**` 小标题 |
| 中文配音 / 点读 | 意语与中文各有独立 mp3；**点文字即读**——点意语只念意语、点中文只念中文（播放按钮已去掉），朗读时当前文字高亮（意绿 / 中强调色）。点读作用域只在章节正文区，搜索结果与收藏夹整行仍是跳转入口 |
| 直链路由 | hash 路由 `#/<职业>/<章节>`（如 `#/ristorante/s03`、`#/parrucchiere/h01`），刷新不丢位置，浏览器前进 / 后退可用 |
| 搜索 | 顶栏 / `Ctrl+K` 唤起，支持意语、中文、重音不敏感（conto / 账单 / prenotare）；点结果直接跳进所在单章并高亮朗读 |
| 收藏 | 每条右侧 ☆，或整章一键收藏；首页「我的收藏」点击回跳定位并播放 |
| 掌握度 | 每行右侧 ○ / ◐ / ● 三档，自动汇总成总进度环与每章进度条 |
| 学习面板 | 🃏 词汇卡片（翻面 + 自动读音 + 打乱 + 只看收藏）/ ✅ 选择题（意↔中互译）/ ✏️ 填空题（挖空答题）/ 🎭 情景模拟（听 A 选 B）/ 📊 学习统计（掌握度排行 + 打卡天数） |
| 练习配音 | 练习里**所有**意大利语都走 edge-tts 女声 mp3（和词条页同一个音色）：卡片自动读 / 选择题自动念题干、答完念正确答句 / 填空题提交后念答案、可听整句 / 情景模拟自动念 A 台词、答完念 B 答句。点过的按钮会脉冲提示「正在念这一条」 |
| 连播 | 「▶ 连播本章」或「连播全部 N 章」——每条**先意语后中文**；跨章时自动翻到对应单章页；迷你播放器支持上一句 / 播放暂停 / 下一句 / 循环 / 调速 |
| 兜底朗读 | mp3 缺失时才退回浏览器 `speechSynthesis`，按语言选 it-IT / zh-CN 嗓音（正常情况不会出现） |

所有进度（掌握度、收藏、答题记录、主题、语速）存在浏览器 `localStorage`，清浏览器数据即清空。

## 重新生成内容

```bash
# 1. 改完原始 md 后，重新解析数据
python tools/build_data.py

# 2. 生成配音（跳过已存在的文件，可随时中断续跑）
python tools/gen_audio.py             # 全量
python tools/gen_audio.py --limit 20  # 只跑前 20 条试水
python tools/gen_audio.py --dirty     # 只重生成「朗读文本被清洗过」的条目
python tools/gen_audio.py --force     # 全部重生成

# 3. 跑一遍浏览器自测
set NODE_PATH=C:\Users\<你>\.workbuddy\binaries\node\workspace\node_modules
node tools/smoke.js               # 交互冒烟（27 步桌面 + 5 步移动端）
node tools/verify_study_audio.js  # 练习配音校验（必须全部走 mp3，掉到浏览器 TTS 就退出码 1）
```

## 练习面板的发音（别改坏了）

`js/study.js` 里练习用到的意语文本**一律不新造音频**，而是复用词条已有的 mp3：

- `textAudioIndex()` —— 整句原文 → `audio` 文件名（选择题选项、情景模拟选项靠它拿音）
- `wordAudioIndex()` —— 只收「本身就是一个词」的词条（填空题答案词单独发声；没有就退回整句）
- `playAudio(item, btn)` —— 统一入口：先 `player.playOne`，再给按钮加 `.is-playing` 脉冲
- `enter()` 里 `player.stop()` 必须放在**渲染之前**，否则会把新模块刚触发的自动读音一起停掉

新增练习类型时，只要选项/答案来自 `itemsOf()` 的内容，就有现成音频；不要用 `speechSynthesis`。

## 朗读文本规则（重要）

页面显示与送进 TTS 的文本**是两套**，`gen_audio.py` 的 `tts_text()` 负责清洗，目前规则：

| 原文（显示） | 朗读文本 | 说明 |
| --- | --- | --- |
| `benvenuto / benvenuti` | `benvenuto, benvenuti` | 斜杠是「两种说法」的分隔符，念出来会变成 barra / slash，一律换成逗号停顿 |
| `冷烫／数码烫` | `冷烫，数码烫` | 中文里的全角斜杠换成中文逗号，也不能念出来 |
| `la birra (alla spina / in bottiglia)` | `la birra (alla spina, in bottiglia)` | 括号内同样处理，顺带修掉 `(,` / `, )` 这类残渣 |
| 多重标点 `!!!` / `...` | `!` / `.` | 防 TTS 拖长音 |

> 改完清洗规则后，用 `python tools/gen_audio.py --dirty` 只重生成受影响的音频，不用全量重跑。
> 想 A/B 试听新旧读法：`python tools/verify_slash.py`，产物在 `tools/slash_ab/`。

## 对话中文的写法（源文档约定）

文档里一段对话写成这样（`A:` / `B:` 逐行，**中文整段放在末尾的圆括号里，用 `/` 分隔**）：

```markdown
> A: Buonasera, benvenuti!
> B: Buonasera. Siamo in due, non abbiamo prenotato.
> （晚安，欢迎！/ 晚安，我们两位，没预订。）
```

`build_data.py` 的 `split_dialogue_zh()` 会把这段按 `/` 拆开，**逐句挂到每句台词下面**（页面每句气泡下方显示中文），顶部不再重复显示整段串讲。

- 中文句数必须与台词句数**一一对应**，否则脚本会报警并保留整段串讲兜底（不会瞎配）
- 因此单句中文里**不要出现 `/`**（用「、」或「，」代替）
- 当前餐饮篇 10 段对话 / 53 句台词，中文覆盖 53/53

改完跑 `node tools/verify_dialogue_zh.js` 复核（会逐句列出中文 + 检查情景模拟默认隐藏中文）。

**美发手册的对话格式不一样**：中文直接跟在每句台词后面，用 `——` 分隔，角色是「客 / 你 / 老板 / 师傅」等：

```markdown
**情景：周六上午米兰，没预约的老太太推门**

> 客：Buongiorno, avete posto? —— 您好，有位子吗？
> 你：Buongiorno, signora! Ha un appuntamento? —— 您好女士！您有预约吗？
```

`read_salon_section()` 直接把中文挂到该句（不需要 `split_dialogue_zh()`），把 `**情景：**` 存成 `scene` 显示在对话顶部，并按角色给 `side`（店方靠右 / 客方靠左）。表格里 4 张非标准表头（中文在前、禁忌、评价、平台、4 列 FAQ）由 `parse_salon_table()` 按表头语义分派列。

## 一行多个说法的拆分（变体展开）

文档里词条/句型常写成一行挤几组：`benvenuto / benvenuti —— 欢迎 / 欢迎多位`、`il tè (verde / rosso / al gelsomino / oolong)`。`build_data.py` 的 `expand_variants()` 会把它们**拆成独立行**，每行一个意语说法 + 自己的中文 + 自己的音频：

| 原写法 | 拆成 |
| --- | --- |
| `benvenuto / benvenuti`（欢迎 / 欢迎多位） | `benvenuto`·欢迎 ＋ `benvenuti`·欢迎多位 两行 |
| `il tè (verde / rosso)`（茶（绿 / 红）） | `il tè verde`·绿茶 ＋ `il tè rosso`·红茶（括号自动还原） |
| `茶（绿 / 红）` | 中文顺语序补全：绿茶、红茶（段里已含前缀字则不重复拼，如「生啤」） |
| `Si accomodi / Si sieda pure.`（请坐。/ tu: siediti pure） | 拆两行；`tu:` 变体说明抽到备注里 |
| `tritare`（剁碎 / 切末） | **不拆**——一个意语词对多个中文译名，保留一行 |

- 拆分后第一条**沿用原 id**，后续加 `b/c/d` 后缀（`s01_0`、`s01_0b`…），老进度（收藏/掌握度）不会错位
- 少数拆出来会缺共享前缀的（`fuoco alto / medio / basso`）在脚本的 `IT_FIX` / `ZH_FIX` 表里显式补全，新增不规则写法时往表里加一行即可
- 校验：`node tools/verify_variants.js`（拆分行独立性 + 中文 + 音频文件抽查）

## 补充新职业（医疗 / 法律 / 酒店 / 工程 / 商贸）

以「美发」为样板，四步：

1. **写解析器**：在 `tools/build_data.py` 里加 `SALON_SRC` 那样的源路径常量 + 一个 `parse_xxx()`（按新 md 的标题/表格/对话格式解析，返回 `sections`）。可以复用 `expand_variants()` 处理「一行多说法」。
2. **定前缀**：章节 id 用**新前缀**（餐饮 `s`/`g`、美发 `h`），因为 `audio/` 共享、`IDX`/`SECITEM` 是全局索引。
3. **挂职业**：`main()` 里 `assign_ids()` → 声明模块 `SALON_MODULES` 那样的分组 → `assign_seq()`，然后在 `professions` 里插一条 `status:"ready"` 的职业。
4. **生成 + 配音**：`python tools/build_data.py` → `python tools/gen_audio.py`（自动跳过已存在的餐饮音频，只生成新增的意语 + 中文）。

前端**不需要**改动：导航栏、首页卡片、搜索索引、学习面板、点读、连播全部由 `data/data.js` 驱动。只有 `btnStart` / `btnQuickPlay` / toast 这类提示文案要保持"取当前职业"而不是写死某个职业 id。

回归检查清单：

```bash
python tools/build_data.py && python tools/gen_audio.py
node tools/verify_seq.js       # 两个职业的目录序号都连续
node tools/verify_salon.js     # 新职业接入 + 跨职业 id/收藏隔离
node tools/smoke.js            # 餐饮原有 27 步交互不回归
```

> 重生成后务必核对「餐饮职业对象与上一版 `data.js` 逐字节一致」——`assign_ids()` 的规则若变了，657 个已有音频会全部失联。可先 `cp data/data.js data/data_before.js.bak` 再比对。
