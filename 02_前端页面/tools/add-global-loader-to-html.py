# add-global-loader-to-html.py
# 作用：自动给当前文件夹下所有 .html 文件添加 global-loader.js 引用。
# 用法：在 02_前端页面 文件夹里运行：
# py tools\add-global-loader-to-html.py

from pathlib import Path

SCRIPT_LINE = '<script src="global-loader.js?v=45"></script>'

current_dir = Path(__file__).resolve().parent.parent
html_files = sorted(current_dir.glob("*.html"))

changed = []
skipped = []
failed = []

for html_file in html_files:
    try:
        text = html_file.read_text(encoding="utf-8")

        if "global-loader.js" in text:
            skipped.append(html_file.name)
            continue

        if "</body>" not in text:
            failed.append((html_file.name, "没有找到 </body>"))
            continue

        new_text = text.replace("</body>", f"{SCRIPT_LINE}\n</body>")

        html_file.write_text(new_text, encoding="utf-8")
        changed.append(html_file.name)

    except Exception as error:
        failed.append((html_file.name, str(error)))

print("====== global-loader.js 引用添加完成 ======")

print("\n已修改：")
for name in changed:
    print(" -", name)

print("\n已跳过，已经有引用：")
for name in skipped:
    print(" -", name)

print("\n失败：")
for name, reason in failed:
    print(" -", name, reason)

print("\n完成。")
