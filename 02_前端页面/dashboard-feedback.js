const FEEDBACK_DASHBOARD_API = "http://127.0.0.1:8000";

async function injectDashboardFeedbackStats() {
    const statsBox = document.getElementById("statsBox");

    if (!statsBox) {
        return;
    }

    if (document.getElementById("dashboardFeedbackBox")) {
        return;
    }

    try {
        const response = await fetch(`${FEEDBACK_DASHBOARD_API}/feedbacks/stats`);
        const data = await response.json();

        const topTargets = (data.top_targets || []).map(item => {
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

        const wrapper = document.createElement("div");
        wrapper.className = "section";
        wrapper.id = "dashboardFeedbackBox";

        wrapper.innerHTML = `
            <h2>反馈统计</h2>
            <div class="card">
                <h3>反馈总览</h3>
                <p>反馈总数：${data.total_feedbacks}</p>
                <p>线索反馈：${data.clue_feedbacks}</p>
                <p>真实库反馈：${data.verified_feedbacks}</p>
                <button class="small-button" onclick="location.href='feedback-admin.html'">进入反馈中心</button>
            </div>

            <h3>反馈最多的信息</h3>
            ${topTargets || `<div class="empty">暂无反馈数据</div>`}
        `;

        const statsSection = statsBox.closest(".section");

        if (statsSection) {
            statsSection.insertAdjacentElement("afterend", wrapper);
        }

    } catch (error) {
        console.log("反馈统计加载失败", error);
    }
}

window.addEventListener("load", () => {
    setTimeout(injectDashboardFeedbackStats, 500);
});

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}