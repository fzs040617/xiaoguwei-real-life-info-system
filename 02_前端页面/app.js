const API_BASE = "http://127.0.0.1:8000";
const ADMIN_TOKEN_KEY = "xgw_user_token";

function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

let currentVerifiedItems = [];
let currentClues = [];
let currentClueFilter = "pending";
let currentCategoryFilter = "全部";
let currentClueStatusFilter = "待核验";
let currentClueCategoryFilter = "全部分类";
let currentClueSourceFilter = "全部来源";
let currentClueExternalOnly = false;
let currentClueLinkedOnly = false;

async function loadHomeData() {
    try {
        const verifiedBox = document.getElementById("verifiedResults");
        const clueBox = document.getElementById("clueResults");

        if (!verifiedBox || !clueBox) return;

        const verifiedResponse = await fetch(`${API_BASE}/verified-items`);
        const verifiedData = await verifiedResponse.json();

        const cluesResponse = await fetch(`${API_BASE}/clues`);
        const cluesData = await cluesResponse.json();

        currentVerifiedItems = verifiedData.data || [];
        currentClues = cluesData.data || [];

        renderClueFilterOptions(currentClues);
        renderVerified(currentVerifiedItems);
        renderClues(currentClues);
    } catch (error) {
        document.getElementById("verifiedResults").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
        document.getElementById("clueResults").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
    }
}

async function refreshCurrentView() {
    const keywordInput = document.getElementById("keywordInput");
    const keyword = keywordInput ? keywordInput.value.trim() : "";

    if (keyword) {
        await search();
    } else {
        await loadHomeData();
    }
}

function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
        search();
    }
}

async function search() {
    const keyword = document.getElementById("keywordInput").value.trim();

    if (!keyword) {
        loadHomeData();
        return;
    }

    const response = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();

    currentVerifiedItems = data.verified_items || [];
    currentClues = data.clues || [];

    renderClueFilterOptions(currentClues);
    renderVerified(currentVerifiedItems);
    renderClues(currentClues);
}

function setCategoryFilter(category) {
    currentCategoryFilter = category;
    updateCategoryButtons();
    renderVerified(currentVerifiedItems);
    renderClues(currentClues);
}

function updateCategoryButtons() {
    const ids = ["categoryAll", "category探店", "category租房", "category地图", "category路线", "category生活服务", "category避坑纠错", "category外部线索"];

    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove("active");
    });

    if (currentCategoryFilter === "全部") {
        const allBtn = document.getElementById("categoryAll");
        if (allBtn) allBtn.classList.add("active");
    } else {
        const target = document.getElementById("category" + currentCategoryFilter);
        if (target) target.classList.add("active");
    }
}

function filterByCategory(items) {
    if (currentCategoryFilter === "全部") return items;
    return items.filter(item => item.category === currentCategoryFilter);
}

function setClueFilter(filter) {
    currentClueFilter = filter;

    if (filter === "pending") {
        currentClueStatusFilter = "待核验";
    } else if (filter === "approved") {
        currentClueStatusFilter = "已转入真实库";
    } else {
        currentClueStatusFilter = "全部状态";
    }

    currentClueExternalOnly = false;
    currentClueLinkedOnly = false;
    updateAdvancedClueFilterInputs();
    updateFilterButtons();
    renderClues(currentClues);
}

function updateFilterButtons() {
    const pending = document.getElementById("filterPending");
    const approved = document.getElementById("filterApproved");
    const all = document.getElementById("filterAll");

    if (!pending || !approved || !all) return;

    pending.classList.remove("active");
    approved.classList.remove("active");
    all.classList.remove("active");

    if (currentClueFilter === "pending") pending.classList.add("active");
    else if (currentClueFilter === "approved") approved.classList.add("active");
    else all.classList.add("active");
}

function setClueStatusFilter(status) {
    currentClueStatusFilter = status || "全部状态";
    currentClueFilter = currentClueStatusFilter === "待核验"
        ? "pending"
        : currentClueStatusFilter === "已转入真实库"
            ? "approved"
            : "custom";
    updateFilterButtons();
    renderClues(currentClues);
}

function setClueCategoryFilter(category) {
    currentClueCategoryFilter = category || "全部分类";
    currentClueExternalOnly = false;
    renderClues(currentClues);
}

function setClueSourceFilter(source) {
    currentClueSourceFilter = source || "全部来源";
    renderClues(currentClues);
}

function showExternalCluesOnly() {
    currentClueExternalOnly = true;
    currentClueLinkedOnly = false;
    currentClueCategoryFilter = "全部分类";
    currentClueFilter = "custom";
    updateFilterButtons();
    updateAdvancedClueFilterInputs();
    renderClues(currentClues);
}

function showLinkedCluesOnly() {
    currentClueLinkedOnly = true;
    currentClueExternalOnly = false;
    currentClueFilter = "custom";
    updateFilterButtons();
    updateAdvancedClueFilterInputs();
    renderClues(currentClues);
}

function clearClueFilters() {
    currentClueFilter = "all";
    currentClueStatusFilter = "全部状态";
    currentClueCategoryFilter = "全部分类";
    currentClueSourceFilter = "全部来源";
    currentClueExternalOnly = false;
    currentClueLinkedOnly = false;
    updateFilterButtons();
    updateAdvancedClueFilterInputs();
    renderClues(currentClues);
}

function renderClueFilterOptions(items) {
    currentClueCategoryFilter = normalizeClueFilterValue(
        currentClueCategoryFilter,
        "全部分类",
        getUniqueClueValues(items, "category")
    );
    currentClueSourceFilter = normalizeClueFilterValue(
        currentClueSourceFilter,
        "全部来源",
        getUniqueClueValues(items, "source_platform")
    );

    fillClueFilterSelect("clueCategoryFilter", "全部分类", getUniqueClueValues(items, "category"));
    fillClueFilterSelect("clueSourceFilter", "全部来源", getUniqueClueValues(items, "source_platform"));
    updateAdvancedClueFilterInputs();
}

function normalizeClueFilterValue(currentValue, defaultText, values) {
    if (currentValue === defaultText || values.includes(currentValue)) {
        return currentValue;
    }

    return defaultText;
}

function fillClueFilterSelect(id, defaultText, values) {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value || defaultText;
    select.innerHTML = [
        `<option value="${escapeAttr(defaultText)}">${escapeHtml(defaultText)}</option>`,
        ...values.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`)
    ].join("");

    select.value = values.includes(currentValue) || currentValue === defaultText ? currentValue : defaultText;
}

function getUniqueClueValues(items, field) {
    return Array.from(new Set(
        items
            .map(item => (item[field] || "").trim())
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function updateAdvancedClueFilterInputs() {
    setSelectValue("clueStatusFilter", currentClueStatusFilter);
    setSelectValue("clueCategoryFilter", currentClueCategoryFilter);
    setSelectValue("clueSourceFilter", currentClueSourceFilter);
}

function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (select) select.value = value;
}

async function submitClue() {
    const title = document.getElementById("clueTitle").value.trim();
    const category = document.getElementById("clueCategory").value;
    const sourcePlatform = document.getElementById("cluePlatform").value.trim();
    const sourceUrl = document.getElementById("clueUrl").value.trim();
    const summary = document.getElementById("clueSummary").value.trim();

    if (!title) {
        alert("请填写线索标题");
        return;
    }

    const response = await fetch(`${API_BASE}/clues`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            title,
            category,
            source_platform: sourcePlatform || "用户投稿",
            source_url: sourceUrl || null,
            summary: summary || "用户提交的线索，等待审核和核验。"
        })
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("submitMessage").innerText = "线索提交成功，已进入待核验线索库。";

        document.getElementById("clueTitle").value = "";
        document.getElementById("cluePlatform").value = "";
        document.getElementById("clueUrl").value = "";
        document.getElementById("clueSummary").value = "";
    } else {
        document.getElementById("submitMessage").innerText = "提交失败：" + JSON.stringify(data);
    }
}

async function approveClue(clueId) {
    const confirmed = confirm("确认将这条线索审核通过，并同步到真实库吗？");
    if (!confirmed) return;

    const location = prompt("请输入地点/区域，例如：贝岗附近、广大附近、大学城南。可以留空。", "");

    const response = await fetch(`${API_BASE}/admin/clues/${clueId}/approve`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: getAdminToken(),
            location: location || "",
            trust_level: "管理员已审核",
            admin_note: "前端页面审核通过"
        })
    });

    const data = await response.json();

    if (response.ok) {
        alert("审核通过，已同步到真实库。");
        await refreshCurrentView();
    } else {
        alert("审核失败：" + JSON.stringify(data));
    }
}

async function updateClueStatus(clueId, status) {
    const confirmed = confirm(`确认将这条线索标记为：${status} 吗？`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${clueId}/status`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: getAdminToken(),
            status
        })
    });

    const data = await response.json();

    if (response.ok) {
        alert("核验状态已更新。");
        await refreshCurrentView();
    } else {
        alert("状态更新失败：" + JSON.stringify(data));
    }
}

async function deleteClue(clueId, clueTitle) {
    const confirmed = confirm(`确认删除这条线索吗？\n\n${clueTitle}\n\n删除后不会影响已经同步到真实库的信息。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/clues/${clueId}?token=${encodeURIComponent(getAdminToken())}`, {
        method: "DELETE"
    });

    const data = await response.json();

    if (response.ok) {
        alert("线索已删除。");
        await refreshCurrentView();
    } else {
        alert("删除失败：" + JSON.stringify(data));
    }
}

async function deleteVerifiedItem(itemId, itemTitle) {
    const confirmed = confirm(`确认删除这条真实库信息吗？\n\n${itemTitle}\n\n注意：这会从真实库中移除。`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/verified-items/${itemId}?token=${encodeURIComponent(getAdminToken())}`, {
        method: "DELETE"
    });

    const data = await response.json();

    if (response.ok) {
        alert("真实库信息已删除。");
        await refreshCurrentView();
    } else {
        alert("删除失败：" + JSON.stringify(data));
    }
}

async function submitCrawlTarget() {
    const url = document.getElementById("targetUrl").value.trim();
    const category = document.getElementById("targetCategory").value;
    const platform = document.getElementById("targetPlatform").value.trim();
    const note = document.getElementById("targetNote").value.trim();

    if (!url) {
        alert("请填写采集网址");
        return;
    }

    const response = await fetch(`${API_BASE}/crawler/targets`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            token: getAdminToken(),
            url,
            category,
            source_platform: platform || "公开网页自动采集",
            enabled: true,
            note: note || ""
        })
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("targetMessage").innerText = data.message || "采集目标已保存。";
        document.getElementById("targetUrl").value = "";
        document.getElementById("targetPlatform").value = "";
        document.getElementById("targetNote").value = "";
        loadCrawlerTargets();
    } else {
        document.getElementById("targetMessage").innerText = "保存失败：" + JSON.stringify(data);
    }
}

async function toggleCrawlTarget(targetId) {
    const response = await fetch(`${API_BASE}/crawler/targets/${targetId}/toggle?token=${encodeURIComponent(getAdminToken())}`, {method: "POST"});
    const data = await response.json();

    if (response.ok) {
        document.getElementById("targetMessage").innerText = data.data.enabled ? "采集目标已启用。" : "采集目标已停用。";
        loadCrawlerTargets();
    } else {
        alert("切换失败：" + JSON.stringify(data));
    }
}

async function deleteCrawlTarget(targetId) {
    const confirmed = confirm("确认删除这个采集目标吗？删除后每天9点不会再采集它，但已经进入线索库的内容不会被删除。");
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/crawler/targets/${targetId}?token=${encodeURIComponent(getAdminToken())}`, {method: "DELETE"});
    const data = await response.json();

    if (response.ok) {
        document.getElementById("targetMessage").innerText = "采集目标已删除。";
        loadCrawlerTargets();
    } else {
        alert("删除失败：" + JSON.stringify(data));
    }
}

async function runCrawlerNow() {
    const box = document.getElementById("crawlResultBox");
    box.style.display = "block";
    box.innerText = "正在执行采集任务，请稍等...";

    try {
        const response = await fetch(`${API_BASE}/scheduler/test-run`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: getAdminToken()})
        });

        const data = await response.json();
        const result = data.result || {};

        box.innerText =
            "采集任务执行完成\n" +
            "总目标数：" + (result.total ?? "-") + "\n" +
            "新增线索：" + (result.created_count ?? "-") + "\n" +
            "跳过重复：" + (result.skipped_count ?? "-") + "\n" +
            "失败数量：" + (result.failed_count ?? "-") + "\n\n" +
            "详细结果：\n" + JSON.stringify(result.results || [], null, 2);

        await loadHomeData();
    } catch (error) {
        box.innerText = "采集任务执行失败，请确认后端已启动。\n" + error;
    }
}

async function loadCrawlerTargets() {
    const box = document.getElementById("targetList");

    try {
        const response = await fetch(`${API_BASE}/crawler/targets`);
        const data = await response.json();
        renderCrawlerTargets(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">采集目标加载失败，请确认后端已启动。</div>`;
    }
}

function renderCrawlerTargets(targets) {
    const box = document.getElementById("targetList");

    if (targets.length === 0) {
        box.innerHTML = `<div class="empty">暂无采集目标。你可以先新增一个公开网页。</div>`;
        return;
    }

    box.innerHTML = targets.map(target => `
        <div class="target-item">
            <div>
                <span class="tag">${escapeHtml(target.category || "未分类")}</span>
                <span class="tag ${target.enabled ? "" : "danger-tag"}">${target.enabled ? "启用中" : "已停用"}</span>
            </div>
            <div class="target-url">${escapeHtml(target.url)}</div>
            <div>来源平台：${escapeHtml(target.source_platform || "未知来源")}</div>
            <div>备注：${escapeHtml(target.note || "暂无备注")}</div>

            <button class="small-button" onclick="toggleCrawlTarget(${target.id})">${target.enabled ? "停用" : "启用"}</button>
            <button class="small-button danger-button" onclick="deleteCrawlTarget(${target.id})">删除</button>
        </div>
    `).join("");
}

function renderVerified(items) {
    const box = document.getElementById("verifiedResults");
    if (!box) return;

    const filteredItems = filterByCategory(items);

    if (filteredItems.length === 0) {
        box.innerHTML = `<div class="empty">当前栏目下暂无真实库结果</div>`;
        return;
    }

    box.innerHTML = filteredItems.map(item => `
        <div class="card">
            <div>
                <span class="tag">真实库</span>
                <span class="tag">${escapeHtml(item.trust_level || "已审核")}</span>
                <span class="tag">${escapeHtml(item.category || "未分类")}</span>
            </div>
            <h3>${escapeHtml(item.title)}</h3>
            <div>位置：${escapeHtml(item.location || "暂无位置")}</div>
            <div class="summary">${escapeHtml(item.summary || "暂无简介")}</div>

            <div class="action-row">
                <div class="action-title">真实库管理</div>
                <button class="small-button danger-button" onclick="deleteVerifiedItem(${item.id}, '${escapeJs(item.title)}')">删除真实库信息</button>
            </div>
        </div>
    `).join("");
}

function renderClues(items) {
    const box = document.getElementById("clueResults");
    const notice = document.getElementById("clueFilterNotice");
    if (!box || !notice) return;

    renderClueFilterOptions(items);

    const baseItems = filterByCategory(items);
    const filteredItems = applyClueFilters(baseItems);
    const filterText = describeClueFilters();

    notice.innerText = filterText;
    renderClueFilterSummary(filteredItems.length, baseItems.length, filterText);

    if (filteredItems.length === 0) {
        box.innerHTML = `<div class="empty">当前筛选下暂无线索结果。可以清除筛选后查看全部线索。</div>`;
        return;
    }

    box.innerHTML = filteredItems.map(item => {
        const alreadyApproved = item.status === "已转入真实库";
        const externalClue = isExternalClue(item);
        const statusClass = getStatusTagClass(item.status);
        const reviewTip = getClueReviewTip(item);

        return `
            <div class="card">
                <div class="clue-card-tags">
                    <span class="tag warning">线索库</span>
                    <span class="tag ${statusClass} clue-status-tag">${escapeHtml(item.status || "待核验")}</span>
                    <span class="tag">${escapeHtml(item.category || "未分类")}</span>
                    ${externalClue ? `<span class="tag external-clue-tag">外部线索</span>` : ""}
                </div>
                <h3>${escapeHtml(item.title)}</h3>
                <div class="clue-source-line">来源平台：<strong>${escapeHtml(item.source_platform || "未知来源")}</strong></div>
                <div class="clue-source-line">来源链接：${item.source_url ? `<a href="${escapeAttr(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_url)}</a>` : "暂无链接"}</div>
                <div class="summary">${escapeHtml(item.summary || "暂无简介")}</div>
                <div class="clue-review-tip ${getClueReviewTipClass(item)}">${escapeHtml(reviewTip)}</div>

                <div class="action-row">
                    <div class="action-title">用户核验</div>
                    <button class="small-button verify-button" onclick="updateClueStatus(${item.id}, '用户核验：属实')">我认为属实</button>
                    <button class="small-button warn-button" onclick="updateClueStatus(${item.id}, '用户核验：不准确')">我认为不准确</button>
                    <button class="small-button danger-button" onclick="updateClueStatus(${item.id}, '用户反馈：已过期')">信息已过期</button>
                </div>

                <div class="action-row">
                    <div class="action-title">管理员审核</div>
                    ${
                        alreadyApproved
                        ? `<button class="small-button disabled-button" disabled>已同步到真实库</button>`
                        : `<button class="small-button approve-button" onclick="approveClue(${item.id})">审核通过，同步到真实库</button>`
                    }
                </div>

                <div class="action-row">
                    <div class="action-title">线索管理</div>
                    <button class="small-button danger-button" onclick="deleteClue(${item.id}, '${escapeJs(item.title)}')">删除线索</button>
                </div>
            </div>
        `;
    }).join("");
}

function applyClueFilters(items) {
    return items.filter(item => {
        const status = item.status || "待核验";
        const category = item.category || "";
        const source = item.source_platform || "";
        const hasSourceUrl = Boolean(item.source_url);

        if (currentClueStatusFilter !== "全部状态" && status !== currentClueStatusFilter) {
            return false;
        }

        if (currentClueCategoryFilter !== "全部分类" && category !== currentClueCategoryFilter) {
            return false;
        }

        if (currentClueSourceFilter !== "全部来源" && source !== currentClueSourceFilter) {
            return false;
        }

        if (currentClueExternalOnly && !isExternalClue(item)) {
            return false;
        }

        if (currentClueLinkedOnly && !hasSourceUrl) {
            return false;
        }

        return true;
    });
}

function describeClueFilters() {
    const parts = [];

    if (currentClueStatusFilter !== "全部状态") parts.push(`状态：${currentClueStatusFilter}`);
    if (currentClueCategoryFilter !== "全部分类") parts.push(`分类：${currentClueCategoryFilter}`);
    if (currentClueSourceFilter !== "全部来源") parts.push(`来源：${currentClueSourceFilter}`);
    if (currentClueExternalOnly) parts.push("只看外部线索");
    if (currentClueLinkedOnly) parts.push("只看有来源链接");

    return parts.length ? `当前筛选：${parts.join("；")}` : "当前筛选：查看全部线索";
}

function renderClueFilterSummary(filteredCount, totalCount, filterText) {
    const summary = document.getElementById("clueFilterSummary");
    if (!summary) return;

    summary.innerHTML = `
        <strong>${filteredCount}</strong> / 共 ${totalCount} 条线索
        <span>${escapeHtml(filterText.replace("当前筛选：", ""))}</span>
    `;
}

function isExternalClue(item) {
    const category = item.category || "";
    const sourcePlatform = item.source_platform || "";
    return category === "外部线索" || Boolean(sourcePlatform) || Boolean(item.source_url);
}

function getClueReviewTip(item) {
    const status = item.status || "待核验";

    if (status === "已转入真实库") {
        return "该线索已进入真实库，避免重复审核或重复同步。";
    }

    if (status === "已归档") {
        return "该线索已归档，如需继续处理请先人工确认。";
    }

    if (isExternalClue(item)) {
        return "该线索来自外部采集或公开来源，需人工核验来源与摘要后再处理。";
    }

    if (status === "待核验") {
        return "建议核对来源与摘要后再审核。";
    }

    return "请结合用户核验状态、来源与摘要进行人工判断。";
}

function getClueReviewTipClass(item) {
    const status = item.status || "待核验";
    if (status === "已转入真实库") return "clue-review-tip-approved";
    if (status === "已归档") return "clue-review-tip-archived";
    if (isExternalClue(item)) return "clue-review-tip-external";
    return "";
}

function getStatusTagClass(status) {
    if (!status) return "warning";
    if (status.includes("属实")) return "verify-tag";
    if (status.includes("不准确") || status.includes("过期")) return "danger-tag";
    if (status.includes("已转入真实库")) return "tag";
    return "warning";
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
