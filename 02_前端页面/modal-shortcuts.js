// modal-shortcuts.js
// 弹窗快捷键 V7：
// Enter：确定
// Y：确定
// N：取消
// ArrowUp / ArrowDown：当焦点在 select 或 radio 上时切换选项
// 表单字段导航：单行 input 可用 ArrowUp / ArrowDown 切换字段，textarea 使用 Ctrl/Alt + Arrow。
// 重要修复：当焦点在 input / textarea / select 里时，Y 和 N 只是正常输入字符，不触发快捷键。
// 这样账号或密码里有 n / y 时，不会自动退出或提交。

(function () {
    if (window.__MODAL_SHORTCUTS_V7_LOADED__) {
        return;
    }

    window.__MODAL_SHORTCUTS_V7_LOADED__ = true;

    document.addEventListener("focusin", function (event) {
        if (event.target && event.target.tagName === "SELECT") {
            delete event.target.dataset.xgwSelectConfirmed;
            delete event.target.dataset.xgwSelectPickerTried;
        }
    });

    document.addEventListener("blur", function (event) {
        if (event.target && event.target.tagName === "SELECT") {
            clearSelectStateAfterBlur(event.target);
        }
    }, true);

    document.addEventListener("change", function (event) {
        if (event.target && event.target.tagName === "SELECT") {
            markSelectConfirmed(event.target);
        }
    }, true);

    window.addEventListener("keydown", function (event) {
        if (event.isComposing) {
            return;
        }

        if (event.key === "Enter" && confirmSelectChoice(event)) {
            return;
        }

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (handleArrowNavigation(event)) {
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

    function confirmSelectChoice(event) {
        const target = event.target;

        if (!target || target.tagName !== "SELECT") {
            return false;
        }

        markSelectConfirmed(target);
        consumeKeyboardEvent(event);

        return true;
    }

    function handleArrowNavigation(event) {
        const target = event.target;

        if (!target || !isFormFieldTarget(target)) {
            return false;
        }

        const delta = event.key === "ArrowDown" ? 1 : -1;

        if (target.tagName === "SELECT") {
            if (target.dataset.xgwSelectConfirmed === "1") {
                return focusAdjacentField(target, delta, event, true);
            }

            return moveSelectOption(target, delta, event);
        }

        if (
            target.tagName === "INPUT" &&
            String(target.type || "").toLowerCase() === "radio"
        ) {
            return moveRadioOption(target, delta, event);
        }

        if (target.tagName === "TEXTAREA") {
            if (event.ctrlKey || event.altKey) {
                return focusAdjacentField(target, delta, event);
            }

            return handleTextareaBoundaryNavigation(target, delta, event);
        }

        if (isSingleLineInput(target) || isCheckableInput(target)) {
            return focusAdjacentField(target, delta, event);
        }

        return false;
    }

    function clearSelectStateAfterBlur(select) {
        window.setTimeout(function () {
            if (document.activeElement === select) {
                return;
            }

            delete select.dataset.xgwSelectConfirmed;
            delete select.dataset.xgwSelectPickerTried;
        }, 0);
    }

    function moveSelectOption(select, delta, event) {
        if (select.disabled || select.multiple || select.options.length === 0) {
            return false;
        }

        const pickerOpened = tryOpenSelectPicker(select);
        consumeKeyboardEvent(event);

        if (pickerOpened) {
            return true;
        }

        const currentIndex = select.selectedIndex < 0 ? 0 : select.selectedIndex;
        const nextIndex = Math.max(0, Math.min(select.options.length - 1, currentIndex + delta));

        if (nextIndex === currentIndex) {
            return true;
        }

        select.selectedIndex = nextIndex;
        select.dispatchEvent(new Event("change", {bubbles: true}));

        return true;
    }

    function tryOpenSelectPicker(select) {
        if (select.dataset.xgwSelectPickerTried === "1") {
            return false;
        }

        select.dataset.xgwSelectPickerTried = "1";

        try {
            if (typeof select.showPicker === "function") {
                select.showPicker();
                return true;
            }
        } catch (error) {
            console.log("select picker open is not supported in this browser", error);
        }

        try {
            select.click();
        } catch (error) {
            console.log("select click open is not supported in this browser", error);
        }

        return false;
    }

    function markSelectConfirmed(select) {
        select.dataset.xgwSelectConfirmed = "1";
    }

    function handleTextareaBoundaryNavigation(textarea, delta, event) {
        if (textarea.selectionStart !== textarea.selectionEnd) {
            return false;
        }

        const cursor = textarea.selectionStart;
        const isAtStart = cursor === 0;
        const isAtEnd = cursor === textarea.value.length;

        if ((delta < 0 && isAtStart) || (delta > 0 && isAtEnd)) {
            return focusAdjacentField(textarea, delta, event);
        }

        return false;
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

        event.preventDefault();

        const nextIndex = Math.max(0, Math.min(radios.length - 1, currentIndex + delta));

        if (nextIndex === currentIndex) {
            return true;
        }

        const nextRadio = radios[nextIndex];

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

    function focusAdjacentField(current, delta, event, stopPropagation) {
        if (stopPropagation) {
            consumeKeyboardEvent(event);
        }

        const fields = getNavigableFields();
        const currentIndex = fields.indexOf(current);

        if (currentIndex < 0) {
            return Boolean(stopPropagation);
        }

        const nextIndex = Math.max(0, Math.min(fields.length - 1, currentIndex + delta));

        if (nextIndex === currentIndex) {
            consumeKeyboardEvent(event);
            return true;
        }

        const nextField = fields[nextIndex];

        consumeKeyboardEvent(event);
        nextField.focus();

        if (isSingleLineInput(nextField)) {
            nextField.select();
        }

        return true;
    }

    function consumeKeyboardEvent(event) {
        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
    }

    function getNavigableFields() {
        const selector = [
            'input:not([type="hidden"])',
            "select",
            "textarea"
        ].join(",");

        return Array.from(document.querySelectorAll(selector)).filter(isNavigableField);
    }

    function isNavigableField(element) {
        if (!isFormFieldTarget(element)) {
            return false;
        }

        if (element.disabled || element.readOnly) {
            return false;
        }

        if (element.closest("[hidden], [aria-hidden='true']")) {
            return false;
        }

        if (element.closest(".user-modal-mask[style*='display: none']")) {
            return false;
        }

        if (!isVisibleElement(element)) {
            return false;
        }

        if (element.tagName === "INPUT") {
            const type = String(element.type || "text").toLowerCase();
            return !["button", "submit", "reset", "hidden", "file", "image"].includes(type);
        }

        return element.tagName === "SELECT" || element.tagName === "TEXTAREA";
    }

    function isFormFieldTarget(target) {
        if (!target || !target.tagName) {
            return false;
        }

        return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
    }

    function isSingleLineInput(element) {
        if (!element || element.tagName !== "INPUT") {
            return false;
        }

        const type = String(element.type || "text").toLowerCase();

        return ["text", "url", "number", "date", "password", "search", "email", "tel"].includes(type);
    }

    function isCheckableInput(element) {
        if (!element || element.tagName !== "INPUT") {
            return false;
        }

        const type = String(element.type || "").toLowerCase();

        return type === "checkbox";
    }

    function isVisibleElement(element) {
        const rects = element.getClientRects();

        if (!rects || rects.length === 0) {
            return false;
        }

        const style = window.getComputedStyle(element);

        return style.display !== "none" && style.visibility !== "hidden";
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
