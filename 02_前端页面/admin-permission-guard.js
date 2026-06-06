// admin-permission-guard.js
// 管理员权限守卫 V2：
// 1. 不再在“权限检查中”时误判为未登录
// 2. 普通用户不显示系统管理入口
// 3. 普通用户不能访问备份、数据看板、审核、采集、数据管理等页面
// 4. 管理员可以正常访问
// 5. 切换账号后无需手动刷新，权限界面会自动更新
// 6. token 未变化时复用已知角色，避免无权限页面反复请求 /auth/me

(function () {
    if (window.__ADMIN_PERMISSION_GUARD_V2_LOADED__) {
        return;
    }

    window.__ADMIN_PERMISSION_GUARD_V2_LOADED__ = true;

    const API_BASE = "http://127.0.0.1:8000";
    const TOKEN_KEY = "xgw_user_token";

    let lastToken = "__init__";
    let lastRole = "checking";
    let checking = false;
    let originalContainerHtml = null;
    let originalContainerStored = false;

    const adminOnlyPages = [
        "admin.html",
        "backup.html",
        "crawler.html",
        "dashboard.html",
        "feedback-admin.html",
        "manage.html"
    ];

    const adminOnlyButtonTexts = [
        "审核中心",
        "采集管理",
        "数据管理",
        "数据看板",
        "备份导出",
        "更新历史"
    ];

    window.addEventListener("load", () => {
        rememberOriginalContainer();
        startPermissionGuard();
    });

    const observer = new MutationObserver(() => {
        applyCurrentPermission();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function startPermissionGuard() {
        checkPermissionNow();

        setInterval(() => {
            const token = localStorage.getItem(TOKEN_KEY);

            if (token === lastToken && lastRole !== "checking") {
                applyCurrentPermission();
                return;
            }

            checkPermissionNow();
        }, 700);
    }

    async function checkPermissionNow() {
        if (checking) {
            return;
        }

        checking = true;

        const token = localStorage.getItem(TOKEN_KEY);
        const previousToken = lastToken;
        const previousRole = lastRole;

        if (!token) {
            lastToken = null;
            lastRole = "guest";
            applyCurrentPermission();

            checking = false;
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({token})
            });

            const data = await response.json();

            if (!response.ok) {
                lastToken = null;
                lastRole = "guest";
                applyCurrentPermission();

                checking = false;
                return;
            }

            const user = data.data || {};
            lastToken = token;
            lastRole = user.role || "user";

            // 如果当前页面之前被普通用户/未登录状态拦截了，现在切回管理员，直接重载当前页恢复正常页面结构。
            if (
                previousRole !== "admin" &&
                lastRole === "admin" &&
                isCurrentPageBlocked()
            ) {
                location.reload();
                return;
            }

            // 如果管理员切换成普通用户，立刻收起管理员模块。
            if (
                previousToken !== "__init__" &&
                previousRole === "admin" &&
                lastRole !== "admin"
            ) {
                removeAdminOnlyDynamicBlocks();
            }

            applyCurrentPermission();

        } catch (error) {
            console.log("管理员权限检查失败", error);
        }

        checking = false;
    }

    function rememberOriginalContainer() {
        const container = document.querySelector(".container");

        if (!container || originalContainerStored) {
            return;
        }

        originalContainerHtml = container.innerHTML;
        originalContainerStored = true;
    }

    function applyCurrentPermission() {
        const role = lastRole || "checking";

        // 关键修复：权限还在检查中时，什么都不要拦截。
        if (role === "checking") {
            return;
        }

        const isAdmin = role === "admin";
        const pageName = getCurrentPageName();

        hideAdminOnlyButtons(isAdmin);

        if (!isAdmin) {
            removeAdminOnlyDynamicBlocks();

            if (adminOnlyPages.includes(pageName)) {
                renderNoPermissionPage(role);
            }
        }
    }

    function getCurrentPageName() {
        const path = location.pathname || "";
        return decodeURIComponent(path.split("/").pop() || "index.html").toLowerCase();
    }

    function hideAdminOnlyButtons(isAdmin) {
        const buttons = Array.from(document.querySelectorAll("button, a"));

        buttons.forEach(el => {
            const text = (el.innerText || "").trim();

            if (!text) {
                return;
            }

            const isAdminButton = adminOnlyButtonTexts.some(keyword => text.includes(keyword));

            if (!isAdminButton) {
                return;
            }

            if (isAdmin) {
                if (el.dataset.adminGuardHidden === "true") {
                    el.style.display = "";
                    el.dataset.adminGuardHidden = "false";
                }
            } else {
                el.style.display = "none";
                el.dataset.adminGuardHidden = "true";
            }
        });
    }

    function removeAdminOnlyDynamicBlocks() {
        const ids = [
            "backupImportMount",
            "backupImportBox",
            "backupImportLayout",
            "historyDangerButtonBox",
            "clearHistoryModalMask"
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.remove();
            }
        });
    }

    function isCurrentPageBlocked() {
        const container = document.querySelector(".container");

        if (!container) {
            return false;
        }

        return container.dataset.permissionBlocked === "true";
    }

    function renderNoPermissionPage(role) {
        const container = document.querySelector(".container");

        if (!container) {
            return;
        }

        if (container.dataset.permissionBlocked === "true") {
            return;
        }

        container.dataset.permissionBlocked = "true";

        const roleText = role === "guest" ? "未登录用户" : "普通用户";

        container.innerHTML = `
            <div class="box">
                <h2>无权限访问</h2>
                <p class="notice">
                    当前身份是：${escapeAdminGuardHtml(roleText)}。
                    该页面属于系统管理功能，仅管理员可以查看和操作。
                </p>

                <div class="action-row">
                    <button onclick="location.href='index.html'">返回首页</button>
                    <button onclick="openLoginModal()">登录管理员账号</button>
                </div>
            </div>
        `;
    }

    function escapeAdminGuardHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
})();
