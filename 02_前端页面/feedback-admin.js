const API_BASE = "http://127.0.0.1:8000";

let allFeedbacks = [];
let clueMap = {};
let verifiedMap = {};

async function loadFeedbackAdminPage() {
    await loadFeedbackSourceData();
    await loadAllFeedbacks();
    await loadFeedbackStats();
}

async function loadFeedbackSourceData() {
    const clueResponse = await fetch(`${API_BASE}/clues`);
    const clueData = await clueResponse.json();

    const verifiedResponse = await fetch(`${API_BASE}/verified-items`);
    const verifiedData = await verifiedResponse.json();

    clueMap = {};
    verifiedMap = {};

    (clueData.data || []).forEach(item => {
        clueMap[item.id] = item;
    });

    (verifiedData.data || []).forEach(item => {
        verifiedMap[item.id] = item;
    });
}

async function loadAllFeedbacks() {
    const response = await fetch(`${API_BASE}/feedbacks`);
    const data = await response.json();

    allFeedbacks = data.data || [];

    fillFeedbackTypeFilter();
    renderFeedbackAdminList();
}

async function loadFeedbackStats() {
    const box = document.getElementById("feedbackStatsBox");

    try {
        const response = await fetch(`${API_BASE}/feedbacks/stats`);
        const data = await response.json();

        const typeRows = Object.keys(data.feedback_type_counts || {}).map(type => `
            <div class="card">
                <span class="tag">${escapeHtml(type)}</span>
                <span>数量：${data.feedback_type_counts[type]}</span>
            </div>
        `).join("");

        const topRows = (data.top_targets || []).map(item => {
            const detailUrl = item.target_type === "clue"
                ? `clue-detail.html?id=${item.target_id}`
                : `item-detail.html?id=${item.target_id}`;

            return `
                <div class="card">
                    <span class="tag">${item.target_type === "clue" ? "线索" : "真实库"}</span>
                    <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>反馈数量：${item.feedback_count}</p>
                    <button class="small-button" onclick="location.href='${detailUrl}'">查看详情</button>
                </div>
            `;
        }).join("");

        box.innerHTML = `
            <div class="card">
                <h3>反馈总览</h3>
                <p>反馈总数：${data.total_feedbacks}</p>
                <p>线索反馈：${data.clue_feedbacks}</p>
                <p>真实库反馈：${data.verified_feedbacks}</p>
            </div>

            <h3>反馈类型分布</h3>
            ${typeRows || `<div class="empty">暂无反馈类型数据</div>`}

            <h3>反馈最多的信息</h3>
            ${topRows || `<div class="empty">暂无高反馈对象</div>`}
        `;
    } catch (error) {
        box.innerHTML = `<div class="empty">反馈统计加载失败，请确认后端已启动。</div>`;
    }
}

function fillFeedbackTypeFilter() {
    const select = document.getElementById("feedbackTypeFilter");
    const currentValue = select.value;

    const types = Array.from(new Set(allFeedbacks.map(item => item.feedback_type || "补充信息")));

    select.innerHTML = `<option value="all">全部类型</option>` + types.map(type => `
        <option value="${escapeAttr(type)}">${escapeHtml(type)}</option>
    `).join("");

    select.value = currentValue || "all";
}

function renderFeedbackAdminList() {
    const box = document.getElementById("feedbackAdminList");
    const keyword = (document.getElementById("feedbackKeyword").value || "").trim().toLowerCase();
    const targetType = document.getElementById("feedbackTargetType").value;
    const feedbackType = document.getElementById("feedbackTypeFilter").value;

    let list = allFeedbacks;

    if (targetType !== "all") {
        list = list.filter(item => item.target_type === targetType);
    }

    if (feedbackType !== "all") {
        list = list.filter(item => item.feedback_type === feedbackType);
    }

    if (keyword) {
        list = list.filter(item => {
            const target = getFeedbackTarget(item);
            const text = [
                item.feedback_type,
                item.content,
                item.user_name,
                target ? target.title : "",
                target ? target.category : ""
            ].join(" ").toLowerCase();

            return text.includes(keyword);
        });
    }

    if (list.length === 0) {
        box.innerHTML = `<div class="empty">当前筛选下暂无反馈</div>`;
        return;
    }

    box.innerHTML = list.map(item => {
        const target = getFeedbackTarget(item);
        const targetTitle = target ? target.title : "关联对象可能已删除";
        const targetCategory = target ? target.category : "未知分类";
        const detailUrl = item.target_type === "clue"
            ? `clue-detail.html?id=${item.target_id}`
            : `item-detail.html?id=${item.target_id}`;

        return `
            <div class="card">
                <div>
                    <span class="tag">${item.target_type === "clue" ? "线索反馈" : "真实库反馈"}</span>
                    <span class="tag">${escapeHtml(item.feedback_type || "补充信息")}</span>
                    <span class="tag">${escapeHtml(item.user_name || "匿名用户")}</span>
                </div>

                <h3>${escapeHtml(targetTitle)}</h3>
                <p>关联分类：${escapeHtml(targetCategory || "未分类")}</p>
                <p>反馈时间：${escapeHtml(item.created_at || "未知")}</p>

                <div class="summary">${escapeHtml(item.content || "暂无反馈内容")}</div>

                <div class="action-row">
                    <div class="action-title">反馈处理</div>
                    <button class="small-button" onclick="location.href='${detailUrl}'">查看关联详情</button>
                    ${
                        item.target_type === "clue"
                        ? `<button class="small-button warn-button" onclick="markClueExpiredFromFeedback(${item.target_id})">标记线索已过期</button>`
                        : `<button class="small-button warn-button" onclick="archiveVerifiedFromFeedback(${item.target_id})">归档真实库信息</button>`
                    }
                    <button class="small-button danger-button" onclick="deleteFeedbackFromAdmin(${item.id})">删除反馈</button>
                </div>
            </div>
        `;
    }).join("");
}

function getFeedbackTarget(feedback) {
    if (feedback.target_type === "clue") {
        return clueMap[feedback.target_id];
    }

    if (feedback.target_type === "verified") {
        return verifiedMap[feedback.target_id];
    }

    return null;
}

function handleFeedbackSearchKeyDown(event) {
    if (event.key === "Enter") {
        renderFeedbackAdminList();
    }
}

async function deleteFeedbackFromAdmin(feedbackId) {
    if (!confirm("确认删除这条反馈吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/feedbacks/${feedbackId}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("反馈已删除。");
        await loadFeedbackAdminPage();
    } else {
        alert("删除失败。");
    }
}

async function markClueExpiredFromFeedback(clueId) {
    if (!confirm("确认将关联线索标记为“用户反馈：已过期”吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/clues/${clueId}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            status: "用户反馈：已过期"
        })
    });

    if (response.ok) {
        alert("关联线索已标记为过期。");
        await loadFeedbackSourceData();
        renderFeedbackAdminList();
    } else {
        alert("操作失败。");
    }
}

async function archiveVerifiedFromFeedback(itemId) {
    if (!confirm("确认归档这条真实库信息吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/verified-items/${itemId}/archive`, {
        method: "POST"
    });

    if (response.ok) {
        alert("真实库信息已归档。");
        await loadFeedbackSourceData();
        renderFeedbackAdminList();
    } else {
        alert("操作失败。");
    }
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(text) {
    return String(text || "").replace(/"/g, "&quot;");
}