# -*- coding: utf-8 -*-
"""斜杠处理 A/B 试听对照。

生成两套音频放到 tools/slash_ab/，直接点开听：
    a_1_旧_带斜杠.mp3   ← 原文本 "benvenuto / benvenuti"
    b_1_新_逗号.mp3     ← 清洗后 "benvenuto, benvenuti"
用来确认改成逗号是不是你想要的听感（也可以改成空格无缝连读）。
"""
import asyncio
import os
import subprocess

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "slash_ab")
FFPROBE = r"D:\ffmpeg\bin\ffprobe.exe"
VOICE = "it-IT-IsabellaNeural"

CASES = [
    ("s01_0", "benvenuto / benvenuti", "benvenuto, benvenuti"),
    ("s19_18", "il tè (verde / rosso / al gelsomino / oolong)", "il tè (verde, rosso, al gelsomino, oolong)"),
    ("s04_5", "La forchetta / il coltello / i bastoncini.", "La forchetta, il coltello, i bastoncini."),
    ("s24_3", "il cameriere / la cameriera", "il cameriere, la cameriera"),
]


async def gen(text, path):
    await edge_tts.Communicate(text, VOICE, rate="-6%", pitch="-2Hz").save(path)


def dur(p):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
        capture_output=True, text=True,
    ).stdout.strip()
    return float(out or 0)


async def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (aid, old, new) in enumerate(CASES, 1):
        pa = os.path.join(OUT, "a%d_%s_旧_带斜杠.mp3" % (i, aid))
        pb = os.path.join(OUT, "b%d_%s_新_逗号.mp3" % (i, aid))
        await gen(old, pa)
        await gen(new, pb)
        print("%s\n  a 旧 %.2fs  %s\n  b 新 %.2fs  %s\n" % (aid, dur(pa), old, dur(pb), new))
    print("对照音频目录：" + OUT)


if __name__ == "__main__":
    asyncio.run(main())
