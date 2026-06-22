const FEEDBACK_API_BASE = "http://127.0.0.1:8000";
const FEEDBACK_DELETE_TOKEN_KEY = "xgw_user_token";

function getFeedbackDeleteToken() {
    return localStorage.getItem(FEEDBACK_DELETE_TOKEN_KEY) || "";
}

function getFeedbackQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

async function loadFeedback(targetType) {
    const targetId = getFeedbackQueryParam("id");
    const box = document.getElementById("feedbackList");

    if (!box) {
        return;
    }

    if (!targetId) {
        box.innerHTML = `<div class="empty">暂无反馈，或请先选择一条线索。</div>`;
        return;
    }

    try {
        const response = await fetch(`${FEEDBACK_API_BASE}/feedbacks?target_type=${targetType}&target_id=${targetId}`);
        const data = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">反馈加载失败：${feedbackEscapeHtml(JSON.stringify(data))}</div>`;
            return;
        }

        const feedbacks = data.data || [];

        if (feedbacks.length === 0) {
            box.innerHTML = `<div class="empty">还没有用户反馈，后续可在这里补充纠错、过期提醒或价格变化。</div>`;
            return;
        }

        box.innerHTML = feedbacks.map(item => `
            <div class="card">
                <div>
                    <span class="tag">${feedbackEscapeHtml(item.feedback_type || "补充信息")}</span>
                    <span class="tag">${feedbackEscapeHtml(item.user_name || "匿名用户")}</span>
                </div>

                <div class="summary">${feedbackEscapeHtml(item.content || "暂无反馈内容")}</div>
                <div style="color:#888; margin-top:8px;">提交时间：${feedbackEscapeHtml(item.created_at || "未知")}</div>

                <div class="action-row">
                    <button class="small-button danger-button" onclick="deleteFeedback(${item.id}, '${targetType}')">删除反馈</button>
                </div>
            </div>
        `).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">反馈加载失败，请确认后端已启动。</div>`;
    }
}

async function submitFeedback(targetType) {
    const targetId = getFeedbackQueryParam("id");
    const userName = document.getElementById("feedbackUserName").value.trim();
    const feedbackType = document.getElementById("feedbackType").value;
    const content = document.getElementById("feedbackContent").value.trim();

    if (!targetId) {
        alert("缺少详情 ID，无法提交反馈。");
        return;
    }

    if (!content) {
        alert("请填写反馈内容。");
        return;
    }

    const response = await fetch(`${FEEDBACK_API_BASE}/feedbacks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            target_type: targetType,
            target_id: Number(targetId),
            feedback_type: feedbackType,
            content: content,
            user_name: userName || "匿名用户"
        })
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("feedbackMessage").innerText = "反馈提交成功。";
        document.getElementById("feedbackUserName").value = "";
        document.getElementById("feedbackContent").value = "";
        await loadFeedback(targetType);
    } else {
        document.getElementById("feedbackMessage").innerText = "提交失败：" + JSON.stringify(data);
    }
}

async function deleteFeedback(feedbackId, targetType) {
    const confirmed = confirm("确认删除这条反馈吗？");

    if (!confirmed) {
        return;
    }

    const response = await fetch(`${FEEDBACK_API_BASE}/feedbacks/${feedbackId}?token=${encodeURIComponent(getFeedbackDeleteToken())}`, {
        method: "DELETE"
    });

    const data = await response.json();

    if (response.ok) {
        alert("反馈已删除。");
        await loadFeedback(targetType);
    } else {
        alert("删除失败：" + JSON.stringify(data));
    }
}

function feedbackEscapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
