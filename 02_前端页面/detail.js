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
        const cleanedSummary = getDisplaySummary(item.summary);
        const displaySourceNote = getDisplaySourceNote(item, item.summary);
        const displayTitle = getClueDetailTitle(item, cleanedSummary);
        const displaySourcePlatform = getDisplaySourcePlatform(item.source_platform);
        const displaySourceUrl = getDisplaySourceUrl(item.source_url);

        box.innerHTML = `
            <div class="card clue-detail-card">
                <div class="clue-card-tags">
                    <span class="tag warning">线索库</span>
                    <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                    <span class="tag ${getStatusTagClass(status)} clue-status-tag">${escapeHtml(status)}</span>
                    ${externalClue ? `<span class="tag external-clue-tag">外部线索</span>` : ""}
                </div>

                <h2>${escapeHtml(displayTitle)}</h2>

                <div class="clue-detail-meta">
                    <div><strong>ID：</strong>${item.id}</div>
                    <div><strong>当前状态：</strong>${escapeHtml(status)}</div>
                    <div><strong>分类：</strong>${escapeHtml(item.category || "未分类")}</div>
                    <div><strong>来源平台：</strong>${escapeHtml(displaySourcePlatform)}</div>
                    <div><strong>来源链接：</strong>${displaySourceUrl ? `<a href="${escapeAttr(displaySourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displaySourceUrl)}</a>` : "暂无公开链接"}</div>
                    ${displaySourceNote ? `<div><strong>来源说明：</strong>${escapeHtml(displaySourceNote)}</div>` : ""}
                    <div><strong>创建时间：</strong>${escapeHtml(item.created_at || "未知")}</div>
                </div>

                <div class="summary clue-summary-block">
                    <strong>线索简介</strong>
                    <p>${escapeHtml(cleanedSummary || "暂无简介，等待用户补充。")}</p>
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
    return category === "外部线索" || isMeaningfulDetailValue(sourcePlatform) || isValidHttpUrl(item.source_url);
}

function cleanImportedText(value) {
    let text = normalizeDetailText(value);

    for (let i = 0; i < 8; i += 1) {
        const before = text;

        text = text
            .replace(/^\s*(?:来源平台)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|n\/a)?\s*/i, "")
            .replace(/^\s*(?:URL|链接|来源链接)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|n\/a)?\s*/i, "")
            .replace(/^\s*(?:粘贴公开文本|公开文本|文本|内容)\s*[：:]\s*/i, "")
            .replace(/^\s*(?:留空|无|暂无|null|undefined|none|n\/a)\s+/i, "")
            .trim();

        if (text === before) {
            break;
        }
    }

    return text;
}

function splitSourceNoteFromSummary(value) {
    const text = normalizeDetailText(value);
    if (!text) {
        return { summary: "", sourceNote: "" };
    }

    const match = text.match(/(?:\s|　)*(来源说明|说明|备注)\s*[：:]\s*([^。！？!?；;\n\r]+)(?:[。！？!?；;])?\s*$/);
    if (!match) {
        return { summary: text, sourceNote: "" };
    }

    return {
        summary: text.slice(0, match.index).trim(),
        sourceNote: normalizeDetailText(match[2])
    };
}

function getClueDetailTitle(item, cleanedSummary) {
    const rawTitle = normalizeDetailText(item.title);

    if (isUsableDetailTitle(rawTitle)) {
        return rawTitle;
    }

    const summaryTitle = extractTitleFromSummary(cleanedSummary);
    if (summaryTitle) {
        return summaryTitle;
    }

    if (isMeaningfulDetailValue(item.category) && item.id) {
        return `${normalizeDetailText(item.category)}线索 #${item.id}`;
    }

    if (item.id) {
        return `线索 #${item.id}`;
    }

    return "线索详情";
}

function getDisplaySummary(value) {
    const split = splitSourceNoteFromSummary(value);
    const cleaned = cleanImportedText(split.summary);
    return isMeaningfulDetailValue(cleaned) ? cleaned : "";
}

function getDisplaySourceNote(item, summaryValue) {
    const directNote = item && (
        item.source_note ||
        item.sourceNote ||
        (item.metadata && item.metadata.source_note) ||
        (item.raw && item.raw.source_note)
    );
    const cleanedDirectNote = cleanImportedText(directNote);
    if (isMeaningfulDetailValue(cleanedDirectNote)) {
        return cleanedDirectNote;
    }

    const split = splitSourceNoteFromSummary(summaryValue);
    const cleanedSplitNote = cleanImportedText(split.sourceNote);
    return isMeaningfulDetailValue(cleanedSplitNote) ? cleanedSplitNote : "";
}

function getDisplaySourcePlatform(value) {
    const cleaned = cleanImportedText(value);
    return isMeaningfulDetailValue(cleaned) ? cleaned : "暂无来源平台";
}

function getDisplaySourceUrl(value) {
    const cleaned = cleanImportedText(value);
    return isValidHttpUrl(cleaned) ? cleaned : "";
}

function isUsableDetailTitle(value) {
    if (!isMeaningfulDetailValue(value)) {
        return false;
    }

    if (/^(?:来源平台|URL|链接|来源链接|粘贴公开文本|公开文本|文本|内容)\s*[：:]/i.test(value)) {
        return false;
    }

    return Boolean(cleanImportedText(value));
}

function extractTitleFromSummary(value) {
    const text = normalizeDetailText(value);
    if (!isMeaningfulDetailValue(text)) {
        return "";
    }

    const firstSentence = text.split(/[。！？!?]/)[0].trim();
    const candidate = firstSentence || text;
    return candidate.length > 30 ? `${candidate.slice(0, 30)}...` : candidate;
}

function isMeaningfulDetailValue(value) {
    const text = normalizeDetailText(value).toLowerCase();
    const invalidValues = new Set([
        "",
        "留空",
        "无",
        "暂无",
        "null",
        "undefined",
        "none",
        "nan",
        "n/a",
        "-"
    ]);

    if (invalidValues.has(text)) {
        return false;
    }

    if (/^\d{1,3}$/.test(normalizeDetailText(value))) {
        return false;
    }

    return true;
}

function isValidHttpUrl(value) {
    const text = normalizeDetailText(value);

    if (!isMeaningfulDetailValue(text)) {
        return false;
    }

    try {
        const url = new URL(text);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
        return false;
    }
}

function normalizeDetailText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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
