if (window.__DASHBOARD_V2_LOADED__) {
    console.log("dashboard-v2.js 已加载，跳过重复执行");
} else {
    window.__DASHBOARD_V2_LOADED__ = true;
// dashboard-v2.js
// 综合数据看板 V2：汇总线索、真实库、地图点、路线、反馈、历史、采集目标。

    const DASHBOARD_V2_API = "http://127.0.0.1:8000";

    window.addEventListener("load", () => {
        setTimeout(loadDashboardV2WithPermission, 500);
    });
    async function loadDashboardV2WithPermission() {
        const permissionRole = await checkDashboardAdminPermission();

        if (permissionRole !== "admin") {
            renderDashboardNoPermission(permissionRole);
            return;
        }

        loadDashboardV2();
    }

    async function checkDashboardAdminPermission() {
        const token = localStorage.getItem("xgw_user_token");

        if (!token) {
            return "guest";
        }

        try {
            const response = await fetch("http://127.0.0.1:8000/auth/me", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem("xgw_user_token");
                    notifyDashboardAuthChanged();
                }

                return "guest";
            }

            const user = data.data || {};
            return user.role === "admin" ? "admin" : "user";

        } catch (error) {
            console.log("数据看板权限检查失败", error);
            return "guest";
        }
    }

    function renderDashboardNoPermission(role) {
        const container = document.querySelector(".container");

        if (!container) {
            return;
        }

        const roleText = role === "user" ? "\u666e\u901a\u7528\u6237" : "\u672a\u767b\u5f55\u7528\u6237";
        container.dataset.permissionBlocked = "true";
        container.dataset.permissionRole = role || "guest";
        container.innerHTML = `
            <div class="box">
                <h2>\u65e0\u6743\u9650\u8bbf\u95ee</h2>
                <p class="notice">
                    \u5f53\u524d\u8eab\u4efd\u662f\uff1a${roleText}\u3002
                    \u8be5\u9875\u9762\u5c5e\u4e8e\u7cfb\u7edf\u7ba1\u7406\u529f\u80fd\uff0c\u4ec5\u7ba1\u7406\u5458\u53ef\u4ee5\u67e5\u770b\u548c\u64cd\u4f5c\u3002
                </p>

                <div class="action-row">
                    <button onclick="location.href='index.html'">\u8fd4\u56de\u9996\u9875</button>
                    <button onclick="openLoginModal()">\u767b\u5f55\u7ba1\u7406\u5458\u8d26\u53f7</button>
                </div>
            </div>
        `;
        return;

        container.innerHTML = `
            <div class="box">
                <h2>无权限访问</h2>
                <p class="notice">
                    数据看板属于系统管理功能，仅管理员可以查看。普通用户不能查看系统统计、反馈统计、采集目标和更新历史。
                </p>
    
                <div class="action-row">
                    <button onclick="location.href='index.html'">返回首页</button>
                    <button onclick="openLoginModal()">登录管理员账号</button>
                </div>
            </div>
        `;
    }

    function notifyDashboardAuthChanged() {
        try {
            window.dispatchEvent(new CustomEvent("xgw-auth-changed"));
        } catch (error) {
            console.log("dashboard auth changed event failed", error);
        }
    }

    async function loadDashboardV2() {
        injectDashboardV2Box();

        const box = document.getElementById("dashboardV2Box");

        if (!box) {
            return;
        }

        box.innerHTML = `<div class="empty">正在加载综合数据看板...</div>`;

        try {
            const [
                clues,
                verifiedItems,
                mapPoints,
                routes,
                feedbacks,
                histories,
                crawlTargets
            ] = await Promise.all([
                safeDashboardFetch("/clues"),
                safeDashboardFetch("/verified-items"),
                safeDashboardFetch("/map-points?status=全部"),
                safeDashboardFetch("/routes?status=全部"),
                safeDashboardFetch("/feedbacks"),
                safeDashboardFetch("/update-history"),
                safeDashboardFetch("/crawler/targets")
            ]);

            renderDashboardV2({
                clues,
                verifiedItems,
                mapPoints,
                routes,
                feedbacks,
                histories,
                crawlTargets
            });

        } catch (error) {
            box.innerHTML = `
            <div class="empty">
                数据看板加载失败：${escapeDashboardV2Html(error.message)}
                <br>
                请确认后端已启动，并且 /docs 可以打开。
            </div>
        `;
        }
    }

    function injectDashboardV2Box() {
        if (document.getElementById("dashboardV2Box")) {
            return;
        }

        const mount = document.getElementById("dashboardV2Mount");

        if (mount) {
            mount.className = "section";
            mount.innerHTML = `
                <h2>综合数据看板 V2</h2>
                <p class="notice">
                    汇总线索、真实库、地图点、路线、反馈、更新历史和采集目标，方便判断系统当前运行状态。
                </p>
                <div id="dashboardV2Box" class="empty">正在加载综合数据看板...</div>
            `;
            return;
        }

        const container = document.querySelector(".container") || document.body;

        const section = document.createElement("div");
        section.className = "section";
        section.id = "dashboardV2Section";

        section.innerHTML = `
            <h2>综合数据看板 V2</h2>
            <p class="notice">
                汇总线索、真实库、地图点、路线、反馈、更新历史和采集目标，方便判断系统当前运行状态。
            </p>
            <div id="dashboardV2Box" class="empty">正在加载综合数据看板...</div>
        `;

        container.prepend(section);
    }

    async function safeDashboardFetch(path) {
        try {
            const response = await fetch(`${DASHBOARD_V2_API}${path}`);
            const data = await response.json();

            if (!response.ok) {
                return {
                    count: 0,
                    data: [],
                    error: data
                };
            }

            return data;
        } catch (error) {
            return {
                count: 0,
                data: [],
                error: error.message
            };
        }
    }

    function renderDashboardV2(payload) {
        const box = document.getElementById("dashboardV2Box");

        const clues = payload.clues.data || [];
        const verifiedItems = payload.verifiedItems.data || [];
        const mapPoints = payload.mapPoints.data || [];
        const routes = payload.routes.data || [];
        const feedbacks = payload.feedbacks.data || [];
        const histories = payload.histories.data || [];
        const crawlTargets = payload.crawlTargets.data || [];

        const pendingClues = clues.filter(item => (item.status || "").includes("待核验"));
        const approvedClues = clues.filter(item => (item.status || "").includes("已转入真实库"));
        const archivedMapPoints = mapPoints.filter(item => item.status === "已归档");
        const archivedRoutes = routes.filter(item => item.status === "已归档");

        const feedbackStats = buildFeedbackStats(feedbacks);
        const historyStats = buildHistoryStats(histories);
        const topFeedbackTargets = buildTopFeedbackTargets(feedbacks, clues, verifiedItems, mapPoints, routes);
        const latestHistories = histories.slice(0, 8);

        box.innerHTML = `
        <div class="dashboard-grid">
            ${renderMetricCard("线索总数", clues.length, `待核验：${pendingClues.length}，已转真实库：${approvedClues.length}`)}
            ${renderMetricCard("真实库数量", verifiedItems.length, "已沉淀的真实生活信息")}
            ${renderMetricCard("地图点数量", mapPoints.length, `已归档：${archivedMapPoints.length}`)}
            ${renderMetricCard("路线数量", routes.length, `已归档：${archivedRoutes.length}`)}
            ${renderMetricCard("反馈总数", feedbacks.length, `地图点：${feedbackStats.map_point}，路线：${feedbackStats.route}`)}
            ${renderMetricCard("更新历史", histories.length, `今日/最近记录：${latestHistories.length}`)}
            ${renderMetricCard("采集目标", crawlTargets.length, "公开网页与自动采集入口")}
        </div>

        <div class="section">
            <h2>待处理事项</h2>
            ${renderTodoSection(pendingClues, feedbacks)}
        </div>

        <div class="section">
            <h2>反馈统计</h2>
            ${renderFeedbackStatsSection(feedbackStats)}
        </div>

        <div class="section">
            <h2>反馈最多的信息</h2>
            ${renderTopFeedbackTargets(topFeedbackTargets)}
        </div>

        <div class="section">
            <h2>最近更新历史</h2>
            ${renderLatestHistories(latestHistories)}
        </div>

        <div class="section">
            <h2>采集目标状态</h2>
            ${renderCrawlerTargets(crawlTargets)}
        </div>
    `;
    }

    function renderMetricCard(title, value, desc) {
        return `
        <div class="card">
            <h3>${escapeDashboardV2Html(title)}</h3>
            <div style="font-size:32px; font-weight:700; color:#1f7a4d; margin:10px 0;">${value}</div>
            <div>${escapeDashboardV2Html(desc || "")}</div>
        </div>
    `;
    }

    function renderTodoSection(pendingClues, feedbacks) {
        const urgentFeedbacks = feedbacks.filter(item => {
            const type = item.feedback_type || "";
            return type.includes("纠错") || type.includes("已过期") || type.includes("价格信息");
        });

        return `
        <div class="dashboard-grid">
            <div class="card">
                <h3>待核验线索</h3>
                <p>数量：${pendingClues.length}</p>
                <button class="small-button" onclick="location.href='admin.html'">去审核中心</button>
            </div>

            <div class="card">
                <h3>需关注反馈</h3>
                <p>纠错 / 已过期 / 价格信息：${urgentFeedbacks.length}</p>
                <button class="small-button" onclick="location.href='feedback-admin.html'">去反馈中心</button>
            </div>
        </div>
    `;
    }

    function buildFeedbackStats(feedbacks) {
        const stats = {
            clue: 0,
            verified: 0,
            map_point: 0,
            route: 0,
            typeCounts: {}
        };

        feedbacks.forEach(item => {
            if (stats[item.target_type] !== undefined) {
                stats[item.target_type] += 1;
            }

            const type = item.feedback_type || "补充信息";
            stats.typeCounts[type] = (stats.typeCounts[type] || 0) + 1;
        });

        return stats;
    }

    function renderFeedbackStatsSection(stats) {
        const typeRows = Object.keys(stats.typeCounts).map(type => `
        <div class="card">
            <span class="tag">${escapeDashboardV2Html(type)}</span>
            <span>数量：${stats.typeCounts[type]}</span>
        </div>
    `).join("");

        return `
        <div class="dashboard-grid">
            <div class="card">
                <h3>对象类型分布</h3>
                <p>线索反馈：${stats.clue}</p>
                <p>真实库反馈：${stats.verified}</p>
                <p>地图点反馈：${stats.map_point}</p>
                <p>路线反馈：${stats.route}</p>
            </div>

            <div>
                ${typeRows || `<div class="empty">暂无反馈类型数据</div>`}
            </div>
        </div>
    `;
    }

    function buildTopFeedbackTargets(feedbacks, clues, verifiedItems, mapPoints, routes) {
        const clueMap = buildIdMap(clues);
        const verifiedMap = buildIdMap(verifiedItems);
        const mapPointMap = buildIdMap(mapPoints);
        const routeMap = buildIdMap(routes);

        const counts = {};

        feedbacks.forEach(item => {
            const key = `${item.target_type}:${item.target_id}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        return Object.keys(counts)
            .sort((a, b) => counts[b] - counts[a])
            .slice(0, 6)
            .map(key => {
                const [targetType, targetIdText] = key.split(":");
                const targetId = Number(targetIdText);

                let target = null;

                if (targetType === "clue") target = clueMap[targetId];
                if (targetType === "verified") target = verifiedMap[targetId];
                if (targetType === "map_point") target = mapPointMap[targetId];
                if (targetType === "route") target = routeMap[targetId];

                return {
                    targetType,
                    targetId,
                    count: counts[key],
                    title: target ? target.title || target.name : "关联对象可能已删除",
                    category: target ? target.category || "未分类" : "未知分类"
                };
            });
    }

    function renderTopFeedbackTargets(list) {
        if (list.length === 0) {
            return `<div class="empty">暂无反馈对象排行。</div>`;
        }

        return list.map(item => `
        <div class="card">
            <div>
                <span class="tag">${escapeDashboardV2Html(getTargetTypeText(item.targetType))}</span>
                <span class="tag">${escapeDashboardV2Html(item.category)}</span>
            </div>
            <h3>${escapeDashboardV2Html(item.title)}</h3>
            <p>反馈数量：${item.count}</p>
            <button class="small-button" onclick="location.href='${buildTargetUrl(item.targetType, item.targetId)}'">查看详情</button>
        </div>
    `).join("");
    }

    function buildHistoryStats(histories) {
        const stats = {};

        histories.forEach(item => {
            const action = item.action || "更新";
            stats[action] = (stats[action] || 0) + 1;
        });

        return stats;
    }

    function renderLatestHistories(histories) {
        if (histories.length === 0) {
            return `<div class="empty">暂无更新历史。</div>`;
        }

        return histories.map(item => `
        <div class="card">
            <div>
                <span class="tag">${escapeDashboardV2Html(getTargetTypeText(item.target_type))}</span>
                <span class="tag">${escapeDashboardV2Html(item.action || "更新")}</span>
                <span class="tag">ID：${item.target_id}</span>
            </div>
            <h3>${escapeDashboardV2Html(item.title || "未命名对象")}</h3>
            <p>时间：${escapeDashboardV2Html(item.created_at || "未知")}</p>
            <div class="summary">${escapeDashboardV2Html(item.detail || "暂无详情")}</div>
            <button class="small-button" onclick="location.href='history.html?target_type=${item.target_type}&target_id=${item.target_id}'">查看本条历史</button>
        </div>
    `).join("");
    }

    function renderCrawlerTargets(targets) {
        if (targets.length === 0) {
            return `<div class="empty">暂无采集目标。</div>`;
        }

        return targets.slice(0, 8).map(item => `
        <div class="card">
            <div>
                <span class="tag">${escapeDashboardV2Html(item.category || "外部线索")}</span>
                <span class="tag">${item.enabled ? "启用" : "停用"}</span>
            </div>
            <h3>${escapeDashboardV2Html(item.url || "未命名采集目标")}</h3>
            <p>来源平台：${escapeDashboardV2Html(item.source_platform || "未知")}</p>
            <div class="summary">${escapeDashboardV2Html(item.note || "暂无备注")}</div>
            <button class="small-button" onclick="location.href='crawler.html'">管理采集目标</button>
        </div>
    `).join("");
    }

    function buildIdMap(list) {
        const map = {};

        list.forEach(item => {
            map[item.id] = item;
        });

        return map;
    }

    function getTargetTypeText(type) {
        const map = {
            clue: "线索",
            verified: "真实库",
            map_point: "地图点",
            route: "路线",
            feedback: "反馈",
            crawl_target: "采集目标"
        };

        return map[type] || type || "未知对象";
    }

    function buildTargetUrl(type, id) {
        if (type === "clue") return `clue-detail.html?id=${id}`;
        if (type === "verified") return `item-detail.html?id=${id}`;
        if (type === "map_point") return `map-detail.html?id=${id}`;
        if (type === "route") return `route-detail.html?id=${id}`;
        return "dashboard.html";
    }

    function escapeDashboardV2Html(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
