// modal-shortcuts.js
// 弹窗快捷键 V3：
// Enter：确定
// Y：确定
// N：取消
// ArrowUp / ArrowDown：当焦点在 select 或 radio 上时切换选项
// 重要修复：当焦点在 input / textarea / select 里时，Y 和 N 只是正常输入字符，不触发快捷键。
// 这样账号或密码里有 n / y 时，不会自动退出或提交。

(function () {
    if (window.__MODAL_SHORTCUTS_V3_LOADED__) {
        return;
    }

    window.__MODAL_SHORTCUTS_V3_LOADED__ = true;

    window.addEventListener("keydown", function (event) {
        if (event.isComposing) {
            return;
        }

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (handleOptionArrowKey(event)) {
                return;
            }
        }

        const key = event.key.toLowerCase();

        if (!["enter", "y", "n"].includes(key)) {
            return;
        }

        const modal = findTopVisibleModal();

        if (!modal) {
            return;
        }

        const target = event.target;
        const isEditing = isEditableTarget(target);

        // 用户正在输入内容时，Y/N 绝对不能当快捷键。
        if (isEditing && (key === "y" || key === "n")) {
            return;
        }

        // textarea 里按 Enter 应该换行，不应该提交。
        if (target && target.tagName === "TEXTAREA" && key === "enter") {
            return;
        }

        if (key === "n") {
            const cancelButton = findCancelButton(modal);

            if (cancelButton) {
                event.preventDefault();
                cancelButton.click();
            }

            return;
        }

        if (key === "enter" || key === "y") {
            const confirmButton = findConfirmButton(modal);

            if (confirmButton) {
                event.preventDefault();
                confirmButton.click();
            }
        }
    });

    function isEditableTarget(target) {
        if (!target) {
            return false;
        }

        const tag = target.tagName;

        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
            return true;
        }

        if (target.isContentEditable) {
            return true;
        }

        return false;
    }

    function handleOptionArrowKey(event) {
        const target = event.target;

        if (!target) {
            return false;
        }

        const delta = event.key === "ArrowDown" ? 1 : -1;

        if (target.tagName === "SELECT") {
            return moveSelectOption(target, delta, event);
        }

        if (
            target.tagName === "INPUT" &&
            String(target.type || "").toLowerCase() === "radio"
        ) {
            return moveRadioOption(target, delta, event);
        }

        return false;
    }

    function moveSelectOption(select, delta, event) {
        if (select.disabled || select.multiple || select.options.length === 0) {
            return false;
        }

        const currentIndex = select.selectedIndex < 0 ? 0 : select.selectedIndex;
        const nextIndex = Math.max(0, Math.min(select.options.length - 1, currentIndex + delta));

        if (nextIndex === currentIndex) {
            return false;
        }

        event.preventDefault();
        select.selectedIndex = nextIndex;
        select.dispatchEvent(new Event("change", {bubbles: true}));

        return true;
    }

    function moveRadioOption(radio, delta, event) {
        if (radio.disabled) {
            return false;
        }

        const radios = getRadioGroup(radio);
        const currentIndex = radios.indexOf(radio);

        if (currentIndex < 0 || radios.length <= 1) {
            return false;
        }

        const nextIndex = Math.max(0, Math.min(radios.length - 1, currentIndex + delta));

        if (nextIndex === currentIndex) {
            return false;
        }

        const nextRadio = radios[nextIndex];

        event.preventDefault();
        nextRadio.checked = true;
        nextRadio.focus();
        nextRadio.dispatchEvent(new Event("change", {bubbles: true}));

        return true;
    }

    function getRadioGroup(radio) {
        const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const name = radio.name || "";

        return allRadios.filter(item => {
            if (item.disabled) {
                return false;
            }

            if ((item.name || "") !== name) {
                return false;
            }

            return item.form === radio.form;
        });
    }

    function findTopVisibleModal() {
        const selectors = [
            ".user-modal-mask",
            "#submitSuccessModalMask",
            "#clearHistoryModalMask"
        ];

        for (const selector of selectors) {
            const list = Array.from(document.querySelectorAll(selector)).reverse();

            for (const item of list) {
                const style = window.getComputedStyle(item);

                if (style.display !== "none" && style.visibility !== "hidden") {
                    return item;
                }
            }
        }

        return null;
    }

    function findCancelButton(modal) {
        const buttons = Array.from(modal.querySelectorAll("button"));

        return buttons.find(button => {
            const text = button.innerText.trim();
            return text.includes("取消") || text.includes("关闭");
        });
    }

    function findConfirmButton(modal) {
        const buttons = Array.from(modal.querySelectorAll("button"));

        const preferred = buttons.find(button => {
            const text = button.innerText.trim();

            return (
                text.includes("确定") ||
                text.includes("确认") ||
                text.includes("保存") ||
                text.includes("登录") ||
                text.includes("注册") ||
                text.includes("导入") ||
                text.includes("清空")
            );
        });

        if (preferred) {
            return preferred;
        }

        return buttons[buttons.length - 1] || null;
    }
})();
