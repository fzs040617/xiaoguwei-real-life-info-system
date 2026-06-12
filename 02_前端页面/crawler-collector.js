const COLLECTOR_TOKEN_KEY = "xgw_user_token";
const COLLECTOR_BACKEND_URL = "http://127.0.0.1:8000";
const COLLECTOR_NETWORK_MESSAGE = "无法连接后端，请确认 http://127.0.0.1:8000 已启动";
let collectorLastAutoKeyword = "";
let collectorPreviewDocumentEventsBound = false;
const collectorExpandedSources = new Set();
const COLLECTOR_SOURCE_TEMPLATES = [
    {
        name: "小谷围街道概况页",
        url: "https://www.panyu.gov.cn/jgzy/zzfjdbsc/fzqrmzfxgwjdbsc/zjgk/",
        source_type: "public_html",
        platform: "www.panyu.gov.cn",
        keyword: "小谷围 广州大学城 贝岗 南亭"
    },
    {
        name: "广州大学官网",
        url: "https://www.gzhu.edu.cn/",
        source_type: "public_html",
        platform: "www.gzhu.edu.cn",
        keyword: "广州大学 大学城 小谷围"
    },
    {
        name: "中山大学新闻网",
        url: "https://www.sysu.edu.cn/news/",
        source_type: "public_html",
        platform: "www.sysu.edu.cn",
        keyword: "中山大学 大学城 广州"
    },
    {
        name: "人民网社会 RSS 测试",
        url: "http://www.people.com.cn/rss/society.xml",
        source_type: "rss",
        platform: "www.people.com.cn",
        keyword: "广州 大学城 小谷围"
    },
    {
        name: "JSONPlaceholder 测试 API",
        url: "https://jsonplaceholder.typicode.com/posts",
        source_type: "api",
        platform: "jsonplaceholder.typicode.com",
        keyword: ""
    }
];

function collectorToken() {
    if (typeof getAdminToken === "function") {
        return getAdminToken();
    }
    return localStorage.getItem(COLLECTOR_TOKEN_KEY) || "";
}

function collectorApiBase() {
    if (typeof API_BASE !== "undefined") {
        return API_BASE;
    }
    return COLLECTOR_BACKEND_URL;
}

function collectorMessage(text, isError = false) {
    const box = document.getElementById("collectorMessage");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("user-admin-message-error", Boolean(isError));
}

function collectorClueTransferMessage(clueId) {
    const box = ensureCollectorItemActionMessage();
    if (!box) return;
    const normalizedClueId = Number(clueId);
    if (!Number.isInteger(normalizedClueId) || normalizedClueId <= 0) {
        box.className = "collector-action-message collector-action-message-success";
        box.textContent = "已转入线索库，等待审核";
        scrollCollectorActionMessageIntoView(box);
        return;
    }
    const clueUrl = `clue-detail.html?id=${encodeURIComponent(String(normalizedClueId))}`;
    box.className = "collector-action-message collector-action-message-success";
    box.innerHTML = `
        <div>已转入线索库，等待审核</div>
        <div class="collector-transfer-meta">线索 ID：${normalizedClueId}</div>
        <div class="collector-transfer-actions">
            <button type="button" class="small-button verify-button" onclick="location.href='${clueUrl}'">查看线索详情</button>
            <button type="button" class="small-button btn-secondary" onclick="location.href='admin.html'">进入审核中心</button>
        </div>
    `;
    scrollCollectorActionMessageIntoView(box);
}

function collectorDetectMessage(text, isError = false) {
    const box = document.getElementById("collectorDetectMessage");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("user-admin-message-error", Boolean(isError));
}

function collectorManualMessage(text, isError = false) {
    const box = document.getElementById("collectorManualMessage");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("user-admin-message-error", Boolean(isError));
}

function collectorErrorMessage(error) {
    if (error && error.isNetworkError) {
        return COLLECTOR_NETWORK_MESSAGE;
    }
    const message = error && error.message ? error.message : "";
    if (message === "Failed to fetch" || message === "NetworkError when attempting to fetch resource.") {
        return COLLECTOR_NETWORK_MESSAGE;
    }
    return message || "请求失败";
}

function ensureCollectorItemActionMessage() {
    const list = document.getElementById("collectorItemList");
    if (!list || !list.parentElement) return null;
    let box = document.getElementById("collectorItemActionMessage");
    if (!box) {
        box = document.createElement("div");
        box.id = "collectorItemActionMessage";
        list.parentElement.insertBefore(box, list);
    }
    return box;
}

function scrollCollectorActionMessageIntoView(box) {
    if (!box || typeof box.scrollIntoView !== "function") return;
    box.scrollIntoView({behavior: "smooth", block: "center"});
}

async function collectorRequest(path, options = {}) {
    try {
        const response = await fetch(`${collectorApiBase()}${path}`, options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = data.detail || data.message || "请求失败";
            throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            const networkError = new Error(COLLECTOR_NETWORK_MESSAGE);
            networkError.isNetworkError = true;
            throw networkError;
        }
        throw error;
    }
}

async function initCollectorPage() {
    collectorMessage("");
    collectorDetectMessage("");
    collectorManualMessage("");
    renderCollectorTemplates();
    setupCollectorPreviewReadyState();
    const urlInput = document.getElementById("collectorUrl");
    if (urlInput) {
        urlInput.addEventListener("input", () => {
            collectorDetectMessage(urlInput.value.trim() ? "URL 已修改，请重新智能识别。" : "");
        });
    }
    await Promise.all([
        loadCollectorSources(),
        loadCollectorItems(),
        loadCollectorRuns()
    ]);
}

function setupCollectorPreviewReadyState() {
    bindCollectorPreviewDocumentEvents();
    const box = document.getElementById("collectorPreviewBox");
    if (box && box.dataset.previewTouched !== "true") {
        showCollectorPreviewMessage("预览功能已加载，等待点击采集源预览按钮。");
    }
}

function bindCollectorPreviewDocumentEvents() {
    if (collectorPreviewDocumentEventsBound || typeof document === "undefined") return;
    document.addEventListener("click", handleCollectorPageClick);
    collectorPreviewDocumentEventsBound = true;
}

function handleCollectorPageClick(event) {
    handleCollectorSectionCollapseClick(event);
    handleCollectorSectionToggleClick(event);
    handleCollectorItemToClueClick(event);
    handleCollectorItemIgnoreClick(event);
    handleCollectorManualDetectClick(event);
    handleCollectorManualImportClick(event);
    handleCollectorSourceCollapseClick(event);
    handleCollectorSourceDetailClick(event);
    handleCollectorPreviewDetailCollapseClick(event);
    handleCollectorPreviewDetailClick(event);
    handleCollectorPreviewClick(event);
}

function handleCollectorSectionCollapseClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="collapse-section"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    collapseCollectorSection(btn.dataset.target, true);
}

function handleCollectorSectionToggleClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="toggle-section"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    toggleCollectorSection(btn.dataset.target);
}

function handleCollectorItemToClueClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="collector-item-to-clue"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const itemId = Number(btn.dataset.itemId || 0);
    if (!itemId) {
        collectorMessage("转入线索库失败：缺少采集条目 ID", true);
        return;
    }
    transferCollectorItemToClue(itemId, btn);
}

function handleCollectorItemIgnoreClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="collector-item-ignore"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const itemId = Number(btn.dataset.itemId || 0);
    if (!itemId) {
        collectorMessage("标记忽略失败：缺少采集条目 ID", true);
        return;
    }
    ignoreCollectorItem(itemId, btn);
}

function handleCollectorManualImportClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="manual-import"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    submitManualCollectorItem();
}

function handleCollectorManualDetectClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="manual-detect"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    detectManualCollectorItem();
}

function handleCollectorSourceCollapseClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="collapse-source-detail"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    if (!sourceId) return;
    collapseCollectorSourceDetail(sourceId, true);
}

function handleCollectorSourceDetailClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="toggle-source-detail"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    if (!sourceId) return;
    toggleCollectorSourceDetail(sourceId);
}

function handleCollectorPreviewDetailCollapseClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="collapse-preview-detail"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    collapseCollectorPreviewDetail(sourceId, true);
}

function handleCollectorPreviewDetailClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="toggle-preview-detail"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    toggleCollectorPreviewDetail(sourceId);
}

function handleCollectorPreviewClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="preview"], .collector-preview-btn') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    if (!sourceId) {
        showCollectorPreviewMessage("预览失败：缺少采集源 ID", true);
        return;
    }

    expandCollectorSection("collector-section-sources");
    expandCollectorSourceDetail(sourceId);
    showCollectorPreviewMessage(`已收到预览点击，正在请求后端... 正在预览采集源 #${sourceId} ...`, false, sourceId);
    previewCollectorSource(sourceId);
}

function toggleCollectorSection(sectionId) {
    const section = document.getElementById(sectionId || "");
    if (!section) return;
    const shouldExpand = section.classList.contains("collector-section-collapsed");
    setCollectorSectionExpanded(sectionId, shouldExpand);
}

function expandCollectorSection(sectionId) {
    setCollectorSectionExpanded(sectionId, true);
}

function collapseCollectorSection(sectionId, shouldScroll = false) {
    setCollectorSectionExpanded(sectionId, false);
    if (shouldScroll) {
        scrollCollectorSectionHeaderIntoView(sectionId);
    }
}

function setCollectorSectionExpanded(sectionId, expanded) {
    const section = document.getElementById(sectionId || "");
    if (!section) return;
    section.classList.toggle("collector-section-collapsed", !expanded);
    const btn = section.querySelector('[data-action="toggle-section"]');
    if (btn) {
        btn.textContent = expanded ? "收起" : "展开";
    }
}

function scrollCollectorSectionHeaderIntoView(sectionId) {
    const section = document.getElementById(sectionId || "");
    if (!section) return;
    const header = section.querySelector(".collector-panel-header") || section;
    if (typeof header.scrollIntoView === "function") {
        header.scrollIntoView({behavior: "smooth", block: "start"});
    }
}

function toggleCollectorSourceDetail(sourceId) {
    if (collectorExpandedSources.has(sourceId)) {
        collectorExpandedSources.delete(sourceId);
    } else {
        collectorExpandedSources.add(sourceId);
    }
    updateCollectorSourceDetailState(sourceId);
}

function expandCollectorSourceDetail(sourceId) {
    collectorExpandedSources.add(Number(sourceId));
    updateCollectorSourceDetailState(sourceId);
}

function collapseCollectorSourceDetail(sourceId, shouldScroll = false) {
    const normalizedSourceId = Number(sourceId);
    collectorExpandedSources.delete(normalizedSourceId);
    updateCollectorSourceDetailState(normalizedSourceId);
    if (shouldScroll) {
        scrollCollectorSourceSummaryIntoView(normalizedSourceId);
    }
}

function updateCollectorSourceDetailState(sourceId) {
    const source = Number(sourceId);
    const card = document.getElementById(`collector-source-${source}`);
    if (!card) return;
    const expanded = collectorExpandedSources.has(source);
    card.classList.toggle("collector-source-expanded", expanded);
    const details = card.querySelector(".collector-source-details");
    if (details) {
        details.hidden = !expanded;
    }
    const btn = card.querySelector('[data-action="toggle-source-detail"]');
    if (btn) {
        btn.textContent = expanded ? "收起" : "展开";
    }
}

function scrollCollectorSourceSummaryIntoView(sourceId) {
    const card = document.getElementById(`collector-source-${Number(sourceId)}`);
    if (!card) return;
    const summary = card.querySelector(".collector-source-summary") || card;
    if (typeof summary.scrollIntoView === "function") {
        summary.scrollIntoView({behavior: "smooth", block: "center"});
    }
}

function toggleCollectorPreviewDetail(sourceId) {
    const normalizedSourceId = Number(sourceId || 0);
    const detail = document.getElementById(`collector-preview-detail-${normalizedSourceId}`);
    const btn = document.querySelector(`[data-action="toggle-preview-detail"][data-source-id="${normalizedSourceId}"]`);
    if (!detail) return;

    const shouldExpand = detail.hidden;
    detail.hidden = !shouldExpand;
    if (btn) {
        btn.textContent = shouldExpand ? "收起预览详情" : "展开预览详情";
    }
}

function collapseCollectorPreviewDetail(sourceId, shouldScroll = false) {
    const normalizedSourceId = Number(sourceId || 0);
    const detail = document.getElementById(`collector-preview-detail-${normalizedSourceId}`);
    const btn = document.querySelector(`[data-action="toggle-preview-detail"][data-source-id="${normalizedSourceId}"]`);
    if (!detail) return;
    detail.hidden = true;
    if (btn) {
        btn.textContent = "展开预览详情";
    }
    if (shouldScroll) {
        scrollCollectorPreviewSummaryIntoView(normalizedSourceId);
    }
}

function scrollCollectorPreviewSummaryIntoView(sourceId) {
    const box = collectorPreviewBoxForSource(sourceId);
    if (!box) return;
    const summary = box.querySelector(".collector-preview-summary") || box;
    if (typeof summary.scrollIntoView === "function") {
        summary.scrollIntoView({behavior: "smooth", block: "center"});
    }
}

async function loadCollectorSources() {
    const box = document.getElementById("collectorSourceList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载采集源...</div>`;

    try {
        const data = await collectorRequest(`/collector-admin/sources?token=${encodeURIComponent(collectorToken())}`);
        renderCollectorSources(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">采集源加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

async function detectCollectorSource() {
    const urlInput = document.getElementById("collectorUrl");
    const url = urlInput ? urlInput.value.trim() : "";

    if (!url) {
        collectorDetectMessage("请先填写需要识别的公开 URL。", true);
        return;
    }

    collectorDetectMessage("正在识别采集源...");
    try {
        const data = await collectorRequest("/collector-admin/detect-source", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                url
            })
        });

        if (!data.ok) {
            collectorDetectMessage(data.message || "无法识别该公开 URL，或请求超时", true);
            return;
        }

        const detectedType = normalizeCollectorSourceType(data.source_type || "");
        const detectedPlatform = data.platform || platformFromCollectorUrl(url);
        const detectedName = data.name || data.title || detectedPlatform;

        setInputValue("collectorType", detectedType, true);
        setInputValue("collectorPlatform", detectedPlatform, true);
        setInputValue("collectorName", detectedName, true);

        const keywordInput = document.getElementById("collectorKeyword");
        if (keywordInput && data.keyword_suggestion) {
            const currentKeyword = keywordInput.value.trim();
            if (!currentKeyword || currentKeyword === collectorLastAutoKeyword) {
                keywordInput.value = data.keyword_suggestion;
                collectorLastAutoKeyword = data.keyword_suggestion;
            }
        }

        collectorDetectMessage(
            `识别成功：类型 ${detectedType || "-"}，平台 ${detectedPlatform || "-"}，标题 ${data.title || detectedName || "-"}`
        );
    } catch (error) {
        collectorDetectMessage(`识别失败：${collectorErrorMessage(error)}`, true);
    }
}

function setInputValue(id, value, alwaysReplace) {
    const input = document.getElementById(id);
    if (!input || !value) return;
    if (alwaysReplace || !input.value.trim()) {
        input.value = value;
    }
}

function normalizeCollectorSourceType(sourceType) {
    const value = String(sourceType || "").trim();
    if (["rss", "api", "public_html"].includes(value)) {
        return value;
    }
    return "public_html";
}

function platformFromCollectorUrl(url) {
    try {
        return new URL(url).hostname || "";
    } catch (error) {
        return "";
    }
}

function renderCollectorTemplates() {
    const box = document.getElementById("collectorTemplateList");
    if (!box) return;
    box.innerHTML = COLLECTOR_SOURCE_TEMPLATES.map((template, index) => `
        <button type="button" class="small-button collector-template-button" onclick="fillCollectorTemplate(${index})">
            ${collectorEscapeHtml(template.name)}
        </button>
    `).join("");
}

function fillCollectorTemplate(index) {
    const template = COLLECTOR_SOURCE_TEMPLATES[index];
    if (!template) return;

    setInputValue("collectorName", template.name, true);
    setInputValue("collectorPlatform", template.platform, true);
    setInputValue("collectorType", template.source_type, true);
    setInputValue("collectorUrl", template.url, true);
    const keywordInput = document.getElementById("collectorKeyword");
    if (keywordInput) {
        keywordInput.value = template.keyword || "";
        collectorLastAutoKeyword = template.keyword || "";
    }
    collectorDetectMessage(`已填入模板：${template.name}。请确认后再新增采集源。`);
}

async function submitCollectorSource() {
    const name = document.getElementById("collectorName").value.trim();
    const platform = document.getElementById("collectorPlatform").value.trim();
    const sourceType = document.getElementById("collectorType").value;
    const url = document.getElementById("collectorUrl").value.trim();
    const keyword = document.getElementById("collectorKeyword").value.trim();
    const enabled = document.getElementById("collectorEnabled").value === "true";
    const notes = document.getElementById("collectorNotes").value.trim();

    if (!name || !url) {
        collectorMessage("请填写名称和 URL。", true);
        return;
    }

    try {
        await collectorRequest("/collector-admin/sources", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                name,
                platform,
                source_type: sourceType,
                url,
                keyword,
                enabled,
                interval_hours: 24,
                notes
            })
        });
        collectorMessage("采集源已新增。");
        collectorDetectMessage("");
        document.getElementById("collectorName").value = "";
        document.getElementById("collectorPlatform").value = "";
        document.getElementById("collectorUrl").value = "";
        document.getElementById("collectorKeyword").value = "";
        document.getElementById("collectorNotes").value = "";
        collectorLastAutoKeyword = "";
        expandCollectorSection("collector-section-sources");
        await loadCollectorSources();
    } catch (error) {
        collectorMessage(`新增失败：${collectorErrorMessage(error)}`, true);
    }
}

async function toggleCollectorSource(sourceId, enabled) {
    try {
        await collectorRequest(`/collector-admin/sources/${sourceId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                enabled
            })
        });
        collectorMessage(enabled ? "采集源已启用。" : "采集源已停用。");
        await loadCollectorSources();
    } catch (error) {
        collectorMessage(`切换失败：${collectorErrorMessage(error)}`, true);
    }
}

async function runCollectorSource(sourceId) {
    collectorMessage("正在运行采集源，请稍等...");
    try {
        const data = await collectorRequest(`/collector-admin/sources/${sourceId}/run`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const run = data.result && data.result.run ? data.result.run : {};
        collectorMessage(`采集完成：状态 ${run.status || "-"}，新增 ${run.item_count ?? 0} 条。`);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    }
}

async function previewCollectorSource(sourceId) {
    const normalizedSourceId = Number(sourceId || 0);
    if (!normalizedSourceId) {
        showCollectorPreviewMessage("预览失败：缺少采集源 ID", true);
        return;
    }
    if (!collectorToken()) {
        showCollectorPreviewMessage("预览失败：请先以管理员身份登录", true, normalizedSourceId);
        return;
    }

    showCollectorPreviewMessage(`正在预览采集源 #${normalizedSourceId} ... 预览不会写入数据库。`, false, normalizedSourceId);
    try {
        const data = await collectorRequest(`/collector-admin/sources/${normalizedSourceId}/preview`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        renderCollectorPreview(data.result || {}, normalizedSourceId);
    } catch (error) {
        const message = collectorErrorMessage(error);
        if (message.includes("管理员") || message.includes("登录") || message.includes("权限")) {
            showCollectorPreviewMessage("预览失败：请先以管理员身份登录", true, normalizedSourceId);
            return;
        }
        showCollectorPreviewMessage(`预览失败：${message}`, true, normalizedSourceId);
    }
}

async function runAllCollectorSources() {
    collectorMessage("正在运行全部启用采集源，请稍等...");
    try {
        const data = await collectorRequest("/collector-admin/run-all", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const result = data.result || {};
        collectorMessage(`全部运行完成：源 ${result.total_sources ?? 0} 个，新增 ${result.item_count ?? 0} 条，失败 ${result.failed_count ?? 0} 个。`);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`全部运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    }
}

async function detectManualCollectorItem() {
    const platformInput = document.getElementById("manualPlatform");
    const titleInput = document.getElementById("manualTitle");
    const urlInput = document.getElementById("manualUrl");
    const summaryInput = document.getElementById("manualSummary");
    const notesInput = document.getElementById("manualNotes");
    const rawTextInput = document.getElementById("manualRawText");

    const url = urlInput ? urlInput.value.trim() : "";
    const rawText = rawTextInput ? rawTextInput.value.trim() : "";

    if (!url && !rawText) {
        collectorManualMessage("请填写 URL 或粘贴公开文本后再识别", true);
        return;
    }

    collectorManualMessage("正在识别人工导入信息...");

    try {
        const data = await collectorRequest("/collector-admin/items/manual/detect", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                platform: platformInput ? platformInput.value.trim() : "",
                title: titleInput ? titleInput.value.trim() : "",
                url,
                summary: summaryInput ? summaryInput.value.trim() : "",
                notes: notesInput ? notesInput.value.trim() : "",
                raw_text: rawText
            })
        });

        if (platformInput && data.platform) {
            platformInput.value = data.platform;
        }
        if (titleInput && data.title) {
            titleInput.value = data.title;
        }
        if (summaryInput && data.summary) {
            summaryInput.value = data.summary;
        }
        if (notesInput && !notesInput.value.trim() && data.notes) {
            notesInput.value = data.notes;
        }

        const warning = data.warning ? ` ${data.warning}` : "";
        collectorManualMessage(`识别成功，已填入平台、标题和摘要${warning}`);
    } catch (error) {
        collectorManualMessage(`人工导入智能识别失败：${collectorErrorMessage(error)}`, true);
    }
}

async function submitManualCollectorItem() {
    const platform = document.getElementById("manualPlatform").value.trim() || "人工导入";
    const title = document.getElementById("manualTitle").value.trim();
    const url = document.getElementById("manualUrl").value.trim();
    const summary = document.getElementById("manualSummary").value.trim();
    const notes = document.getElementById("manualNotes").value.trim();

    if (!title) {
        collectorManualMessage("人工导入失败：标题不能为空", true);
        return;
    }

    try {
        await collectorRequest("/collector-admin/items/manual", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                platform,
                title,
                url,
                summary,
                notes
            })
        });
        collectorManualMessage("人工导入保存成功，已加入采集条目");
        document.getElementById("manualPlatform").value = "";
        document.getElementById("manualTitle").value = "";
        document.getElementById("manualUrl").value = "";
        document.getElementById("manualSummary").value = "";
        document.getElementById("manualNotes").value = "";
        const rawTextInput = document.getElementById("manualRawText");
        if (rawTextInput) {
            rawTextInput.value = "";
        }
        expandCollectorSection("collector-section-items");
        await loadCollectorItems();
    } catch (error) {
        collectorManualMessage(`人工导入失败：${collectorErrorMessage(error)}`, true);
    }
}

function renderCollectorSources(sources) {
    const box = document.getElementById("collectorSourceList");
    if (!box) return;
    updateCollectorSourceTitle(sources.length);

    if (!sources.length) {
        box.innerHTML = `<div class="empty">暂无采集源。请新增公开 RSS、公开 API 或公开 HTML 列表页。</div>`;
        return;
    }

    box.innerHTML = sources.map(source => `
        <div class="target-item collector-source-item ${collectorExpandedSources.has(Number(source.id)) ? "collector-source-expanded" : ""}" id="collector-source-${collectorEscapeAttribute(source.id)}">
            <div class="collector-source-summary">
                <div class="collector-source-main">
                    <span class="tag">${collectorEscapeHtml(source.source_type || "-")}</span>
                    <span class="tag ${source.enabled ? "" : "danger-tag"}">${source.enabled ? "启用中" : "已停用"}</span>
                    <strong>${collectorEscapeHtml(source.name || "未命名采集源")}</strong>
                    <span class="collector-source-platform">${collectorEscapeHtml(source.platform || "未填写平台")}</span>
                    <span class="collector-source-url">${collectorEscapeHtml(shortCollectorUrl(source.url || ""))}</span>
                </div>
                <div class="collector-source-actions">
                    <button type="button" class="small-button" data-action="toggle-source-detail" data-source-id="${collectorEscapeAttribute(source.id)}">${collectorExpandedSources.has(Number(source.id)) ? "收起" : "展开"}</button>
                    <button type="button" class="small-button btn-secondary collector-preview-btn" data-action="preview" data-source-id="${collectorEscapeAttribute(source.id)}">预览</button>
                    <button class="small-button verify-button" onclick="runCollectorSource(${source.id})">运行单个源</button>
                    <button class="small-button" onclick="toggleCollectorSource(${source.id}, ${source.enabled ? "false" : "true"})">${source.enabled ? "停用" : "启用"}</button>
                </div>
            </div>
            <div class="collector-source-details" ${collectorExpandedSources.has(Number(source.id)) ? "" : "hidden"}>
                <div>关键词：${collectorEscapeHtml(source.keyword || "空关键词：不过滤公开结果")}</div>
                <div>备注：${collectorEscapeHtml(source.notes || "暂无备注")}</div>
                <div>最近运行：${collectorEscapeHtml(source.last_run_at || "尚未运行")}</div>
                <div class="target-url">完整 URL：${collectorEscapeHtml(source.url || "")}</div>
                <div class="collector-inline-preview" id="collector-preview-inline-${collectorEscapeAttribute(source.id)}"></div>
                <div class="collector-source-collapse-row">
                    <button type="button" class="small-button" data-action="collapse-source-detail" data-source-id="${collectorEscapeAttribute(source.id)}">收起该源</button>
                </div>
            </div>
        </div>
    `).join("");
}

function updateCollectorSourceTitle(count) {
    const title = document.getElementById("collectorSourceTitle");
    if (title) {
        title.textContent = `采集源列表（共 ${count} 个）`;
    }
}

function shortCollectorUrl(url) {
    const value = String(url || "");
    if (value.length <= 56) return value;
    return `${value.slice(0, 32)}...${value.slice(-18)}`;
}

function collectorPreviewBoxForSource(sourceId) {
    const normalizedSourceId = Number(sourceId || 0);
    if (normalizedSourceId) {
        const inlineBox = document.getElementById(`collector-preview-inline-${normalizedSourceId}`);
        if (inlineBox) {
            return inlineBox;
        }
    }
    return document.getElementById("collectorPreviewBox");
}

function scrollCollectorPreviewIntoView(box) {
    if (box && typeof box.scrollIntoView === "function") {
        box.scrollIntoView({behavior: "smooth", block: "nearest"});
    }
}

function showCollectorPreviewMessage(text, isError = false, sourceId = null) {
    const box = collectorPreviewBoxForSource(sourceId);
    if (!box) {
        collectorMessage(text, isError);
        return;
    }
    box.dataset.previewTouched = "true";
    box.innerHTML = `<div class="empty ${isError ? "user-admin-message-error" : ""}">${collectorEscapeHtml(text)}</div>`;
    scrollCollectorPreviewIntoView(box);
}

function renderCollectorPreview(result, sourceId = null) {
    const normalizedSourceId = Number(sourceId || (result.source && result.source.id) || 0);
    const box = collectorPreviewBoxForSource(normalizedSourceId);
    if (!box) return;

    const items = result.data || [];
    const source = result.source || {};
    const wouldSaveCount = items.filter(item => item.would_save).length;
    const summary = `
        <div class="collector-preview-summary">
            <strong>${collectorEscapeHtml(source.name || "采集源预览")}</strong>
            <span class="tag">候选 ${result.candidates_count ?? 0}</span>
            <span class="tag">命中 ${result.matched_count ?? 0}</span>
            <span class="tag">可入库 ${wouldSaveCount}</span>
            <span class="notice">${collectorEscapeHtml(result.reason || "已完成预览")}</span>
        </div>
    `;

    if (!items.length) {
        box.innerHTML = `${summary}<div class="empty">预览完成，但没有匹配结果。</div>`;
        scrollCollectorPreviewIntoView(box);
        return;
    }

    box.innerHTML = `
        ${summary}
        <button type="button" class="small-button" data-action="toggle-preview-detail" data-source-id="${collectorEscapeAttribute(normalizedSourceId)}">展开预览详情</button>
        <div id="collector-preview-detail-${collectorEscapeAttribute(normalizedSourceId)}" class="collector-preview-detail" hidden>
            ${items.map(item => `
                <div class="card collector-preview-item">
                    <div>
                        <span class="tag">${item.would_save ? "可入库" : "不会入库"}</span>
                        <strong>${collectorEscapeHtml(item.title || "未命名候选")}</strong>
                    </div>
                    <div class="target-url">${item.url ? `<a href="${collectorEscapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">${collectorEscapeHtml(item.url)}</a>` : "无链接"}</div>
                    <div class="summary">${collectorEscapeHtml(item.summary || "暂无摘要")}</div>
                    <div class="notice">命中关键词：${collectorEscapeHtml((item.matched_keywords || []).join("、") || "无；空关键词源会按公开结果预览")}</div>
                </div>
            `).join("")}
            <div class="collector-source-collapse-row">
                <button type="button" class="small-button" data-action="collapse-preview-detail" data-source-id="${collectorEscapeAttribute(normalizedSourceId)}">收起预览详情</button>
            </div>
        </div>
    `;
    scrollCollectorPreviewIntoView(box);
}

async function loadCollectorItems() {
    const box = document.getElementById("collectorItemList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载采集条目...</div>`;

    const keywordInput = document.getElementById("collectorItemKeyword");
    const statusInput = document.getElementById("collectorItemStatus");
    const keyword = keywordInput ? keywordInput.value.trim() : "";
    const status = statusInput ? statusInput.value : "";
    const query = new URLSearchParams({
        token: collectorToken(),
        limit: "50",
        offset: "0"
    });
    if (keyword) query.set("keyword", keyword);
    if (status) query.set("status", status);

    try {
        const data = await collectorRequest(`/collector-admin/items?${query.toString()}`);
        updateCollectorItemTitle(data.total ?? (data.data || []).length);
        renderCollectorItems(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">采集条目加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

async function transferCollectorItemToClue(itemId, button) {
    if (!window.confirm("确认将该采集条目转入线索库等待审核吗？")) {
        return;
    }

    const originalText = button ? button.textContent : "";
    if (button) {
        button.disabled = true;
        button.textContent = "处理中...";
    }
    collectorMessage("正在转入线索库...");

    try {
        const data = await collectorRequest(`/collector-admin/items/${itemId}/to-clue`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        await loadCollectorItems();
        collectorClueTransferMessage(data.clue_id);
    } catch (error) {
        collectorMessage(`转入线索库失败：${collectorErrorMessage(error)}`, true);
        if (button) {
            button.disabled = false;
            button.textContent = originalText || "转入线索库";
        }
    }
}

async function ignoreCollectorItem(itemId, button) {
    if (!window.confirm("确认将该采集条目标记为忽略吗？")) {
        return;
    }

    const originalText = button ? button.textContent : "";
    if (button) {
        button.disabled = true;
        button.textContent = "处理中...";
    }
    collectorMessage("正在标记忽略...");

    try {
        await collectorRequest(`/collector-admin/items/${itemId}/ignore`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        collectorMessage("已标记忽略");
        await loadCollectorItems();
    } catch (error) {
        collectorMessage(`标记忽略失败：${collectorErrorMessage(error)}`, true);
        if (button) {
            button.disabled = false;
            button.textContent = originalText || "忽略";
        }
    }
}

function renderCollectorItems(items) {
    const box = document.getElementById("collectorItemList");
    if (!box) return;

    if (!items.length) {
        box.innerHTML = `<div class="empty">暂无采集条目。</div>`;
        return;
    }

    box.innerHTML = items.map(item => `
        <div class="card">
            <div>
                <span class="tag collector-status-${collectorEscapeAttribute(item.status || "new")}">${collectorEscapeHtml(item.status || "new")}</span>
                <span class="tag">${collectorEscapeHtml(item.platform || "未知平台")}</span>
                <strong>${collectorEscapeHtml(item.title || "未命名条目")}</strong>
            </div>
            <div class="target-url">${item.url ? `<a href="${collectorEscapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">${collectorEscapeHtml(item.url)}</a>` : "无链接"}</div>
            <div class="summary">${collectorEscapeHtml(item.summary || "暂无摘要")}</div>
            <div class="notice">来源：${collectorEscapeHtml(item.source_name || String(item.source_id || "-"))} · 发布时间：${collectorEscapeHtml(item.published_at || "-")} · 抓取时间：${collectorEscapeHtml(item.fetched_at || "-")}</div>
            ${renderCollectorItemActions(item)}
        </div>
    `).join("");
}

function renderCollectorItemActions(item) {
    const status = item.status || "new";
    const itemId = collectorEscapeAttribute(item.id);
    if (status === "new") {
        return `
            <div class="collector-item-actions">
                <button type="button" class="small-button verify-button" data-action="collector-item-to-clue" data-item-id="${itemId}">转入线索库</button>
                <button type="button" class="small-button btn-secondary" data-action="collector-item-ignore" data-item-id="${itemId}">忽略</button>
            </div>
        `;
    }
    if (status === "reviewed") {
        return `<div class="collector-item-status-note collector-status-reviewed">已转入线索库，等待审核</div>`;
    }
    if (status === "ignored") {
        return `<div class="collector-item-status-note collector-status-ignored">已忽略</div>`;
    }
    return "";
}

async function loadCollectorRuns() {
    const box = document.getElementById("collectorRunList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载运行日志...</div>`;

    try {
        const data = await collectorRequest(`/collector-admin/runs?token=${encodeURIComponent(collectorToken())}&limit=50&offset=0`);
        updateCollectorRunTitle((data.data || []).length);
        renderCollectorRuns(data.data || []);
    } catch (error) {
        box.innerHTML = `<div class="empty">运行日志加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

function updateCollectorItemTitle(count) {
    const title = document.getElementById("collectorItemTitle");
    if (title) {
        title.textContent = `采集条目列表（共 ${count} 条）`;
    }
}

function updateCollectorRunTitle(count) {
    const title = document.getElementById("collectorRunTitle");
    if (title) {
        title.textContent = `运行日志（最近 ${count} 条）`;
    }
}

function renderCollectorRuns(runs) {
    const box = document.getElementById("collectorRunList");
    if (!box) return;

    if (!runs.length) {
        box.innerHTML = `<div class="empty">暂无运行日志。</div>`;
        return;
    }

    box.innerHTML = `
        <div class="user-admin-table-wrap">
            <table class="user-admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>采集源</th>
                        <th>状态</th>
                        <th>新增</th>
                        <th>开始</th>
                        <th>结束</th>
                        <th>错误</th>
                    </tr>
                </thead>
                <tbody>
                    ${runs.map(run => `
                        <tr>
                            <td>${run.id}</td>
                            <td>${collectorEscapeHtml(run.source_name || String(run.source_id || "-"))}</td>
                            <td>${collectorEscapeHtml(run.status || "-")}</td>
                            <td>${run.item_count ?? 0}</td>
                            <td>${collectorEscapeHtml(run.started_at || "-")}</td>
                            <td>${collectorEscapeHtml(run.finished_at || "-")}</td>
                            <td>${collectorEscapeHtml(run.error_message || "")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function collectorEscapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function collectorEscapeAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

bindCollectorPreviewDocumentEvents();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupCollectorPreviewReadyState);
} else {
    setupCollectorPreviewReadyState();
}
