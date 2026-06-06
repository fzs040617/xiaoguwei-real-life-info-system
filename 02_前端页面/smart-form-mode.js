// smart-form-mode.js
// 智能识别表单模式：
// 1. 智能识别只负责把结果填进原表单
// 2. 原表单就是用户校正区
// 3. 隐藏重复的识别预览大段文字
// 4. 移除单独的“识别结果校正”面板
// 5. 移除智能识别区自己的“确认同步到系统”按钮
// 6. 保留小型可展开进度日志

(function () {
    window.addEventListener("load", () => {
        setTimeout(initSmartFormMode, 500);
    });

    function initSmartFormMode() {
        removeSmartConfirmButtons();
        hideSmartPreviewBlocks();
        removeSmartEditPanelForever();
        compactAllSmartProgress();
        renameOriginalSubmitButtons();
        updateSmartNotices();
    }

    function removeSmartConfirmButtons() {
        const ids = [
            "mapSmartConfirmBtn",
            "routeSmartConfirmBtn",
            "genericSmartConfirmBtn"
        ];

        ids.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.remove();
            }
        });
    }

    function hideSmartPreviewBlocks() {
        const ids = [
            "mapSmartPreview",
            "routeSmartPreview",
            "genericSmartPreview"
        ];

        ids.forEach(id => {
            const box = document.getElementById(id);

            if (box) {
                box.innerText = "";
                box.style.display = "none";
            }
        });
    }

    function removeSmartEditPanelForever() {
        const removePanel = () => {
            const panel = document.getElementById("smartEditPanel");
            if (panel) {
                panel.remove();
            }
        };

        removePanel();

        const oldShowSmartEditPanel = window.showSmartEditPanel;

        window.showSmartEditPanel = function (pageType, data) {
            return;
        };

        const observer = new MutationObserver(() => {
            removePanel();
            removeSmartConfirmButtons();
            hideSmartPreviewBlocks();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function compactAllSmartProgress() {
        const progressBox = document.getElementById("smartProgressBox");

        if (!progressBox) {
            return;
        }

        const smartInput =
            document.getElementById("mapSmartInput") ||
            document.getElementById("routeSmartInput") ||
            document.getElementById("genericSmartInput");

        if (!smartInput) {
            return;
        }

        const smartBox = smartInput.closest(".box") || smartInput.closest("div");

        if (!smartBox) {
            return;
        }

        if (document.getElementById("smartCompactActionRow")) {
            return;
        }

        const parseButton = findSmartButton(smartBox, [
            "parseMapSmartText",
            "parseRouteSmartText",
            "parseGenericSmartText"
        ]);

        const clearButton = findSmartButton(smartBox, [
            "clearMapSmartInput",
            "clearRouteSmartInput",
            "clearGenericSmartInput"
        ]);

        const actionRow = document.createElement("div");
        actionRow.id = "smartCompactActionRow";
        actionRow.style.display = "flex";
        actionRow.style.alignItems = "flex-start";
        actionRow.style.gap = "10px";
        actionRow.style.flexWrap = "wrap";
        actionRow.style.marginTop = "10px";

        const buttonGroup = document.createElement("div");
        buttonGroup.style.display = "flex";
        buttonGroup.style.gap = "8px";
        buttonGroup.style.alignItems = "center";

        if (parseButton) {
            buttonGroup.appendChild(parseButton);
        }

        if (clearButton) {
            buttonGroup.appendChild(clearButton);
        }

        const details = document.createElement("details");
        details.id = "smartCompactProgressDetails";
        details.style.minWidth = "240px";
        details.style.maxWidth = "420px";
        details.style.flex = "1";
        details.style.fontSize = "12px";

        const summary = document.createElement("summary");
        summary.innerText = "智能识别进度";
        summary.style.cursor = "pointer";
        summary.style.color = "#1f7a4d";
        summary.style.fontWeight = "600";

        progressBox.style.marginTop = "8px";
        progressBox.style.fontSize = "12px";
        progressBox.style.maxHeight = "150px";
        progressBox.style.overflowY = "auto";
        progressBox.style.padding = "10px";

        details.appendChild(summary);
        details.appendChild(progressBox);

        actionRow.appendChild(buttonGroup);
        actionRow.appendChild(details);

        const smartTextarea = smartBox.querySelector("textarea");

        if (smartTextarea) {
            smartTextarea.insertAdjacentElement("afterend", actionRow);
        } else {
            smartBox.appendChild(actionRow);
        }
    }

    function findSmartButton(container, keywords) {
        const buttons = Array.from(container.querySelectorAll("button"));

        return buttons.find(button => {
            const code = button.getAttribute("onclick") || "";
            return keywords.some(keyword => code.includes(keyword));
        });
    }

    function renameOriginalSubmitButtons() {
        const buttons = Array.from(document.querySelectorAll("button"));

        buttons.forEach(button => {
            const code = button.getAttribute("onclick") || "";

            if (
                code.includes("createRoute") ||
                code.includes("createMapPoint") ||
                code.includes("submitClue") ||
                code.includes("submitCrawlTarget") ||
                code.includes("submitFeedback")
            ) {
                button.innerText = "确认同步到系统";
            }
        });
    }

    function updateSmartNotices() {
        const smartBoxes = [
            document.getElementById("routeSmartBox"),
            document.getElementById("mapSmartInput") ? document.getElementById("mapSmartInput").closest(".box") : null,
            document.getElementById("genericSmartInput") ? document.getElementById("genericSmartInput").closest(".box") : null
        ];

        smartBoxes.forEach(box => {
            if (!box) {
                return;
            }

            const notice = box.querySelector(".notice");

            if (notice) {
                notice.innerText = "输入自然语言信息后，系统会自动填入下面的原表单。你可以直接在原表单里修改，确认无误后点击原表单里的“确认同步到系统”。";
            }
        });
    }
})();