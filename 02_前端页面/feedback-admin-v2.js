// feedback-admin-v2.js
// 反馈中心 V2：支持线索、真实库、地图点、路线四类反馈展示。

const FEEDBACK_ADMIN_V2_API = "http://127.0.0.1:8000";
const FEEDBACK_ADMIN_V2_TOKEN_KEY = "xgw_user_token";

function getFeedbackAdminV2Token() {
    return localStorage.getItem(FEEDBACK_ADMIN_V2_TOKEN_KEY) || "";
}

window.addEventListener("load", () => {
    setTimeout(loadFeedbackAdminV2, 800);
});

async function loadFeedbackAdminV2() {
    const listBox = document.getElementById("feedbackAdminList");
    const statsBox = document.getElementById("feedbackStatsBox");

    if (!listBox || !statsBox) {
        return;
    }

    listBox.innerHTML = `<div class="empty">正在加载反馈列表...</div>`;
    statsBox.innerHTML = `<div class="empty">正在加载反馈统计...</div>`;

    try {
        const [feedbackRes, clueRes, verifiedRes, mapRes, routeRes] = await Promise.all([
            fetch(`${FEEDBACK_ADMIN_V2_API}/feedbacks`),
            fetch(`${FEEDBACK_ADMIN_V2_API}/clues`),
            fetch(`${FEEDBACK_ADMIN_V2_API}/verified-items`),
            fetch(`${FEEDBACK_ADMIN_V2_API}/map-points?status=全部`),
            fetch(`${FEEDBACK_ADMIN_V2_API}/routes?status=全部`)
        ]);

        const feedbackData = await feedbackRes.json();
        const clueData = await clueRes.json();
        const verifiedData = await verifiedRes.json();
        const mapData = await mapRes.json();
        const routeData = await routeRes.json();

        const feedbacks = feedbackData.data || [];
        const clueMap = buildObjectMap(clueData.data || []);
        const verifiedMap = buildObjectMap(verifiedData.data || []);
        const mapPointMap = buildObjectMap(mapData.data || []);
        const routeMap = buildObjectMap(routeData.data || []);

        renderFeedbackStatsV2(feedbacks);
        renderFeedbackListV2(feedbacks, clueMap, verifiedMap, mapPointMap, routeMap);

    } catch (error) {
        listBox.innerHTML = `<div class="empty">反馈中心加载失败：${escapeFeedbackAdminV2Html(error.message)}</div>`;
        statsBox.innerHTML = `<div class="empty">反馈统计加载失败</div>`;
    }
}

function buildObjectMap(list) {
    const map = {};

    list.forEach(item => {
        map[item.id] = item;
    });

    return map;
}

function renderFeedbackStatsV2(feedbacks) {
    const statsBox = document.getElementById("feedbackStatsBox");

    const counts = {
        clue: 0,
        verified: 0,
        map_point: 0,
        route: 0
    };

    const typeCounts = {};

    feedbacks.forEach(item => {
        if (counts[item.target_type] !== undefined) {
            counts[item.target_type] += 1;
        }

        const type = item.feedback_type || "补充信息";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const typeRows = Object.keys(typeCounts).map(type => `
        <div class="card">
            <span class="tag">${escapeFeedbackAdminV2Html(type)}</span>
            <span>数量：${typeCounts[type]}</span>
        </div>
    `).join("");

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
    `;
}

function renderFeedbackListV2(feedbacks, clueMap, verifiedMap, mapPointMap, routeMap) {
    const listBox = document.getElementById("feedbackAdminList");
    const keyword = document.getElementById("feedbackKeyword") ? document.getElementById("feedbackKeyword").value.trim().toLowerCase() : "";
    const targetTypeFilter = document.getElementById("feedbackTargetType") ? document.getElementById("feedbackTargetType").value : "all";
    const feedbackTypeFilter = document.getElementById("feedbackTypeFilter") ? document.getElementById("feedbackTypeFilter").value : "all";

    fillFeedbackTypeFilterV2(feedbacks);

    let list = feedbacks;

    if (targetTypeFilter !== "all") {
        list = list.filter(item => item.target_type === targetTypeFilter);
    }

    if (feedbackTypeFilter !== "all") {
        list = list.filter(item => item.feedback_type === feedbackTypeFilter);
    }

    if (keyword) {
        list = list.filter(item => {
            const target = getFeedbackTargetV2(item, clueMap, verifiedMap, mapPointMap, routeMap);
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
        const target = getFeedbackTargetV2(item, clueMap, verifiedMap, mapPointMap, routeMap);
        const title = target ? target.title || target.name : "关联对象可能已删除";
        const category = target ? target.category || "未分类" : "未知分类";
        const detailUrl = buildFeedbackTargetUrlV2(item);

        return `
            <div class="card">
                <div>
                    <span class="tag">${escapeFeedbackAdminV2Html(getFeedbackTargetTextV2(item.target_type))}</span>
                    <span class="tag">${escapeFeedbackAdminV2Html(item.feedback_type || "补充信息")}</span>
                    <span class="tag">${escapeFeedbackAdminV2Html(item.user_name || "匿名用户")}</span>
                </div>

                <h3>${escapeFeedbackAdminV2Html(title)}</h3>
                <p>关联分类：${escapeFeedbackAdminV2Html(category)}</p>
                <p>反馈时间：${escapeFeedbackAdminV2Html(item.created_at || "未知")}</p>

                <div class="summary">${escapeFeedbackAdminV2Html(item.content || "暂无反馈内容")}</div>

                <div class="action-row">
                    <button class="small-button" onclick="location.href='${detailUrl}'">查看关联详情</button>
                    <button class="small-button danger-button" onclick="deleteFeedbackAdminV2(${item.id})">删除反馈</button>
                </div>
            </div>
        `;
    }).join("");
}

function fillFeedbackTypeFilterV2(feedbacks) {
    const select = document.getElementById("feedbackTypeFilter");

    if (!select) {
        return;
    }

    const current = select.value || "all";
    const types = Array.from(new Set(feedbacks.map(item => item.feedback_type || "补充信息")));

    select.innerHTML = `<option value="all">全部类型</option>` + types.map(type => `
        <option value="${escapeFeedbackAdminV2Attr(type)}">${escapeFeedbackAdminV2Html(type)}</option>
    `).join("");

    if (types.includes(current)) {
        select.value = current;
    } else {
        select.value = "all";
    }
}

function getFeedbackTargetV2(item, clueMap, verifiedMap, mapPointMap, routeMap) {
    if (item.target_type === "clue") return clueMap[item.target_id];
    if (item.target_type === "verified") return verifiedMap[item.target_id];
    if (item.target_type === "map_point") return mapPointMap[item.target_id];
    if (item.target_type === "route") return routeMap[item.target_id];
    return null;
}

function getFeedbackTargetTextV2(type) {
    const map = {
        clue: "线索反馈",
        verified: "真实库反馈",
        map_point: "地图点反馈",
        route: "路线反馈"
    };

    return map[type] || "未知反馈";
}

function buildFeedbackTargetUrlV2(item) {
    if (item.target_type === "clue") return `clue-detail.html?id=${item.target_id}`;
    if (item.target_type === "verified") return `item-detail.html?id=${item.target_id}`;
    if (item.target_type === "map_point") return `map-detail.html?id=${item.target_id}`;
    if (item.target_type === "route") return `route-detail.html?id=${item.target_id}`;
    return "feedback-admin.html";
}

async function deleteFeedbackAdminV2(id) {
    if (!confirm("确认删除这条反馈吗？")) {
        return;
    }

    const response = await fetch(`${FEEDBACK_ADMIN_V2_API}/feedbacks/${id}?token=${encodeURIComponent(getFeedbackAdminV2Token())}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("反馈已删除。");
        await loadFeedbackAdminV2();
    } else {
        alert("删除失败。");
    }
}

function escapeFeedbackAdminV2Html(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeFeedbackAdminV2Attr(text) {
    return String(text || "").replace(/"/g, "&quot;");
}
