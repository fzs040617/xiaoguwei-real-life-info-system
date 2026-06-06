// global-loader.js
// 全局脚本加载器：
// 以后所有页面通用的 JS，都集中写在这里。
// 新增全局功能时，只改这个文件，不再逐个修改全部 HTML。

(function () {
    const GLOBAL_SCRIPT_VERSION = "59";

    const globalScripts = [
        "page-scope-cleanup.js",
        "user-widget.js",
        "user-widget-v2.js",
        "modal-shortcuts.js",
        "password-eye.js",
        "user-message-clear.js",
        "user-avatar-click-upload.js",
        "danger-message-clear.js",
        "admin-permission-guard.js"
    ];

    globalScripts.forEach(src => {
        loadGlobalScript(src, GLOBAL_SCRIPT_VERSION);
    });

    function loadGlobalScript(src, version) {
        const fullSrc = `${src}?v=${version}`;

        const alreadyLoadedExact = Array.from(document.scripts).some(script => {
            const scriptSrc = script.getAttribute("src") || "";
            return scriptSrc.includes(fullSrc);
        });

        if (alreadyLoadedExact) {
            return;
        }

        const script = document.createElement("script");
        script.src = fullSrc;
        script.defer = false;

        document.body.appendChild(script);
    }
})();
