// danger-message-clear.js
// 危险操作弹窗错误提示自动清除：
// 清空历史、备份导入等弹窗里，如果输错密码/验证码，用户重新输入时自动清空错误提示。

(function () {
    if (window.__DANGER_MESSAGE_CLEAR_LOADED__) {
        return;
    }

    window.__DANGER_MESSAGE_CLEAR_LOADED__ = true;

    window.addEventListener("load", () => {
        bindDangerMessageClear();
    });

    document.addEventListener("input", handleDangerInput, true);
    document.addEventListener("change", handleDangerInput, true);
    document.addEventListener("focusin", handleDangerInput, true);
    document.addEventListener("keydown", handleDangerInput, true);
    document.addEventListener("paste", handleDangerInput, true);

    function bindDangerMessageClear() {
        clearOnDangerInput();
    }

    function handleDangerInput(event) {
        const target = event.target;

        if (!target) {
            return;
        }

        const isEditable =
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT";

        if (!isEditable) {
            return;
        }

        const inClearHistoryModal = !!target.closest("#clearHistoryModalMask");
        const inBackupImportBox = !!target.closest("#backupImportBox");

        if (!inClearHistoryModal && !inBackupImportBox) {
            return;
        }

        clearOnDangerInput();
    }

    function clearOnDangerInput() {
        const ids = [
            "clearHistoryMessage",
            "backupImportMessage"
        ];

        ids.forEach(id => {
            const box = document.getElementById(id);
            if (box) {
                box.innerText = "";
            }
        });
    }
})();