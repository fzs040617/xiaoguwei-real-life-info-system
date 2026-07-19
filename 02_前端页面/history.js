const HISTORY_API_BASE = "http://127.0.0.1:8000";

async function loadHistoryList() {
    const box = document.getElementById("historyList");
    const keyword = document.getElementById("historyKeyword").value.trim();
    const targetType = document.getElementById("historyTargetType").value;

    const params = new URLSearchParams();

    if (keyword) {
        params.set("keyword", keyword);
    }

    if (targetType && targetType !== "全部") {
        params.set("target_type", targetType);
    }

    box.innerHTML = `<div class="empty">正在加载更新历史...</div>`;

    try {
        const response = await fetch(`${HISTORY_API_BASE}/update-history?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">加载失败：${JSON.stringify(data)}</div>`;
            return;
        }

        const histories = data.data || [];

        if (histories.length === 0) {
            box.innerHTML = `<div class="empty">暂无更新历史。</div>`;
            return;
        }

        box.innerHTML = histories.map(item => `
            <div class="card">
                <div>
                    <span class="tag">${escapeHistoryHtml(getTargetTypeText(item.target_type))}</span>
                    <span class="tag">${escapeHistoryHtml(item.action || "更新")}</span>
                    <span class="tag">ID：${item.target_id}</span>
                </div>

                <h3>${escapeHistoryHtml(item.title || "未命名对象")}</h3>

                <div>操作人：${escapeHistoryHtml(item.operator || "系统")}</div>
                <div>时间：${escapeHistoryHtml(item.created_at || "未知")}</div>
                <div class="summary">${escapeHistoryHtml(item.detail || "暂无详情")}</div>

                ${buildHistoryTargetButton(item)}
            </div>
        `).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">加载失败，请确认后端已启动。${escapeHistoryHtml(error.message)}</div>`;
    }
}

function handleHistorySearchKeyDown(event) {
    if (event.key === "Enter") {
        loadHistoryList();
    }
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

function buildHistoryTargetButton(item) {
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

function escapeHistoryHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}