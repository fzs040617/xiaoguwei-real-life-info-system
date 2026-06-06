// route-ui-refactor.js
// 路线中心交互重构：
// 1. 把“智能识别新建路线”移动到“新建路线”表单内部
// 2. 智能识别只负责填入路线表单
// 3. 不再显示单独的“识别结果校正”面板
// 4. 隐藏智能识别区自己的“确认同步到系统”按钮
// 5. 把进度日志缩小，放到智能识别按钮右侧，可展开
// 6. 新建路线表单按钮改为“确认同步到系统”

(function () {
    window.addEventListener("load", () => {
        setTimeout(initRouteUIRefactor, 400);
    });

    function initRouteUIRefactor() {
        if (!document.getElementById("routeName")) {
            return;
        }

        suppressRouteSmartEditPanel();
        moveSmartBoxIntoRouteForm();
        compactSmartProgress();
        hideSmartConfirmButton();
        renameRouteSubmitButton();
    }

    function suppressRouteSmartEditPanel() {
        const oldShowSmartEditPanel = window.showSmartEditPanel;

        window.showSmartEditPanel = function (pageType, data) {
            if (pageType === "route") {
                return;
            }

            if (typeof oldShowSmartEditPanel === "function") {
                return oldShowSmartEditPanel(pageType, data);
            }
        };

        const observer = new MutationObserver(() => {
            const panel = document.getElementById("smartEditPanel");

            if (panel) {
                panel.remove();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function moveSmartBoxIntoRouteForm() {
        const routeNameInput = document.getElementById("routeName");
        const routeFormBox = routeNameInput ? routeNameInput.closest(".box") : null;
        const smartBox = document.getElementById("routeSmartBox");

        if (!routeFormBox || !smartBox) {
            return;
        }

        if (smartBox.dataset.routeMerged === "true") {
            return;
        }

        smartBox.dataset.routeMerged = "true";

        smartBox.classList.remove("box");
        smartBox.style.border = "1px dashed #c9d8cf";
        smartBox.style.borderRadius = "12px";
        smartBox.style.padding = "14px";
        smartBox.style.margin = "14px 0";
        smartBox.style.background = "#f8fbf9";

        const title = smartBox.querySelector("h2");
        if (title) {
            title.innerText = "智能识别路线草稿";
            title.style.fontSize = "18px";
            title.style.marginTop = "0";
        }

        const notice = smartBox.querySelector(".notice");
        if (notice) {
            notice.innerText = "输入一段路线想法，系统会填入下面的新建路线表单。你可以直接在表单里修改，再点击“确认同步到系统”。";
        }

        const firstNotice = routeFormBox.querySelector(".notice");

        if (firstNotice) {
            firstNotice.insertAdjacentElement("afterend", smartBox);
        } else {
            routeFormBox.prepend(smartBox);
        }
    }

    function compactSmartProgress() {
        const smartBox = document.getElementById("routeSmartBox");
        const progressBox = document.getElementById("smartProgressBox");

        if (!smartBox || !progressBox) {
            return;
        }

        if (document.getElementById("routeSmartActionRow")) {
            return;
        }

        const parseBtn = findButtonByOnclick(smartBox, "parseRouteSmartText");
        const clearBtn = findButtonByOnclick(smartBox, "clearRouteSmartInput");

        const actionRow = document.createElement("div");
        actionRow.id = "routeSmartActionRow";
        actionRow.style.display = "flex";
        actionRow.style.alignItems = "flex-start";
        actionRow.style.gap = "10px";
        actionRow.style.flexWrap = "wrap";
        actionRow.style.marginTop = "10px";

        const buttonGroup = document.createElement("div");
        buttonGroup.style.display = "flex";
        buttonGroup.style.gap = "8px";
        buttonGroup.style.alignItems = "center";

        if (parseBtn) {
            buttonGroup.appendChild(parseBtn);
        }

        if (clearBtn) {
            buttonGroup.appendChild(clearBtn);
        }

        const details = document.createElement("details");
        details.id = "routeSmartProgressDetails";
        details.style.minWidth = "260px";
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

        const preview = document.getElementById("routeSmartPreview");

        if (preview) {
            preview.insertAdjacentElement("beforebegin", actionRow);
        } else {
            smartBox.appendChild(actionRow);
        }
    }

    function hideSmartConfirmButton() {
        const btn = document.getElementById("routeSmartConfirmBtn");

        if (btn) {
            btn.style.display = "none";
            btn.remove();
        }
    }

    function renameRouteSubmitButton() {
        const buttons = Array.from(document.querySelectorAll("button"));

        const createBtn = buttons.find(button => {
            const code = button.getAttribute("onclick") || "";
            return code.includes("createRoute");
        });

        if (createBtn) {
            createBtn.innerText = "确认同步到系统";
        }
    }

    function findButtonByOnclick(container, keyword) {
        const buttons = Array.from(container.querySelectorAll("button"));

        return buttons.find(button => {
            const code = button.getAttribute("onclick") || "";
            return code.includes(keyword);
        });
    }
})();