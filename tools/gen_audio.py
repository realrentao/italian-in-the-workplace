# -*- coding: utf-8 -*-
"""用 edge-tts 女声批量生成意语配音（断点续传 + 并发 + 失败重试）。

用法：
    python tools/gen_audio.py             # 全量（跳过已存在的）
    python tools/gen_audio.py --force     # 强制重生成
    python tools/gen_audio.py --dirty     # 只重生成「TTS 文本被清洗过」的条目
    python tools/gen_audio.py --limit 20  # 只跑前 20 条（试水）
    python tools/gen_audio.py --dry       # 只列出待生成清单，不下载
"""
import asyncio
import json
import os
import re
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "data.js")
OUT = os.path.join(ROOT, "audio")
ERRLOG = os.path.join(ROOT, "tools", "audio_errors.txt")

# 注意：it-IT-ElenaNeural 已被微软下线（返回空音频），改用 Isabella / Elsa
VOICES = ["it-IT-IsabellaNeural", "it-IT-ElsaNeural"]

# 中文配音：女声 Xiaoxiao，备选男声 Yunxi
ZH_VOICES = ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"]
RATE = "-6%"      # 略慢，适合跟读
PITCH = "-2Hz"
VOLUME = "+0%"

SEM = 8          # 并发数
MAX_RETRY = 3
MIN_SIZE = 1500  # mp3 小于此值视为失败


def load_db():
    with open(DATA, encoding="utf-8") as f:
        s = f.read()
    m = re.search(r"window\.APP_DATA\s*=\s*(\{.*\})\s*;?\s*$", s, re.S)
    if not m:
        raise SystemExit("无法解析 data/data.js")
    return json.loads(m.group(1))


def tts_text(t):
    """朗读前的文本清洗。

    斜杠在页面里是「两种说法」的分隔符（benvenuto / benvenuti），
    但念出来会被读成 barra / slash，所以要换成逗号——只留一个短停顿。
    注意：只改送进 TTS 的文本，页面显示仍是原样带斜杠。
    """
    t = re.sub(r"\s*/\s*", ", ", t)
    t = t.replace("／", "，")          # 中文里的全角斜杠（冷烫／数码烫）也不该念出来
    t = re.sub(r"\(\s*,", "(", t)     # 修掉 "(, xxx"
    t = re.sub(r",\s*\)", ")", t)     # 修掉 "xxx, )"
    t = re.sub(r"\s*,\s*", ", ", t)   # 逗号统一成 ", "
    t = re.sub(r"([!?.,])\1+", r"\1", t)
    return re.sub(r"\s+", " ", t).strip()


def collect(db):
    """产出 [(audio_filename, text, context)]，意语 + 中文（带 audioZh 的条目）都生成。"""
    jobs = []
    for p in db["professions"]:
        if p.get("status") != "ready":
            continue
        for s in p["sections"]:
            for it in s.get("items", []):
                if it.get("t") == "d":
                    for ln in it["lines"]:
                        if ln.get("it"):
                            jobs.append((ln.get("audio", ""), ln["it"],
                                         "%s / %s" % (s["title"], ln.get("who", ""))))
                        if ln.get("zh") and ln.get("audioZh"):
                            jobs.append((ln["audioZh"], ln["zh"],
                                         "%s / %s · 中" % (s["title"], ln.get("who", ""))))
                elif it.get("t") == "phone":
                    txt = "Numero %s. %s" % (it.get("num", ""), it.get("zh", ""))
                    jobs.append((it.get("audio", ""), txt, s["title"]))
                    if it.get("zh") and it.get("audioZh"):
                        jobs.append((it["audioZh"], it["zh"], s["title"] + " · 中"))
                else:
                    if it.get("it"):
                        jobs.append((it.get("audio", ""), it["it"], s["title"]))
                    if it.get("zh") and it.get("audioZh"):
                        jobs.append((it["audioZh"], it["zh"], s["title"] + " · 中"))
            for b in s.get("blocks") or []:
                for e in b["ex"]:
                    if e.get("it"):
                        jobs.append((e.get("audio", ""), e["it"], "语法 " + s["title"]))
                    if e.get("zh") and e.get("audioZh"):
                        jobs.append((e["audioZh"], e["zh"], "语法 " + s["title"] + " · 中"))
    return jobs


def voices_for(name):
    """按文件名后缀选嗓音：_zh.mp3 用中文嗓音，其余用意语嗓音。"""
    return ZH_VOICES if str(name).endswith("_zh.mp3") else VOICES


async def one(sem, name, text, force=False):
    path = os.path.join(OUT, name)
    if os.path.exists(path) and os.path.getsize(path) > MIN_SIZE and not force:
        return "skip"
    last_err = ""
    used = voices_for(name)[0]
    for att in range(1, MAX_RETRY + 1):
        for v in voices_for(name):
            try:
                async with sem:
                    comm = edge_tts.Communicate(text, v, rate=RATE, pitch=PITCH, volume=VOLUME)
                    await comm.save(path)
                if os.path.getsize(path) < MIN_SIZE:
                    raise RuntimeError("文件过小")
                used = v
                return "ok@" + used
            except Exception as ex:  # noqa: BLE001
                last_err = str(ex)[:70]
        await asyncio.sleep(0.8 * att)
    return "ERR:" + last_err


async def main():
    force = "--force" in sys.argv
    dry = "--dry" in sys.argv
    dirty = "--dirty" in sys.argv
    limit = 0
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    os.makedirs(OUT, exist_ok=True)
    db = load_db()
    jobs = [j for j in collect(db) if j[0]]
    if dirty:   # 只看文本被清洗过的（斜杠等），这类必须重生成
        jobs = [j for j in jobs if tts_text(j[1]) != j[1]]
        force = True
    jobs = [(n, tts_text(t), c) for (n, t, c) in jobs]
    if limit:
        jobs = jobs[:limit]

    todo = 0
    if not force:
        todo = sum(1 for j in jobs if not os.path.exists(os.path.join(OUT, j[0])))
    print("总条目 %d，待生成 %d，输出目录 %s" % (len(jobs), todo if not force else len(jobs), OUT))
    if dry:
        for j in jobs[:40]:
            print("  - %s | %s | %s" % (j[0], j[2], j[1][:60]))
        return

    sem = asyncio.Semaphore(SEM)
    cnt = {"ok": 0, "skip": 0, "err": 0}
    errs = []

    async def run(i, j):
        r = await one(sem, j[0], j[1], force)
        if r.startswith("ok"):
            cnt["ok"] += 1
        elif r == "skip":
            cnt["skip"] += 1
        else:
            cnt["err"] += 1
            errs.append((j[0], r))
        if (i + 1) % 100 == 0:
            print("  ...%d/%d  ok=%d skip=%d err=%d" % (i + 1, len(jobs), cnt["ok"], cnt["skip"], cnt["err"]), flush=True)

    await asyncio.gather(*(run(i, j) for i, j in enumerate(jobs)))
    print("完成：ok=%d skip=%d err=%d" % (cnt["ok"], cnt["skip"], cnt["err"]))
    if errs:
        with open(ERRLOG, "w", encoding="utf-8") as f:
            for n, m in errs:
                f.write("%s\t%s\n" % (n, m))
        print("失败 %d 条，清单见 %s" % (len(errs), ERRLOG))
        for e in errs[:10]:
            print("  X", e)


if __name__ == "__main__":
    asyncio.run(main())
