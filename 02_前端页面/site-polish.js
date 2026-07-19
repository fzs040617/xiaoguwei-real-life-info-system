// site-polish.js
// 全站视觉与可用性增强：统一品牌标题栏、当前导航、页面标识和页脚。
// 只调整前端展示，不修改接口、表单字段、权限判断或业务数据。

(function () {
    if (window.__XGW_SITE_POLISH_LOADED__) {
        return;
    }

    window.__XGW_SITE_POLISH_LOADED__ = true;

    const pageName = getCurrentPageName();
    const pageSlug = pageName.replace(/\.html$/i, "") || "index";

    document.documentElement.dataset.xgwEnhanced = "true";
    document.body.classList.add("xgw-polished", `xgw-page-${pageSlug}`);

    injectSkipLink();
    enhanceHeader();
    enhanceHero();
    injectFooter();

    window.addEventListener("load", () => {
        markCurrentNavigation();
    }, {once: true});

    window.addEventListener("xgw-auth-changed", () => {
        window.setTimeout(markCurrentNavigation, 0);
    });

    function getCurrentPageName() {
        const path = decodeURIComponent(window.location.pathname || "");
        return (path.split("/").pop() || "index.html").toLowerCase();
    }

    function enhanceHeader() {
        const header = document.querySelector(".header");
        const headerInner = header?.querySelector(".header-inner");
        const titleBlock = headerInner?.firstElementChild;
        const actions = headerInner?.querySelector(".header-actions");

        if (!header || !headerInner || !titleBlock || !actions) {
            return;
        }

        header.classList.add("xgw-site-header");
        actions.setAttribute("role", "navigation");
        actions.setAttribute("aria-label", "主导航");

        const originalHeading = (titleBlock.querySelector("h1")?.textContent || "").trim();
        const pageLabel = pageName === "index.html"
            ? "广州大学城真实生活信息"
            : (originalHeading || document.title.split("｜")[0] || "页面导航");

        titleBlock.className = "xgw-brand-slot";
        titleBlock.innerHTML = `
            <a class="xgw-brand" href="index.html" aria-label="返回小谷围生活共建首页">
                <span class="xgw-brand-mark" aria-hidden="true">谷</span>
                <span class="xgw-brand-copy">
                    <strong>小谷围生活共建</strong>
                    <small>${escapeHtml(pageLabel)}</small>
                </span>
            </a>
        `;

        Array.from(actions.querySelectorAll("button, a")).forEach(item => {
            const target = getNavigationTarget(item);
            if (!target) {
                return;
            }

            item.dataset.navTarget = target;
            item.classList.add("xgw-nav-item");

            if (isAdminTarget(target)) {
                item.classList.add("xgw-nav-admin");
            }
        });

        markCurrentNavigation();
    }

    function getNavigationTarget(item) {
        const href = item.getAttribute("href") || "";
        if (href) {
            return normalizeTarget(href);
        }

        const onclick = item.getAttribute("onclick") || "";
        const matched = onclick.match(/location\.href\s*=\s*['\"]([^'\"]+)['\"]/i);
        return matched ? normalizeTarget(matched[1]) : "";
    }

    function normalizeTarget(target) {
        const cleanTarget = String(target || "").split("?")[0].split("#")[0];
        return cleanTarget.split("/").pop()?.toLowerCase() || "";
    }

    function isAdminTarget(target) {
        return [
            "admin.html",
            "manage.html",
            "crawler.html",
            "dashboard.html",
            "backup.html",
            "feedback-admin.html",
            "user-admin.html"
        ].includes(target);
    }

    function markCurrentNavigation() {
        const actions = document.querySelector(".header-actions");
        if (!actions) {
            return;
        }

        Array.from(actions.querySelectorAll(".xgw-nav-item")).forEach(item => {
            const isCurrent = item.dataset.navTarget === pageName;
            item.classList.toggle("is-active", isCurrent);

            if (isCurrent) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });
    }

    function enhanceHero() {
        const hero = document.querySelector(".page-hero");
        if (!hero) {
            return;
        }

        hero.dataset.page = pageSlug;
        hero.classList.add("xgw-illustrated-hero");

        const visualLabel = document.createElement("span");
        visualLabel.className = "xgw-hero-visual-label";
        visualLabel.setAttribute("aria-hidden", "true");
        visualLabel.textContent = getHeroVisualLabel();
        hero.appendChild(visualLabel);
    }

    function getHeroVisualLabel() {
        const labels = {
            index: "发现 · 共建 · 核验",
            map: "地点 · 区域 · 关联",
            route: "动线 · 场景 · 体验",
            submit: "提交 · 确认 · 入库",
            history: "记录 · 追溯 · 审计",
            dashboard: "概览 · 趋势 · 状态",
            crawler: "来源 · 采集 · 复核",
            admin: "审核 · 抽检 · 沉淀",
            manage: "维护 · 治理 · 归档",
            backup: "备份 · 恢复 · 保护"
        };

        return labels[pageSlug] || "真实信息 · 共同核验";
    }

    function injectSkipLink() {
        if (document.querySelector(".xgw-skip-link")) {
            return;
        }

        const container = document.querySelector(".container");
        if (container && !container.id) {
            container.id = "mainContent";
        }

        const skipLink = document.createElement("a");
        skipLink.className = "xgw-skip-link";
        skipLink.href = container?.id ? `#${container.id}` : "#mainContent";
        skipLink.textContent = "跳到主要内容";
        document.body.prepend(skipLink);
    }

    function injectFooter() {
        if (document.querySelector(".xgw-footer")) {
            return;
        }

        const footer = document.createElement("footer");
        footer.className = "xgw-footer";
        footer.innerHTML = `
            <div class="xgw-footer-inner">
                <div class="xgw-footer-brand">
                    <span class="xgw-brand-mark xgw-brand-mark-small" aria-hidden="true">谷</span>
                    <div>
                        <strong>小谷围生活共建</strong>
                        <p>信息先进入线索库，经人工核验后再进入真实库。</p>
                    </div>
                </div>
                <nav class="xgw-footer-links" aria-label="页脚导航">
                    <a href="index.html">首页</a>
                    <a href="map.html">生活地图</a>
                    <a href="route.html">路线中心</a>
                    <a href="submit.html">提交线索</a>
                    <a href="history.html">更新记录</a>
                </nav>
                <p class="xgw-footer-note">共建信息仅作生活线索参考，价格、营业时间和安全相关内容请二次确认。</p>
            </div>
        `;

        document.body.appendChild(footer);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
