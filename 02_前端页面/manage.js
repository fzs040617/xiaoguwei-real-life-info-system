const API_BASE = "http://127.0.0.1:8000";
const MANAGE_TOKEN_KEY = "xgw_user_token";

function getManageToken() {
    return localStorage.getItem(MANAGE_TOKEN_KEY) || "";
}

document.addEventListener("click", event => {
    const button = event.target.closest('[data-action="toggle-manage-section"]');
    if (!button) return;

    toggleManageSection(button.dataset.target);
});

function toggleManageSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const collapsed = section.classList.toggle("manage-section-collapsed");
    const button = section.querySelector('[data-action="toggle-manage-section"]');
    if (button) {
        button.textContent = collapsed ? "展开" : "收起";
    }
}

async function loadManageData() {
    await loadManageVerifiedItems();
    await loadManageClues();
}

async function refreshManageData(button) {
    const refreshButton = button || document.getElementById("manageRefreshButton");
    const originalText = refreshButton ? refreshButton.textContent : "";

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "刷新中...";
    }

    try {
        await loadManageData();
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = originalText || "刷新数据";
        }
    }
}

async function loadManageVerifiedItems() {
    const box = document.getElementById("manageVerifiedList");

    try {
        const response = await fetch(`${API_BASE}/verified-items`);
        const data = await response.json();
        const items = data.data || [];

        if (items.length === 0) {
            box.innerHTML = `<div class="empty">暂无真实库数据</div>`;
            return;
        }

        box.innerHTML = items.map(item => {
            const archived = item.trust_level === "已归档";

            return `
                <div class="card">
                    <div>
                        <span class="tag">真实库</span>
                        <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                        <span class="tag ${archived ? "danger-tag" : ""}">${escapeHtml(item.trust_level || "已审核")}</span>
                    </div>

                    <h3>${escapeHtml(item.title)}</h3>
                    <div>位置：${escapeHtml(item.location || "暂无位置")}</div>
                    <div class="summary">${escapeHtml(item.summary || "暂无简介")}</div>

                    <div class="action-row">
                        <div class="action-title">真实库管理</div>
                        <button class="small-button" onclick="editVerifiedItem(${item.id})">编辑</button>
                        ${
                            archived
                            ? `<button class="small-button approve-button" onclick="restoreVerifiedItem(${item.id}, '${escapeJs(item.title)}')">恢复</button>`
                            : `<button class="small-button warn-button" onclick="archiveVerifiedItem(${item.id}, '${escapeJs(item.title)}')">归档</button>`
                        }
                        <button class="small-button danger-button" onclick="deleteVerifiedItem(${item.id}, '${escapeJs(item.title)}')">彻底删除</button>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">真实库加载失败，请确认后端已启动。</div>`;
    }
}

async function loadManageClues() {
    const box = document.getElementById("manageClueList");

    try {
        const response = await fetch(`${API_BASE}/clues`);
        const data = await response.json();
        const clues = data.data || [];

        if (clues.length === 0) {
            box.innerHTML = `<div class="empty">暂无线索库数据</div>`;
            return;
        }

        box.innerHTML = clues.map(clue => {
            const archived = clue.status === "已归档";

            return `
                <div class="card">
                    <div>
                        <span class="tag warning">线索库</span>
                        <span class="tag">${escapeHtml(clue.category || "未分类")}</span>
                        <span class="tag ${archived ? "danger-tag" : ""}">${escapeHtml(clue.status || "待核验")}</span>
                    </div>

                    <h3>${escapeHtml(clue.title)}</h3>
                    <div>来源：${escapeHtml(clue.source_platform || "未知来源")}</div>
                    <div>链接：${clue.source_url ? `<a href="${escapeAttr(clue.source_url)}" target="_blank">${escapeHtml(clue.source_url)}</a>` : "暂无链接"}</div>
                    <div class="summary">${escapeHtml(clue.summary || "暂无简介")}</div>

                    <div class="action-row">
                        <div class="action-title">线索管理</div>
                        <button class="small-button" onclick="editClue(${clue.id})">编辑</button>
                        ${
                            archived
                            ? `<button class="small-button approve-button" onclick="restoreClue(${clue.id}, '${escapeJs(clue.title)}')">恢复</button>`
                            : `<button class="small-button warn-button" onclick="archiveClue(${clue.id}, '${escapeJs(clue.title)}')">归档</button>`
                        }
                        <button class="small-button danger-button" onclick="deleteClue(${clue.id}, '${escapeJs(clue.title)}')">彻底删除</button>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">线索库加载失败，请确认后端已启动。</div>`;
    }
}

async function editClue(clueId) {
    const title = prompt("修改线索标题：留空表示不修改");
    const category = prompt("修改分类：探店/租房/地图/路线/生活服务/避坑纠错/外部线索，留空表示不修改");
    const platform = prompt("修改来源平台：留空表示不修改");
    const url = prompt("修改来源链接：留空表示不修改");
    const summary = prompt("修改线索简介：留空表示不修改");
    const status = prompt("修改状态：待核验/用户核验：属实/用户核验：不准确/用户反馈：已过期/已转入真实库/已归档，留空表示不修改");

    const payload = {};

    if (title) payload.title = title;
    if (category) payload.category = category;
    if (platform) payload.source_platform = platform;
    if (url) payload.source_url = url;
    if (summary) payload.summary = summary;
    if (status) payload.status = status;

    if (Object.keys(payload).length === 0) {
        alert("没有填写任何修改内容。");
        return;
    }

    payload.token = getManageToken();

    const response = await fetch(`${API_BASE}/clues/${clueId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
        alert("线索已更新。");
        await loadManageData();
    } else {
        alert("更新失败：" + JSON.stringify(data));
    }
}

async function editVerifiedItem(itemId) {
    const title = prompt("修改真实库标题：留空表示不修改");
    const category = prompt("修改分类：探店/租房/地图/路线/生活服务/避坑纠错/外部线索，留空表示不修改");
    const location = prompt("修改位置：留空表示不修改");
    const summary = prompt("修改简介：留空表示不修改");
    const trustLevel = prompt("修改可信等级：管理员已审核/多人确认/存在争议/疑似过期/已归档，留空表示不修改");

    const payload = {};

    if (title) payload.title = title;
    if (category) payload.category = category;
    if (location) payload.location = location;
    if (summary) payload.summary = summary;
    if (trustLevel) payload.trust_level = trustLevel;

    if (Object.keys(payload).length === 0) {
        alert("没有填写任何修改内容。");
        return;
    }

    payload.token = getManageToken();

    const response = await fetch(`${API_BASE}/verified-items/${itemId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
        alert("真实库信息已更新。");
        await loadManageData();
    } else {
        alert("更新失败：" + JSON.stringify(data));
    }
}

async function archiveClue(clueId, clueTitle) {
    const confirmed = confirm(`确认归档这条线索吗？\n\n${clueTitle}\n\n归档后数据不会删除，可以恢复。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${clueId}/archive?token=${encodeURIComponent(getManageToken())}`, {
        method: "POST"
    });

    const data = await response.json();

    if (response.ok) {
        alert("线索已归档。");
        await loadManageData();
    } else {
        alert("归档失败：" + JSON.stringify(data));
    }
}

async function restoreClue(clueId, clueTitle) {
    const confirmed = confirm(`确认恢复这条线索为“待核验”吗？\n\n${clueTitle}`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${clueId}/restore?token=${encodeURIComponent(getManageToken())}`, {
        method: "POST"
    });

    const data = await response.json();

    if (response.ok) {
        alert("线索已恢复。");
        await loadManageData();
    } else {
        alert("恢复失败：" + JSON.stringify(data));
    }
}

async function archiveVerifiedItem(itemId, itemTitle) {
    const confirmed = confirm(`确认归档这条真实库信息吗？\n\n${itemTitle}\n\n归档后数据不会删除，可以恢复。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/verified-items/${itemId}/archive?token=${encodeURIComponent(getManageToken())}`, {
        method: "POST"
    });

    const data = await response.json();

    if (response.ok) {
        alert("真实库信息已归档。");
        await loadManageData();
    } else {
        alert("归档失败：" + JSON.stringify(data));
    }
}

async function restoreVerifiedItem(itemId, itemTitle) {
    const confirmed = confirm(`确认恢复这条真实库信息吗？\n\n${itemTitle}`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/verified-items/${itemId}/restore?token=${encodeURIComponent(getManageToken())}`, {
        method: "POST"
    });

    const data = await response.json();

    if (response.ok) {
        alert("真实库信息已恢复。");
        await loadManageData();
    } else {
        alert("恢复失败：" + JSON.stringify(data));
    }
}

async function deleteClue(clueId, clueTitle) {
    const confirmed = confirm(`确认彻底删除这条线索吗？\n\n${clueTitle}\n\n建议优先使用“归档”。彻底删除后只能靠备份恢复。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${clueId}?token=${encodeURIComponent(getManageToken())}`, {
        method: "DELETE"
    });

    const data = await response.json();

    if (response.ok) {
        alert("线索已彻底删除。");
        await loadManageData();
    } else {
        alert("删除失败：" + JSON.stringify(data));
    }
}

async function deleteVerifiedItem(itemId, itemTitle) {
    const confirmed = confirm(`确认彻底删除这条真实库信息吗？\n\n${itemTitle}\n\n建议优先使用“归档”。彻底删除后只能靠备份恢复。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/verified-items/${itemId}?token=${encodeURIComponent(getManageToken())}`, {
        method: "DELETE"
    });

    const data = await response.json();

    if (response.ok) {
        alert("真实库信息已彻底删除。");
        await loadManageData();
    } else {
        alert("删除失败：" + JSON.stringify(data));
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

function escapeJs(text) {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, " ");
}
