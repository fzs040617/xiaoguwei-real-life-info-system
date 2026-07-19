// history-filter-v2.js
// 增强 history.html：支持 target_id 筛选，并支持从 URL 参数自动筛选单条历史。

(function () {
    const API_BASE = "http://127.0.0.1:8000";

    window.addEventListener("load", () => {
        injectTargetIdFilter();
        applyHistoryUrlParams();
        window.loadHistoryList = loadHistoryListV2;
        loadHistoryListV2();
    });

    function injectTargetIdFilter() {
        if (document.getElementById("historyTargetId")) {
            return;
        }

        const typeSelect = document.getElementById("historyTargetType");
        if (!typeSelect) {
            return;
        }

        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML = `
            <label>对象 ID，可为空</label>
            <input id="historyTargetId" placeholder="例如：8" onkeydown="handleHistoryTargetIdKeyDown(event)">
        `;

        const typeRow = typeSelect.closest(".form-row");
        if (typeRow) {
            typeRow.insertAdjacentElement("afterend", row);
        }
    }

    function applyHistoryUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const targetType = params.get("target_type");
        const targetId = params.get("target_id");

        const typeSelect = document.getElementById("historyTargetType");
        const idInput = document.getElementById("historyTargetId");

        if (typeSelect && targetType) {
            typeSelect.value = targetType;
        }

        if (idInput && targetId) {
            idInput.value = targetId;
        }
    }

    window.handleHistoryTargetIdKeyDown = function (event) {
        if (event.key === "Enter") {
            loadHistoryListV2();
        }
    };

    async function loadHistoryListV2() {
        const box = document.getElementById("historyList");
        const keyword = document.getElementById("historyKeyword") ? document.getElementById("historyKeyword").value.trim() : "";
        const targetType = document.getElementById("historyTargetType") ? document.getElementById("historyTargetType").value : "全部";
        const targetId = document.getElementById("historyTargetId") ? document.getElementById("historyTargetId").value.trim() : "";

        const params = new URLSearchParams();

        if (keyword) {
            params.set("keyword", keyword);
        }

        if (targetType && targetType !== "全部") {
            params.set("target_type", targetType);
        }

        if (targetId) {
            params.set("target_id", targetId);
        }

        box.innerHTML = `<div class="empty">正在加载更新历史...</div>`;

        try {
            const response = await fetch(`${API_BASE}/update-history?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                box.innerHTML = `<div class="empty">加载失败：${JSON.stringify(data)}</div>`;
                return;
            }

            const histories = data.data || [];

            if (histories.length === 0) {
                box.innerHTML = `<div class="empty">当前筛选下暂无更新历史。</div>`;
                return;
            }

            box.innerHTML = histories.map(item => `
                <div class="card">
                    <div>
                        <span class="tag">${escapeHistoryHtmlV2(getTargetTypeTextV2(item.target_type))}</span>
                        <span class="tag">${escapeHistoryHtmlV2(item.action || "更新")}</span>
                        <span class="tag">ID：${item.target_id}</span>
                    </div>

                    <h3>${escapeHistoryHtmlV2(item.title || "未命名对象")}</h3>

                    <div>操作人：${escapeHistoryHtmlV2(item.operator || "系统")}</div>
                    <div>时间：${escapeHistoryHtmlV2(item.created_at || "未知")}</div>
                    <div class="summary">${escapeHistoryHtmlV2(item.detail || "暂无详情")}</div>

                    ${buildHistoryTargetButtonV2(item)}
                </div>
            `).join("");

        } catch (error) {
            box.innerHTML = `<div class="empty">加载失败，请确认后端已启动。${escapeHistoryHtmlV2(error.message)}</div>`;
        }
    }

    function getTargetTypeTextV2(type) {
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

    function buildHistoryTargetButtonV2(item) {
        if (item.target_type === "clue") {
            return `<button class="small-button" onclick="location.href='clue-detail.html?id=${item.target_id}'">查看线索详情</button>`;
        }

        if (item.target_type === "verified") {
            return `<button class="small-button" onclick="location.href='item-detail.html?id=${item.target_id}'">查看真实库详情</button>`;
        }

        if (item.target_type === "map_point") {
            return `<button class="small-button" onclick="location.href='map.html'">打开地图中心</button>`;
        }

        if (item.target_type === "route") {
            return `<button class="small-button" onclick="location.href='route.html'">打开路线中心</button>`;
        }

        if (item.target_type === "feedback") {
            return `<button class="small-button" onclick="location.href='feedback-admin.html'">打开反馈中心</button>`;
        }

        if (item.target_type === "crawl_target") {
            return `<button class="small-button" onclick="location.href='crawler.html'">打开采集管理</button>`;
        }

        return "";
    }

    function escapeHistoryHtmlV2(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();