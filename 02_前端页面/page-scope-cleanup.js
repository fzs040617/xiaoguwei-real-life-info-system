// page-scope-cleanup.js
// 页面作用域清理：
// 防止某些页面加载了不属于自己的模块。
// 当前重点：非 backup.html 页面不允许出现“备份导入”区域。

(function () {
    if (window.__PAGE_SCOPE_CLEANUP_LOADED__) {
        return;
    }

    window.__PAGE_SCOPE_CLEANUP_LOADED__ = true;

    window.addEventListener("load", () => {
        cleanWrongPageModules();
    });

    const observer = new MutationObserver(() => {
        cleanWrongPageModules();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function getCurrentPageName() {
        const path = location.pathname || "";
        const parts = path.split("/");
        return parts[parts.length - 1] || "index.html";
    }

    function cleanWrongPageModules() {
        const pageName = getCurrentPageName();

        if (pageName !== "backup.html") {
            removeElementById("backupImportBox");
            removeElementById("backupImportLayout");
        }

        if (pageName !== "history.html") {
            removeElementById("historyDangerButtonBox");
            removeElementById("clearHistoryModalMask");
        }
    }

    function removeElementById(id) {
        const el = document.getElementById(id);

        if (el) {
            el.remove();
        }
    }
})();