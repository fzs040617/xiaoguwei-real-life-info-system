// map-route-feedback.js
// 给 map-detail.html / route-detail.html 增加反馈、补充、纠错功能。

const MAP_ROUTE_FEEDBACK_API = "http://127.0.0.1:8000";
const MAP_ROUTE_FEEDBACK_TOKEN_KEY = "xgw_user_token";

function getMapRouteFeedbackToken() {
    return localStorage.getItem(MAP_ROUTE_FEEDBACK_TOKEN_KEY) || "";
}

window.addEventListener("load", () => {
    setTimeout(initMapRouteFeedback, 700);
});

function getMapRouteFeedbackId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function getMapRouteFeedbackTargetType() {
    if (location.pathname.includes("map-detail")) {
        return "map_point";
    }

    if (location.pathname.includes("route-detail")) {
        return "route";
    }

    return "";
}

function getMapRouteFeedbackTitle() {
    if (location.pathname.includes("map-detail")) {
        return "地图点反馈与补充";
    }

    if (location.pathname.includes("route-detail")) {
        return "路线反馈与补充";
    }

    return "反馈与补充";
}

function initMapRouteFeedback() {
    const targetId = getMapRouteFeedbackId();
    const targetType = getMapRouteFeedbackTargetType();

    if (!targetId || !targetType) {
        return;
    }

    injectMapRouteFeedbackBox();
    loadMapRouteFeedback();
}

function injectMapRouteFeedbackBox() {
    if (document.getElementById("mapRouteFeedbackBox")) {
        return;
    }

    const container = document.querySelector(".container");

    if (!container) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "mapRouteFeedbackBox";

    box.innerHTML = `
        <h2>${getMapRouteFeedbackTitle()}</h2>
        <p class="notice">
            用户可以补充信息、指出错误、提醒过期、补充价格或路线体验。反馈不会直接改变原信息，需要后续审核或人工处理。
        </p>

        <div class="form-row">
            <label>昵称</label>
            <input id="mapRouteFeedbackUserName" placeholder="可留空，默认匿名用户">
        </div>

        <div class="form-row">
            <label>反馈类型</label>
            <select id="mapRouteFeedbackType">
                <option value="补充信息">补充信息</option>
                <option value="真实反馈">真实反馈</option>
                <option value="纠错">纠错</option>
                <option value="已过期">已过期</option>
                <option value="价格信息">价格信息</option>
                <option value="路线体验">路线体验</option>
                <option value="其他">其他</option>
            </select>
        </div>

        <div class="form-row">
            <label>反馈内容</label>
            <textarea id="mapRouteFeedbackContent" placeholder="例如：这个地图点位置不准确 / 这条路线晚上更适合 / 这里已经关门 / 价格变化了"></textarea>
        </div>

        <button onclick="submitMapRouteFeedback()">提交反馈</button>
        <div id="mapRouteFeedbackMessage" class="message"></div>
    `;

    const historySection = document.getElementById("detailHistorySummary");

    if (historySection) {
        historySection.closest(".section").insertAdjacentElement("beforebegin", box);
    } else {
        container.appendChild(box);
    }

    const listSection = document.createElement("div");
    listSection.className = "section";
    listSection.id = "mapRouteFeedbackListSection";
    listSection.innerHTML = `
        <h2>已有反馈</h2>
        <div id="mapRouteFeedbackList" class="empty">正在加载反馈...</div>
    `;

    box.insertAdjacentElement("afterend", listSection);
}

async function submitMapRouteFeedback() {
    const targetId = getMapRouteFeedbackId();
    const targetType = getMapRouteFeedbackTargetType();

    const userName = document.getElementById("mapRouteFeedbackUserName").value.trim();
    const feedbackType = document.getElementById("mapRouteFeedbackType").value;
    const content = document.getElementById("mapRouteFeedbackContent").value.trim();
    const message = document.getElementById("mapRouteFeedbackMessage");

    if (!content) {
        alert("请填写反馈内容。");
        return;
    }

    message.innerText = "正在提交反馈，请稍等...";

    try {
        const response = await fetch(`${MAP_ROUTE_FEEDBACK_API}/feedbacks-v2`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                target_type: targetType,
                target_id: Number(targetId),
                feedback_type: feedbackType,
                content: content,
                user_name: userName || "匿名用户"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "反馈提交失败：" + JSON.stringify(data);
            return;
        }

        message.innerText = "反馈提交成功。";
        document.getElementById("mapRouteFeedbackUserName").value = "";
        document.getElementById("mapRouteFeedbackContent").value = "";

        await loadMapRouteFeedback();
    } catch (error) {
        message.innerText = "反馈提交失败，请确认后端已启动：" + error.message;
    }
}

async function loadMapRouteFeedback() {
    const targetId = getMapRouteFeedbackId();
    const targetType = getMapRouteFeedbackTargetType();
    const listBox = document.getElementById("mapRouteFeedbackList");

    if (!listBox) {
        return;
    }

    listBox.innerHTML = `<div class="empty">正在加载反馈...</div>`;

    try {
        const params = new URLSearchParams();
        params.set("target_type", targetType);
        params.set("target_id", targetId);

        const response = await fetch(`${MAP_ROUTE_FEEDBACK_API}/feedbacks?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            listBox.innerHTML = `<div class="empty">反馈加载失败：${JSON.stringify(data)}</div>`;
            return;
        }

        const feedbacks = data.data || [];

        if (feedbacks.length === 0) {
            listBox.innerHTML = `<div class="empty">暂无反馈。</div>`;
            return;
        }

        listBox.innerHTML = feedbacks.map(item => `
            <div class="card">
                <div>
                    <span class="tag">${escapeMapRouteFeedbackHtml(item.feedback_type || "补充信息")}</span>
                    <span class="tag">${escapeMapRouteFeedbackHtml(item.user_name || "匿名用户")}</span>
                </div>

                <div class="summary">${escapeMapRouteFeedbackHtml(item.content || "暂无反馈内容")}</div>
                <div style="color:#888; margin-top:8px;">提交时间：${escapeMapRouteFeedbackHtml(item.created_at || "未知")}</div>

                <div class="action-row">
                    <button class="small-button danger-button" onclick="deleteMapRouteFeedback(${item.id})">删除反馈</button>
                </div>
            </div>
        `).join("");

    } catch (error) {
        listBox.innerHTML = `<div class="empty">反馈加载失败：${escapeMapRouteFeedbackHtml(error.message)}</div>`;
    }
}

async function deleteMapRouteFeedback(feedbackId) {
    if (!confirm("确认删除这条反馈吗？")) {
        return;
    }

    try {
        const response = await fetch(`${MAP_ROUTE_FEEDBACK_API}/feedbacks/${feedbackId}?token=${encodeURIComponent(getMapRouteFeedbackToken())}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            alert("删除失败：" + JSON.stringify(data));
            return;
        }

        alert("反馈已删除。");
        await loadMapRouteFeedback();
    } catch (error) {
        alert("删除失败：" + error.message);
    }
}

function escapeMapRouteFeedbackHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
