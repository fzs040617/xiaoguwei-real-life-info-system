// feedback-admin-final.js
// 反馈中心最终接管版：
// 解决旧版 feedback-admin.js 刷新后覆盖新版结果的问题。
// 支持：线索、真实库、地图点、路线反馈。

const FEEDBACK_FINAL_API = "http://127.0.0.1:8000";
const FEEDBACK_FINAL_TOKEN_KEY = "xgw_user_token";

function getFeedbackFinalToken() {
    return localStorage.getItem(FEEDBACK_FINAL_TOKEN_KEY) || "";
}

let feedbackFinalData = {
    feedbacks: [],
    clueMap: {},
    verifiedMap: {},
    mapPointMap: {},
    routeMap: {}
};

window.addEventListener("load", () => {
    setTimeout(() => {
        takeoverFeedbackAdminPage();
        loadFeedbackAdminFinal();
    }, 1000);
});

function takeoverFeedbackAdminPage() {
    window.loadFeedbackAdminPage = loadFeedbackAdminFinal;
    window.renderFeedbackAdminList = renderFeedbackAdminFinalList;
    window.loadFeedbackStats = loadFeedbackAdminFinal;
    window.loadAllFeedbacks = loadFeedbackAdminFinal;
    window.deleteFeedbackFromAdmin = deleteFeedbackFinal;

    window.handleFeedbackSearchKeyDown = function (event) {
        if (event.key === "Enter") {
            renderFeedbackAdminFinalList();
        }
    };

    const refreshButtons = Array.from(document.querySelectorAll("button"));
    refreshButtons.forEach(button => {
        const text = button.innerText || "";
        const onclick = button.getAttribute("onclick") || "";

        if (text.includes("刷新反馈") || onclick.includes("loadFeedbackAdminPage")) {
            button.setAttribute("onclick", "loadFeedbackAdminFinal()");
        }
    });

    fixFeedbackTargetTypeOptions();

    const targetSelect = document.getElementById("feedbackTargetType");
    if (targetSelect) {
        targetSelect.onchange = renderFeedbackAdminFinalList;
    }

    const typeSelect = document.getElementById("feedbackTypeFilter");
    if (typeSelect) {
        typeSelect.onchange = renderFeedbackAdminFinalList;
    }
}

function fixFeedbackTargetTypeOptions() {
    const select = document.getElementById("feedbackTargetType");

    if (!select) {
        return;
    }

    const current = select.value || "all";

    select.innerHTML = `
        <option value="all">全部</option>
        <option value="clue">线索反馈</option>
        <option value="verified">真实库反馈</option>
        <option value="map_point">地图点反馈</option>
        <option value="route">路线反馈</option>
    `;

    select.value = current;
}

async function loadFeedbackAdminFinal() {
    const listBox = document.getElementById("feedbackAdminList");
    const statsBox = document.getElementById("feedbackStatsBox");

    if (!listBox || !statsBox) {
        return;
    }

    listBox.innerHTML = `<div class="empty">正在加载反馈列表...</div>`;
    statsBox.innerHTML = `<div class="empty">正在加载反馈统计...</div>`;

    try {
        const [feedbackRes, clueRes, verifiedRes, mapRes, routeRes] = await Promise.all([
            fetch(`${FEEDBACK_FINAL_API}/feedbacks`),
            fetch(`${FEEDBACK_FINAL_API}/clues`),
            fetch(`${FEEDBACK_FINAL_API}/verified-items`),
            fetch(`${FEEDBACK_FINAL_API}/map-points?status=全部`),
            fetch(`${FEEDBACK_FINAL_API}/routes?status=全部`)
        ]);

        const feedbackData = await feedbackRes.json();
        const clueData = await clueRes.json();
        const verifiedData = await verifiedRes.json();
        const mapData = await mapRes.json();
        const routeData = await routeRes.json();

        feedbackFinalData.feedbacks = feedbackData.data || [];
        feedbackFinalData.clueMap = buildFeedbackFinalMap(clueData.data || []);
        feedbackFinalData.verifiedMap = buildFeedbackFinalMap(verifiedData.data || []);
        feedbackFinalData.mapPointMap = buildFeedbackFinalMap(mapData.data || []);
        feedbackFinalData.routeMap = buildFeedbackFinalMap(routeData.data || []);

        fixFeedbackTargetTypeOptions();
        fillFeedbackFinalTypeFilter();
        renderFeedbackFinalStats();
        renderFeedbackAdminFinalList();

    } catch (error) {
        statsBox.innerHTML = `<div class="empty">反馈统计加载失败：${escapeFeedbackFinalHtml(error.message)}</div>`;
        listBox.innerHTML = `<div class="empty">反馈列表加载失败：${escapeFeedbackFinalHtml(error.message)}</div>`;
    }
}

function buildFeedbackFinalMap(list) {
    const map = {};

    list.forEach(item => {
        map[item.id] = item;
    });

    return map;
}

function fillFeedbackFinalTypeFilter() {
    const select = document.getElementById("feedbackTypeFilter");

    if (!select) {
        return;
    }

    const current = select.value || "all";
    const types = Array.from(new Set(
        feedbackFinalData.feedbacks.map(item => item.feedback_type || "补充信息")
    ));

    select.innerHTML = `<option value="all">全部类型</option>` + types.map(type => `
        <option value="${escapeFeedbackFinalAttr(type)}">${escapeFeedbackFinalHtml(type)}</option>
    `).join("");

    if (types.includes(current)) {
        select.value = current;
    } else {
        select.value = "all";
    }
}

function renderFeedbackFinalStats() {
    const statsBox = document.getElementById("feedbackStatsBox");
    const feedbacks = feedbackFinalData.feedbacks;

    const counts = {
        clue: 0,
        verified: 0,
        map_point: 0,
        route: 0
    };

    const typeCounts = {};
    const targetCounts = {};

    feedbacks.forEach(item => {
        if (counts[item.target_type] !== undefined) {
            counts[item.target_type] += 1;
        }

        const feedbackType = item.feedback_type || "补充信息";
        typeCounts[feedbackType] = (typeCounts[feedbackType] || 0) + 1;

        const key = `${item.target_type}:${item.target_id}`;
        targetCounts[key] = (targetCounts[key] || 0) + 1;
    });

    const typeRows = Object.keys(typeCounts).map(type => `
        <div class="card">
            <span class="tag">${escapeFeedbackFinalHtml(type)}</span>
            <span>数量：${typeCounts[type]}</span>
        </div>
    `).join("");

    const topRows = Object.keys(targetCounts)
        .sort((a, b) => targetCounts[b] - targetCounts[a])
        .slice(0, 8)
        .map(key => {
            const [targetType, targetIdText] = key.split(":");
            const targetId = Number(targetIdText);
            const target = getFeedbackFinalTarget({ target_type: targetType, target_id: targetId });
            const title = target ? target.title || target.name : "关联对象可能已删除";
            const category = target ? target.category || "未分类" : "未知分类";
            const url = buildFeedbackFinalTargetUrl({ target_type: targetType, target_id: targetId });

            return `
                <div class="card">
                    <span class="tag">${escapeFeedbackFinalHtml(getFeedbackFinalTargetText(targetType))}</span>
                    <span class="tag">${escapeFeedbackFinalHtml(category)}</span>
                    <h3>${escapeFeedbackFinalHtml(title)}</h3>
                    <p>反馈数量：${targetCounts[key]}</p>
                    <button class="small-button" onclick="location.href='${url}'">查看详情</button>
                </div>
            `;
        }).join("");

    statsBox.innerHTML = `
        <div class="card">
            <h3>反馈总览</h3>
            <p>反馈总数：${feedbacks.length}</p>
            <p>线索反馈：${counts.clue}</p>
            <p>真实库反馈：${counts.verified}</p>
            <p>地图点反馈：${counts.map_point}</p>
            <p>路线反馈：${counts.route}</p>
        </div>

        <h3>反馈类型分布</h3>
        ${typeRows || `<div class="empty">暂无反馈类型数据</div>`}

        <h3>反馈最多的信息</h3>
        ${topRows || `<div class="empty">暂无高反馈对象</div>`}
    `;
}

function renderFeedbackAdminFinalList() {
    const listBox = document.getElementById("feedbackAdminList");

    if (!listBox) {
        return;
    }

    const keyword = document.getElementById("feedbackKeyword")
        ? document.getElementById("feedbackKeyword").value.trim().toLowerCase()
        : "";

    const targetTypeFilter = document.getElementById("feedbackTargetType")
        ? document.getElementById("feedbackTargetType").value
        : "all";

    const feedbackTypeFilter = document.getElementById("feedbackTypeFilter")
        ? document.getElementById("feedbackTypeFilter").value
        : "all";

    let list = feedbackFinalData.feedbacks;

    if (targetTypeFilter !== "all") {
        list = list.filter(item => item.target_type === targetTypeFilter);
    }

    if (feedbackTypeFilter !== "all") {
        list = list.filter(item => item.feedback_type === feedbackTypeFilter);
    }

    if (keyword) {
        list = list.filter(item => {
            const target = getFeedbackFinalTarget(item);
            const text = [
                item.feedback_type,
                item.content,
                item.user_name,
                target ? target.title || target.name : "",
                target ? target.category : ""
            ].join(" ").toLowerCase();

            return text.includes(keyword);
        });
    }

    if (list.length === 0) {
        listBox.innerHTML = `<div class="empty">当前筛选下暂无反馈</div>`;
        return;
    }

    listBox.innerHTML = list.map(item => {
        const target = getFeedbackFinalTarget(item);
        const title = target ? target.title || target.name : "关联对象可能已删除";
        const category = target ? target.category || "未分类" : "未知分类";
        const detailUrl = buildFeedbackFinalTargetUrl(item);

        return `
            <div class="card">
                <div>
                    <span class="tag">${escapeFeedbackFinalHtml(getFeedbackFinalTargetText(item.target_type))}</span>
                    <span class="tag">${escapeFeedbackFinalHtml(item.feedback_type || "补充信息")}</span>
                    <span class="tag">${escapeFeedbackFinalHtml(item.user_name || "匿名用户")}</span>
                </div>

                <h3>${escapeFeedbackFinalHtml(title)}</h3>
                <p>关联分类：${escapeFeedbackFinalHtml(category)}</p>
                <p>反馈时间：${escapeFeedbackFinalHtml(item.created_at || "未知")}</p>

                <div class="summary">${escapeFeedbackFinalHtml(item.content || "暂无反馈内容")}</div>

                <div class="action-row">
                    <button class="small-button" onclick="location.href='${detailUrl}'">查看关联详情</button>
                    <button class="small-button danger-button" onclick="deleteFeedbackFinal(${item.id})">删除反馈</button>
                </div>
            </div>
        `;
    }).join("");
}

function getFeedbackFinalTarget(item) {
    if (item.target_type === "clue") {
        return feedbackFinalData.clueMap[item.target_id];
    }

    if (item.target_type === "verified") {
        return feedbackFinalData.verifiedMap[item.target_id];
    }

    if (item.target_type === "map_point") {
        return feedbackFinalData.mapPointMap[item.target_id];
    }

    if (item.target_type === "route") {
        return feedbackFinalData.routeMap[item.target_id];
    }

    return null;
}

function getFeedbackFinalTargetText(type) {
    const map = {
        clue: "线索反馈",
        verified: "真实库反馈",
        map_point: "地图点反馈",
        route: "路线反馈"
    };

    return map[type] || "未知反馈";
}

function buildFeedbackFinalTargetUrl(item) {
    if (item.target_type === "clue") {
        return `clue-detail.html?id=${item.target_id}`;
    }

    if (item.target_type === "verified") {
        return `item-detail.html?id=${item.target_id}`;
    }

    if (item.target_type === "map_point") {
        return `map-detail.html?id=${item.target_id}`;
    }

    if (item.target_type === "route") {
        return `route-detail.html?id=${item.target_id}`;
    }

    return "feedback-admin.html";
}

async function deleteFeedbackFinal(id) {
    if (!confirm("确认删除这条反馈吗？")) {
        return;
    }

    try {
        const response = await fetch(`${FEEDBACK_FINAL_API}/feedbacks/${id}?token=${encodeURIComponent(getFeedbackFinalToken())}`, {
            method: "DELETE"
        });

        if (response.ok) {
            alert("反馈已删除。");
            await loadFeedbackAdminFinal();
        } else {
            const data = await response.json();
            alert("删除失败：" + JSON.stringify(data));
        }
    } catch (error) {
        alert("删除失败：" + error.message);
    }
}

function escapeFeedbackFinalHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeFeedbackFinalAttr(text) {
    return String(text || "").replace(/"/g, "&quot;");
}
