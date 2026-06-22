const API_BASE = "http://127.0.0.1:8000";
const DETAIL_ADMIN_TOKEN_KEY = "xgw_user_token";

function getDetailAdminToken() {
    return localStorage.getItem(DETAIL_ADMIN_TOKEN_KEY) || "";
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function renderMissingClueIdState() {
    return `
        <div class="empty detail-missing-state">
            <div class="empty-icon">🧭</div>
            <h2>缺少线索 ID，请从线索列表或审核中心进入详情页。</h2>
            <p>当前页面没有携带 <code>?id=xxx</code> 参数，因此无法加载具体线索。</p>
            <div class="empty-actions">
                <button class="small-button" onclick="location.href='admin.html'">返回审核中心</button>
                <button class="small-button btn-secondary" onclick="location.href='index.html'">返回首页</button>
            </div>
        </div>
    `;
}

async function loadClueDetail() {
    const id = getQueryParam("id");
    const box = document.getElementById("detailBox");

    if (!id) {
        if (box) {
            box.innerHTML = renderMissingClueIdState();
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/clues/${id}`);
        const item = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">加载失败：${JSON.stringify(item)}</div>`;
            return;
        }

        const status = item.status || "待核验";
        const externalClue = isDetailExternalClue(item);
        const statusTip = getDetailReviewTip(item);

        box.innerHTML = `
            <div class="card clue-detail-card">
                <div class="clue-card-tags">
                    <span class="tag warning">线索库</span>
                    <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                    <span class="tag ${getStatusTagClass(status)} clue-status-tag">${escapeHtml(status)}</span>
                    ${externalClue ? `<span class="tag external-clue-tag">外部线索</span>` : ""}
                </div>

                <h2>${escapeHtml(item.title)}</h2>

                <div class="clue-detail-meta">
                    <div><strong>ID：</strong>${item.id}</div>
                    <div><strong>当前状态：</strong>${escapeHtml(status)}</div>
                    <div><strong>分类：</strong>${escapeHtml(item.category || "未分类")}</div>
                    <div><strong>来源平台：</strong>${escapeHtml(item.source_platform || "未知来源")}</div>
                    <div><strong>来源链接：</strong>${item.source_url ? `<a href="${escapeAttr(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_url)}</a>` : "暂无链接"}</div>
                    <div><strong>创建时间：</strong>${escapeHtml(item.created_at || "未知")}</div>
                </div>

                <div class="summary">
                    <strong>线索简介：</strong><br>
                    ${escapeHtml(item.summary || "暂无简介")}
                </div>

                <div class="clue-review-tip ${getDetailReviewTipClass(item)}">${escapeHtml(statusTip)}</div>

                <div class="action-row">
                    <div class="action-title">用户核验</div>
                    <button class="small-button verify-button" onclick="updateClueStatus(${item.id}, '用户核验：属实')">我认为属实</button>
                    <button class="small-button warn-button" onclick="updateClueStatus(${item.id}, '用户核验：不准确')">我认为不准确</button>
                    <button class="small-button danger-button" onclick="updateClueStatus(${item.id}, '用户反馈：已过期')">信息已过期</button>
                </div>

                <div class="action-row">
                    <div class="action-title">管理员审核</div>
                    <button class="small-button approve-button" onclick="approveClue(${item.id})">审核通过，同步到真实库</button>
                    <button class="small-button warn-button" onclick="archiveClue(${item.id})">归档线索</button>
                    <button class="small-button danger-button" onclick="deleteClue(${item.id})">彻底删除线索</button>
                </div>
            </div>
        `;
    } catch (error) {
        box.innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
    }
}

async function loadVerifiedDetail() {
    const id = getQueryParam("id");
    const box = document.getElementById("detailBox");

    if (!id) {
        box.innerHTML = `<div class="empty">缺少真实库 ID。</div>`;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/verified-items/${id}`);
        const item = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="empty">加载失败：${JSON.stringify(item)}</div>`;
            return;
        }

        box.innerHTML = `
            <div class="card">
                <div>
                    <span class="tag">真实库</span>
                    <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                    <span class="tag ${item.trust_level === "已归档" ? "danger-tag" : ""}">${escapeHtml(item.trust_level || "已审核")}</span>
                </div>

                <h2>${escapeHtml(item.title)}</h2>

                <p><strong>ID：</strong>${item.id}</p>
                <p><strong>位置：</strong>${escapeHtml(item.location || "暂无位置")}</p>
                <p><strong>创建时间：</strong>${escapeHtml(item.created_at || "未知")}</p>

                <div class="summary">
                    <strong>简介：</strong><br>
                    ${escapeHtml(item.summary || "暂无简介")}
                </div>

                <div class="action-row">
                    <div class="action-title">真实库管理</div>
                    <button class="small-button warn-button" onclick="archiveVerifiedItem(${item.id})">归档真实库信息</button>
                    <button class="small-button approve-button" onclick="restoreVerifiedItem(${item.id})">恢复真实库信息</button>
                    <button class="small-button danger-button" onclick="deleteVerifiedItem(${item.id})">彻底删除真实库信息</button>
                </div>
            </div>
        `;
    } catch (error) {
        box.innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
    }
}

async function updateClueStatus(id, status) {
    const confirmed = confirm(`确认将这条线索标记为：${status} 吗？`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${id}/status`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: getDetailAdminToken(),
            status
        })
    });

    if (response.ok) {
        alert("线索状态已更新。");
        loadClueDetail();
    } else {
        alert("更新失败。");
    }
}

async function approveClue(id) {
    const location = prompt("请输入地点/区域，可以留空：", "");

    const response = await fetch(`${API_BASE}/admin/clues/${id}/approve`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: getDetailAdminToken(),
            location: location || "",
            trust_level: "管理员已审核",
            admin_note: "详情页审核通过"
        })
    });

    if (response.ok) {
        alert("已同步到真实库。");
        loadClueDetail();
    } else {
        alert("审核失败。");
    }
}

async function archiveClue(id) {
    if (!confirm("确认归档这条线索吗？")) return;

    const response = await fetch(`${API_BASE}/clues/${id}/archive?token=${encodeURIComponent(getDetailAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("线索已归档。");
        loadClueDetail();
    } else {
        alert("归档失败。");
    }
}

async function deleteClue(id) {
    if (!confirm("确认彻底删除这条线索吗？建议优先归档。")) return;

    const response = await fetch(`${API_BASE}/clues/${id}?token=${encodeURIComponent(getDetailAdminToken())}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("线索已删除。");
        location.href = "manage.html";
    } else {
        alert("删除失败。");
    }
}

async function archiveVerifiedItem(id) {
    if (!confirm("确认归档这条真实库信息吗？")) return;

    const response = await fetch(`${API_BASE}/verified-items/${id}/archive?token=${encodeURIComponent(getDetailAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("真实库信息已归档。");
        loadVerifiedDetail();
    } else {
        alert("归档失败。");
    }
}

async function restoreVerifiedItem(id) {
    if (!confirm("确认恢复这条真实库信息吗？")) return;

    const response = await fetch(`${API_BASE}/verified-items/${id}/restore?token=${encodeURIComponent(getDetailAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("真实库信息已恢复。");
        loadVerifiedDetail();
    } else {
        alert("恢复失败。");
    }
}

async function deleteVerifiedItem(id) {
    if (!confirm("确认彻底删除这条真实库信息吗？建议优先归档。")) return;

    const response = await fetch(`${API_BASE}/verified-items/${id}?token=${encodeURIComponent(getDetailAdminToken())}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("真实库信息已删除。");
        location.href = "manage.html";
    } else {
        alert("删除失败。");
    }
}

function getStatusTagClass(status) {
    if (!status) return "warning";
    if (status.includes("属实")) return "verify-tag";
    if (status.includes("不准确") || status.includes("过期") || status.includes("归档")) return "danger-tag";
    if (status.includes("已转入真实库")) return "tag";
    return "warning";
}

function isDetailExternalClue(item) {
    const category = item.category || "";
    const sourcePlatform = item.source_platform || "";
    return category === "外部线索" || Boolean(sourcePlatform) || Boolean(item.source_url);
}

function getDetailReviewTip(item) {
    const status = item.status || "待核验";

    if (status === "已转入真实库") {
        return "该线索已转入真实库，谨慎重复处理。";
    }

    if (status === "已归档") {
        return "该线索已归档，如需继续处理请先人工确认。";
    }

    if (isDetailExternalClue(item)) {
        return "该线索来自外部采集/公开来源，请人工核验后再转入真实库。";
    }

    if (status === "待核验") {
        return "建议核对来源与摘要后再审核。";
    }

    return "请结合来源、摘要、反馈和历史记录进行人工判断。";
}

function getDetailReviewTipClass(item) {
    const status = item.status || "待核验";
    if (status === "已转入真实库") return "clue-review-tip-approved";
    if (status === "已归档") return "clue-review-tip-archived";
    if (isDetailExternalClue(item)) return "clue-review-tip-external";
    return "";
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
