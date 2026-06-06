# cleanup-global-scripts.py
# 作用：
# 1. 删除所有 HTML 里旧的全局脚本直接引用
# 2. 保留并统一 global-loader.js?v=48
# 3. 避免旧脚本和新脚本重复运行导致闪现、冲突、重复按钮

from pathlib import Path
import re

GLOBAL_LOADER_LINE = '<script src="global-loader.js?v=52"></script>'

GLOBAL_SCRIPT_NAMES = [
    "user-widget.js",
    "user-widget-v2.js",
    "modal-shortcuts.js",
    "password-eye.js",
    "user-message-clear.js",
    "user-avatar-click-upload.js",
    "danger-message-clear.js",
    "page-scope-cleanup.js",
]

current_dir = Path(__file__).parent
html_files = sorted(current_dir.glob("*.html"))

changed = []
failed = []

for html_file in html_files:
    try:
        text = html_file.read_text(encoding="utf-8")
        original_text = text

        # 删除旧 global-loader 引用
        text = re.sub(
            r'\s*<script\s+src=["\']global-loader\.js\?v=\d+["\']>\s*</script>',
            '',
            text
        )

        # 删除旧全局脚本直接引用
        for script_name in GLOBAL_SCRIPT_NAMES:
            pattern = rf'\s*<script\s+src=["\']{re.escape(script_name)}(?:\?v=\d+)?["\']>\s*</script>'
            text = re.sub(pattern, '', text)

        # 添加新版 global-loader
        if "</body>" not in text:
            failed.append((html_file.name, "没有找到 </body>"))
            continue

        text = text.replace("</body>", f"{GLOBAL_LOADER_LINE}\n</body>")

        if text != original_text:
            html_file.write_text(text, encoding="utf-8")
            changed.append(html_file.name)

    except Exception as error:
        failed.append((html_file.name, str(error)))

print("====== 全局脚本清理完成 ======")

print("\n已修改：")
for name in changed:
    print(" -", name)

print("\n失败：")
for name, reason in failed:
    print(" -", name, reason)

print("\n完成。")