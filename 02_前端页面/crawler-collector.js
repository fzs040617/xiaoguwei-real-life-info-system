const COLLECTOR_TOKEN_KEY = "xgw_user_token";
const COLLECTOR_BACKEND_URL = "http://127.0.0.1:8000";
const COLLECTOR_NETWORK_MESSAGE = "无法连接后端，请确认 http://127.0.0.1:8000 已启动";
const AUTHORIZED_SOURCE_TYPES = new Set(["local_folder", "data_package_url", "authorized_api", "data_provider"]);
const COLLECTOR_DEFAULT_MODULE = "source-create";
const COLLECTOR_SECTION_MODULES = {
    "collector-section-create": "source-create",
    "collector-section-templates": "source-create",
    "collector-section-daily": "daily-authorized",
    "collector-section-sources": "source-list",
    "collector-section-preview": "source-list",
    "collector-section-manual": "manual-import",
    "collector-section-items": "items",
    "collector-section-runs": "runs"
};
const COLLECTOR_ALWAYS_EXPANDED_SECTIONS = new Set([
    "collector-section-sources",
    "collector-section-items",
    "collector-section-runs"
]);
let collectorLastAutoKeyword = "";
let collectorPreviewDocumentEventsBound = false;
const collectorExpandedSources = new Set();
const collectorLatestRunsBySource = new Map();
const collectorSourceItemCounts = new Map();
let collectorAllSources = [];
let collectorProblemSourceFilterActive = false;
let collectorCurrentRunFilter = null;
let collectorViewingSourceName = "";
let collectorSourceDiagnosticsReady = false;
let collectorSourceDiagnosticsPartialFailure = false;
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
    const dailyBox = document.getElementById("collectorDailyMessage");
    [box, dailyBox].forEach(messageBox => {
        if (!messageBox) return;
        messageBox.textContent = text || "";
        messageBox.classList.toggle("user-admin-message-error", Boolean(isError));
    });
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

function collectorSourceConfigStatus(text, isError = false) {
    const box = document.getElementById("collectorSourceConfigStatus");
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

function setCollectorButtonBusy(button, busyText = "处理中...") {
    if (!button) return null;
    const state = {
        text: button.textContent,
        disabled: button.disabled
    };
    button.disabled = true;
    button.textContent = busyText;
    return state;
}

function restoreCollectorButton(button, state) {
    if (!button || !state) return;
    button.disabled = state.disabled;
    button.textContent = state.text;
}

function collectorSourceTypeLabel(sourceType) {
    const labels = {
        rss: "RSS",
        api: "公开 JSON API",
        public_html: "公开 HTML",
        local_folder: "本地目录 CSV / JSON",
        data_package_url: "授权数据包 URL",
        authorized_api: "授权 API（预留）",
        data_provider: "合法数据服务商（预留）"
    };
    return labels[sourceType] || sourceType || "-";
}

function isAuthorizedSourceType(sourceType) {
    return AUTHORIZED_SOURCE_TYPES.has(sourceType);
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
    initCollectorPanelCollapseState();
    initCollectorModuleTabs();
    collectorMessage("");
    collectorDetectMessage("");
    collectorSourceConfigStatus("");
    collectorManualMessage("");
    renderCollectorTemplates();
    setupCollectorPreviewReadyState();
    const urlInput = document.getElementById("collectorUrl");
    if (urlInput) {
        urlInput.addEventListener("input", () => {
            collectorDetectMessage(urlInput.value.trim() ? "URL 已修改，请重新智能识别。" : "");
        });
    }
    setupCollectorSourceFilters();
    setupCollectorItemFilters();
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
    handleCollectorModuleTabClick(event);
    handleCollectorSectionCollapseClick(event);
    handleCollectorSectionToggleClick(event);
    handleCollectorItemToClueClick(event);
    handleCollectorItemIgnoreClick(event);
    handleCollectorItemFilterClick(event);
    handleCollectorItemClearFilterClick(event);
    handleCollectorManualDetectClick(event);
    handleCollectorManualImportClick(event);
    handleCollectorManualClearClick(event);
    handleCollectorSourceCollapseClick(event);
    handleCollectorSourceDetailClick(event);
    handleCollectorSourceFilterClick(event);
    handleCollectorSourceProblemClick(event);
    handleCollectorSourceClearFilterClick(event);
    handleCollectorSourceRunsClick(event);
    handleCollectorSourceItemsClick(event);
    handleCollectorAllRunsClick(event);
    handleCollectorPreviewDetailCollapseClick(event);
    handleCollectorPreviewDetailClick(event);
    handleCollectorPreviewClick(event);
}

function initCollectorModuleTabs() {
    showCollectorModule(COLLECTOR_DEFAULT_MODULE);
}

function initCollectorPanelCollapseState() {
    document.querySelectorAll(".collector-panel").forEach(panel => {
        syncCollectorSectionToggleState(panel);
    });
}

function handleCollectorModuleTabClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest("[data-collector-tab]") : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    showCollectorModule(btn.dataset.collectorTab || COLLECTOR_DEFAULT_MODULE, true);
}

function showCollectorModule(moduleName, shouldScroll = false) {
    const requestedModule = moduleName || COLLECTOR_DEFAULT_MODULE;
    const panels = Array.from(document.querySelectorAll("[data-collector-module]"));
    const hasRequestedModule = panels.some(panel => panel.dataset.collectorModule === requestedModule);
    const activeModule = hasRequestedModule ? requestedModule : COLLECTOR_DEFAULT_MODULE;

    panels.forEach(panel => {
        const isActivePanel = panel.dataset.collectorModule === activeModule;
        panel.hidden = !isActivePanel;
        if (isActivePanel && panel.id) {
            if (COLLECTOR_ALWAYS_EXPANDED_SECTIONS.has(panel.id)) {
                setCollectorSectionExpanded(panel.id, true);
            } else {
                syncCollectorSectionToggleState(panel.id);
            }
        }
    });

    document.querySelectorAll("[data-collector-tab]").forEach(tab => {
        const isActiveTab = tab.dataset.collectorTab === activeModule;
        tab.classList.toggle("active", isActiveTab);
        tab.setAttribute("aria-selected", isActiveTab ? "true" : "false");
    });

    if (shouldScroll) {
        const tabBar = document.querySelector(".collector-module-tabs");
        if (tabBar && typeof tabBar.scrollIntoView === "function") {
            tabBar.scrollIntoView({behavior: "smooth", block: "start"});
        }
    }
}

function showCollectorModuleForSection(sectionId) {
    const moduleName = COLLECTOR_SECTION_MODULES[sectionId || ""];
    if (moduleName) {
        showCollectorModule(moduleName);
    }
}

function setupCollectorSourceFilters() {
    ["collectorSourceKeyword", "collectorSourceEnabledFilter", "collectorSourceRunFilter", "collectorSourceTypeFilter"].forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.dataset.collectorFilterReady === "true") return;
        input.dataset.collectorFilterReady = "true";
        input.addEventListener("change", () => {
            collectorProblemSourceFilterActive = false;
            applyCollectorSourceFilters();
        });
        if (id === "collectorSourceKeyword") {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    collectorProblemSourceFilterActive = false;
                    applyCollectorSourceFilters();
                }
            });
        }
    });
}

function setupCollectorItemFilters() {
    ["collectorItemKeyword", "collectorItemStatus", "collectorItemPlatform", "collectorItemSource"].forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.dataset.collectorItemFilterReady === "true") return;
        input.dataset.collectorItemFilterReady = "true";
        input.addEventListener("change", () => {
            collectorViewingSourceName = "";
            loadCollectorItems();
        });
        if (id === "collectorItemKeyword" || id === "collectorItemPlatform") {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    collectorViewingSourceName = "";
                    loadCollectorItems();
                }
            });
        }
    });
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

function handleCollectorItemFilterClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="filter-items"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    collectorViewingSourceName = "";
    const buttonState = setCollectorButtonBusy(btn, "筛选中...");
    loadCollectorItems().finally(() => restoreCollectorButton(btn, buttonState));
}

function handleCollectorItemClearFilterClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="clear-item-filters"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    clearCollectorItemFilters();
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

    const buttonState = setCollectorButtonBusy(btn, "识别中...");
    detectManualCollectorItem().finally(() => restoreCollectorButton(btn, buttonState));
}

function handleCollectorManualClearClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="manual-clear"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    clearManualCollectorForm();
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

function handleCollectorSourceFilterClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="filter-sources"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    collectorProblemSourceFilterActive = false;
    applyCollectorSourceFilters();
}

function handleCollectorSourceProblemClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="problem-sources"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    showCollectorProblemSources();
}

function handleCollectorSourceClearFilterClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="clear-source-filters"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    clearCollectorSourceFilters();
}

function handleCollectorSourceRunsClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="view-source-runs"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    if (!sourceId) {
        collectorMessage("查看该源日志失败：缺少采集源 ID", true);
        return;
    }
    const buttonState = setCollectorButtonBusy(btn, "加载中...");
    viewCollectorRunsForSource(sourceId, btn.dataset.sourceName || "")
        .finally(() => restoreCollectorButton(btn, buttonState));
}

function handleCollectorSourceItemsClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="view-source-items"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const sourceId = Number(btn.dataset.sourceId || 0);
    if (!sourceId) {
        collectorMessage("查看该源采集条目失败：缺少采集源 ID", true);
        return;
    }
    const buttonState = setCollectorButtonBusy(btn, "加载中...");
    viewCollectorItemsForSource(sourceId, btn.dataset.sourceName || "")
        .finally(() => restoreCollectorButton(btn, buttonState));
}

function handleCollectorAllRunsClick(event) {
    const target = event.target && event.target.closest ? event.target : event.target.parentElement;
    const btn = target ? target.closest('[data-action="view-all-runs"]') : null;
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const buttonState = setCollectorButtonBusy(btn, "刷新中...");
    loadCollectorRuns().finally(() => restoreCollectorButton(btn, buttonState));
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
    const shouldExpand = isCollectorSectionCollapsed(section);
    setCollectorSectionExpanded(sectionId, shouldExpand);
}

function expandCollectorSection(sectionId) {
    showCollectorModuleForSection(sectionId);
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
    section.classList.toggle("is-collapsed", !expanded);
    section.setAttribute("aria-expanded", expanded ? "true" : "false");
    const body = section.querySelector(".collector-panel-body");
    if (body) {
        body.hidden = !expanded;
    }
    syncCollectorSectionToggleState(sectionId);
}

function isCollectorSectionCollapsed(section) {
    if (!section) return false;
    const body = section.querySelector(".collector-panel-body");
    return section.classList.contains("is-collapsed") ||
        section.classList.contains("collector-section-collapsed") ||
        Boolean(body && body.hidden);
}

function syncCollectorSectionToggleState(sectionOrId) {
    const section = typeof sectionOrId === "string"
        ? document.getElementById(sectionOrId || "")
        : sectionOrId;
    if (!section) return;
    const collapsed = isCollectorSectionCollapsed(section);
    section.classList.toggle("collector-section-collapsed", collapsed);
    section.classList.toggle("is-collapsed", collapsed);
    section.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const body = section.querySelector(".collector-panel-body");
    if (body) {
        body.hidden = collapsed;
    }
    const btn = section.querySelector('[data-action="toggle-section"]');
    if (btn) {
        if (section.id === "collector-section-sources") {
            btn.textContent = collapsed ? "展开列表" : "收起列表";
        } else {
            btn.textContent = collapsed ? "展开" : "收起";
        }
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
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
        const sourceData = await collectorRequest(`/collector-admin/sources?token=${encodeURIComponent(collectorToken())}`);
        try {
            const runData = await fetchCollectorRuns();
            updateCollectorLatestRuns(runData.data || []);
        } catch (runError) {
            collectorLatestRunsBySource.clear();
        }
        collectorAllSources = sourceData.data || [];
        updateCollectorItemSourceOptions();
        await loadCollectorSourceItemCounts(collectorAllSources);
        applyCollectorSourceFilters();
    } catch (error) {
        box.innerHTML = `<div class="empty">采集源加载失败：${collectorEscapeHtml(collectorErrorMessage(error))}</div>`;
    }
}

async function detectCollectorSource(button = null) {
    const configTextInput = document.getElementById("collectorSourceConfigText");
    const urlInput = document.getElementById("collectorUrl");
    const sourceTypeInput = document.getElementById("collectorType");
    const sourceType = sourceTypeInput ? sourceTypeInput.value : "";
    const configText = configTextInput ? configTextInput.value.trim() : "";
    const url = urlInput ? urlInput.value.trim() : "";
    const parsedConfig = parseCollectorSourceConfigText(configText || url);
    const buttonState = setCollectorButtonBusy(button, "识别中...");

    if (configText || parsedConfig.hasConfigSignal) {
        if (parsedConfig.isComplete) {
            fillCollectorSourceForm(parsedConfig);
            collectorSourceConfigStatus("已识别为采集源配置，并填入下方表单，请核对后保存。");
            collectorDetectMessage(configText ? "" : "已识别为采集源配置，并填入下方表单，请核对后保存。");
            restoreCollectorButton(button, buttonState);
            return;
        }
        collectorSourceConfigStatus("未识别到完整采集源配置，请检查名称、平台类型、数据源类型和数据地址。", true);
        if (!configText) {
            collectorDetectMessage("未识别到完整采集源配置，请检查名称、平台类型、数据源类型和数据地址。", true);
        }
        restoreCollectorButton(button, buttonState);
        return;
    }

    if (isAuthorizedSourceType(sourceType)) {
        collectorDetectMessage("授权数据源不需要公开 URL 智能识别。请确认数据地址和授权说明后直接新增。");
        restoreCollectorButton(button, buttonState);
        return;
    }

    if (!url) {
        collectorDetectMessage("请先填写需要识别的公开 URL。", true);
        restoreCollectorButton(button, buttonState);
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
    } finally {
        restoreCollectorButton(button, buttonState);
    }
}

function clearCollectorSourceConfigText() {
    const input = document.getElementById("collectorSourceConfigText");
    if (input) {
        input.value = "";
    }
    collectorSourceConfigStatus("");
}

function parseCollectorSourceConfigText(rawText) {
    const sourceFieldAliases = {
        "名称": "name",
        "来源名称": "name",
        "数据源名称": "name",
        "平台类型": "platform",
        "来源平台": "platform",
        "数据源类型": "sourceType",
        "采集类型": "sourceType",
        "数据地址": "url",
        "公开URL": "url",
        "URL": "url",
        "链接": "url",
        "授权说明": "notes",
        "来源说明": "notes",
        "更新频率": "interval",
        "状态": "enabled"
    };
    const config = {
        name: "",
        platform: "",
        sourceType: "",
        url: "",
        notes: "",
        enabled: "",
        interval: "",
        hasConfigSignal: false,
        isComplete: false
    };
    let currentField = "";

    String(rawText || "").split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^([^：:]{1,24})\s*[：:]\s*(.*)$/);
        if (match) {
            const label = normalizeCollectorConfigLabel(match[1]);
            const field = sourceFieldAliases[label] || "";
            if (field) {
                config.hasConfigSignal = true;
                currentField = field;
                config[field] = match[2].trim();
                return;
            }
        }
        if (currentField === "notes") {
            config.notes = [config.notes, trimmed].filter(Boolean).join("\n");
        }
    });

    config.name = cleanCollectorConfigValue(config.name);
    config.platform = normalizeCollectorConfigPlatform(config.platform);
    config.sourceType = normalizeCollectorConfigSourceType(config.sourceType);
    config.url = cleanCollectorConfigValue(config.url);
    config.notes = cleanCollectorConfigValue(config.notes);
    config.enabled = normalizeCollectorConfigEnabled(config.enabled);
    config.isComplete = Boolean(config.name && config.platform && config.sourceType && config.url);
    return config;
}

function normalizeCollectorConfigLabel(label) {
    return String(label || "").replace(/\s+/g, "").toUpperCase() === "URL"
        ? "URL"
        : String(label || "").replace(/\s+/g, "");
}

function cleanCollectorConfigValue(value) {
    return String(value || "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

function normalizeCollectorConfigPlatform(value) {
    const text = cleanCollectorConfigValue(value);
    const key = text.replace(/\s+/g, "").toLowerCase();
    const platformMap = [
        {tests: ["小红书授权数据", "小红书", "xhs", "xiaohongshu"], value: "小红书授权数据"},
        {tests: ["美团授权数据", "美团", "meituan"], value: "美团授权数据"},
        {tests: ["大众点评授权数据", "大众点评", "点评", "dianping"], value: "大众点评授权数据"},
        {tests: ["学校官网"], value: "学校官网"},
        {tests: ["政务公开"], value: "政务公开"},
        {tests: ["公众号公开页", "公众号"], value: "公众号公开页"},
        {tests: ["其他授权数据源", "授权数据源"], value: "其他授权数据源"},
        {tests: ["其他公开网页", "公开网页"], value: "其他公开网页"}
    ];
    const matched = platformMap.find(item => item.tests.some(test => key === test.toLowerCase() || key.includes(test.toLowerCase())));
    return matched ? matched.value : text;
}

function normalizeCollectorConfigSourceType(value) {
    const text = cleanCollectorConfigValue(value);
    const key = text.replace(/\s+/g, "").toLowerCase();
    if (!key) return "";
    if (key.includes("local_folder") || key.includes("本地目录")) return "local_folder";
    if (key.includes("data_package_url") || key.includes("授权数据包url") || key.includes("数据包url")) return "data_package_url";
    if (key.includes("authorized_api") || key.includes("授权api")) return "authorized_api";
    if (key.includes("data_provider") || key.includes("合法数据服务商") || key.includes("数据服务商")) return "data_provider";
    if (key.includes("rss") || key.includes("公开rss")) return "rss";
    if (key.includes("api") || key.includes("json")) return "api";
    if (key.includes("公开页面") || key.includes("html") || key.includes("网页")) return "public_html";
    if (key.includes("人工导入来源") || key.includes("人工导入")) return "public_html";
    return normalizeCollectorSourceType(text);
}

function normalizeCollectorConfigEnabled(value) {
    const key = cleanCollectorConfigValue(value).replace(/\s+/g, "").toLowerCase();
    if (!key) return "";
    if (["启用", "是", "true", "enabled", "on", "1"].includes(key)) return "true";
    if (["停用", "禁用", "否", "false", "disabled", "off", "0"].includes(key)) return "false";
    return "";
}

function fillCollectorSourceForm(parsedConfig) {
    if (!parsedConfig) return;
    setInputValue("collectorName", parsedConfig.name, true);
    setInputValue("collectorPlatform", parsedConfig.platform, true);
    setInputValue("collectorType", parsedConfig.sourceType, true);
    setInputValue("collectorUrl", parsedConfig.url, true);
    setInputValue("collectorNotes", parsedConfig.notes, true);
    setInputValue("collectorEnabled", parsedConfig.enabled || "true", true);
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
    if (["rss", "api", "public_html", "local_folder", "data_package_url", "authorized_api", "data_provider"].includes(value)) {
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

async function submitCollectorSource(button = null) {
    const name = document.getElementById("collectorName").value.trim();
    const platform = document.getElementById("collectorPlatform").value.trim();
    const sourceType = document.getElementById("collectorType").value;
    const url = document.getElementById("collectorUrl").value.trim();
    const keyword = document.getElementById("collectorKeyword").value.trim();
    const enabled = document.getElementById("collectorEnabled").value === "true";
    const notes = document.getElementById("collectorNotes").value.trim();

    if (!name || !url) {
        collectorMessage("请填写名称和数据地址。", true);
        return;
    }

    if (sourceType === "data_package_url" && !/^https?:\/\//i.test(url)) {
        collectorMessage("授权数据包 URL 必须是 http/https。", true);
        return;
    }

    if (isAuthorizedSourceType(sourceType) && !notes) {
        collectorMessage("请填写授权说明，说明该数据来自官方授权、商家授权导出或合法数据服务商。", true);
        return;
    }

    const buttonState = setCollectorButtonBusy(button, "新增中...");
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
    } finally {
        restoreCollectorButton(button, buttonState);
    }
}

async function runDailyAuthorizedSources(button = null) {
    const buttonState = setCollectorButtonBusy(button, "运行中...");
    collectorMessage("正在运行今日授权数据更新，请稍等...");
    try {
        const data = await collectorRequest("/collector-admin/run-daily-authorized", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const result = data.result || {};
        const errors = Array.isArray(result.errors) && result.errors.length
            ? `；错误：${result.errors.slice(0, 3).join("；")}`
            : "";
        collectorMessage(
            `授权数据更新完成：源 ${result.total_sources ?? 0} 个，成功 ${result.success ?? 0}，跳过 ${result.skipped ?? 0}，失败 ${result.failed ?? 0}，新增 ${result.new_items ?? 0} 条，重复/无效跳过 ${result.skipped_items ?? 0} 条${errors}`
        );
        expandCollectorSection("collector-section-items");
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`授权数据更新失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    } finally {
        restoreCollectorButton(button, buttonState);
    }
}

async function toggleCollectorSource(sourceId, enabled, button = null) {
    const buttonState = setCollectorButtonBusy(button, enabled ? "启用中..." : "停用中...");
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
    } finally {
        restoreCollectorButton(button, buttonState);
    }
}

async function runCollectorSource(sourceId, button = null) {
    const buttonState = setCollectorButtonBusy(button, "运行中...");
    collectorMessage("正在运行采集源，请稍等...");
    try {
        const data = await collectorRequest(`/collector-admin/sources/${sourceId}/run`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const run = data.result && data.result.run ? data.result.run : {};
        collectorMessage(`采集完成：状态 ${run.status || "-"}，新增 ${run.item_count ?? 0} 条。`);
        expandCollectorSourceDetail(sourceId);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
        scrollCollectorSourceSummaryIntoView(sourceId);
    } catch (error) {
        collectorMessage(`运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    } finally {
        restoreCollectorButton(button, buttonState);
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

async function runAllCollectorSources(button = null) {
    const buttonState = setCollectorButtonBusy(button, "运行中...");
    collectorMessage("正在运行全部公开 RSS/API/HTML 采集源，请稍等...");
    try {
        const data = await collectorRequest("/collector-admin/run-all", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: collectorToken()})
        });
        const result = data.result || {};
        collectorMessage(`公开源运行完成：源 ${result.total_sources ?? 0} 个，新增 ${result.item_count ?? 0} 条，失败 ${result.failed_count ?? 0} 个。授权数据源请使用“运行今日授权数据更新”。`);
        await Promise.all([loadCollectorSources(), loadCollectorItems(), loadCollectorRuns()]);
    } catch (error) {
        collectorMessage(`公开源运行失败：${collectorErrorMessage(error)}`, true);
        await loadCollectorRuns();
    } finally {
        restoreCollectorButton(button, buttonState);
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

    if (rawText) {
        const parsed = parseManualImportText(rawText);
        if (parsed.hasContent) {
            setManualPlatformValue(parsed.platform || (platformInput ? platformInput.value : "") || "公开文本");
            if (urlInput) urlInput.value = parsed.url || "";
            if (titleInput) titleInput.value = parsed.title || "";
            if (summaryInput) summaryInput.value = parsed.summary || "";
            if (notesInput) notesInput.value = parsed.sourceNote || "";
            collectorManualMessage("已识别并填入字段，请核对后导入。");
            return;
        }
        collectorManualMessage("未识别到明确字段，请手动填写标题或摘要。", true);
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
            setManualPlatformValue(data.platform);
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
    const importButton = document.querySelector('[data-action="manual-import"]');
    const platform = cleanManualImportText(document.getElementById("manualPlatform").value) || "公开文本";
    const title = cleanManualImportText(document.getElementById("manualTitle").value);
    const rawUrl = cleanManualImportText(document.getElementById("manualUrl").value);
    const summary = cleanManualImportText(document.getElementById("manualSummary").value);
    const notes = cleanManualImportText(document.getElementById("manualNotes").value);
    const urlCheck = normalizeManualImportUrl(rawUrl);

    if (!title && !summary) {
        collectorManualMessage("人工导入失败：标题和摘要至少填写一个", true);
        return;
    }

    if (!urlCheck.ok) {
        collectorManualMessage(urlCheck.message, true);
        return;
    }

    const originalText = importButton ? importButton.textContent : "";
    if (importButton) {
        importButton.disabled = true;
        importButton.textContent = "导入中...";
    }
    collectorManualMessage("导入中...");

    try {
        const data = await collectorRequest("/collector-admin/items/manual", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token: collectorToken(),
                platform,
                title,
                url: urlCheck.url,
                summary,
                notes,
                source_note: notes
            })
        });
        collectorManualMessage(data.message || "已导入采集条目，等待审核");
        clearManualCollectorForm(false);
        expandCollectorSection("collector-section-items");
        await loadCollectorItems();
    } catch (error) {
        collectorManualMessage(`人工导入失败：${collectorErrorMessage(error)}`, true);
    } finally {
        if (importButton) {
            importButton.disabled = false;
            importButton.textContent = originalText || "导入采集条目";
        }
    }
}

function clearManualCollectorForm(showMessage = true) {
    setManualPlatformValue("公开文本");
    ["manualTitle", "manualUrl", "manualSummary", "manualNotes", "manualRawText"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    if (showMessage) {
        collectorManualMessage("已清空人工导入表单");
    }
}

function setManualPlatformValue(value) {
    const input = document.getElementById("manualPlatform");
    if (!input) return;
    const normalized = cleanManualImportText(value) || "公开文本";
    const option = Array.from(input.options || []).find(item => item.value === normalized);
    input.value = option ? normalized : "其他公开网页";
}

function cleanManualImportText(value) {
    let text = String(value || "").replace(/\s+/g, " ").trim();
    for (let index = 0; index < 8; index += 1) {
        const before = text;
        text = text
            .replace(/^\s*(?:来源平台)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|nan|n\/a|-)?\s*/i, "")
            .replace(/^\s*(?:URL|链接|来源链接|公开 URL)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|nan|n\/a|-)?\s*/i, "")
            .replace(/^\s*(?:粘贴公开文本|公开文本|摘要|正文|文本|内容)\s*[：:]\s*/i, "")
            .replace(/^\s*(?:留空|无|暂无|null|undefined|none|nan|n\/a|-)\s+/i, "")
            .trim();
        if (text === before) break;
    }
    return text;
}

function isMeaningfulManualValue(value) {
    const text = cleanManualImportText(value);
    const lowered = text.toLowerCase();
    if (["", "留空", "无", "暂无", "null", "undefined", "none", "nan", "n/a", "-"].includes(lowered)) {
        return false;
    }
    return !/^\d{1,3}$/.test(text);
}

function normalizeManualImportUrl(value) {
    const text = cleanManualImportText(value);
    if (!isMeaningfulManualValue(text)) {
        return {ok: true, url: ""};
    }

    try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
            url.hash = "";
            return {ok: true, url: url.toString()};
        }
    } catch (error) {
        // fall through to the shared validation message
    }

    return {
        ok: false,
        url: "",
        message: "人工导入失败：公开 URL 必须是 http/https 链接，或留空"
    };
}

function parseManualImportText(rawText) {
    const fields = {
        platform: "",
        url: "",
        title: "",
        summary: "",
        sourceNote: ""
    };
    const fieldAliases = {
        "来源平台": "platform",
        "平台": "platform",
        "公开 URL": "url",
        "公开URL": "url",
        "URL": "url",
        "链接": "url",
        "标题": "title",
        "摘要": "summary",
        "正文": "summary",
        "内容": "summary",
        "来源说明": "sourceNote",
        "说明": "sourceNote",
        "备注": "sourceNote"
    };
    const fieldPattern = /^(来源平台|平台|公开\s*URL|URL|链接|标题|摘要|正文|内容|来源说明|说明|备注)\s*[：:]\s*(.*)$/i;
    const lines = String(rawText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    let currentField = "";
    let foundField = false;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const match = trimmed.match(fieldPattern);
        if (match) {
            const normalizedLabel = match[1].replace(/\s+/g, "").toUpperCase() === "URL"
                ? "URL"
                : match[1].replace(/\s+/g, " ");
            currentField = fieldAliases[normalizedLabel] || fieldAliases[match[1].replace(/\s+/g, "")] || "";
            foundField = Boolean(currentField);
            if (currentField) {
                appendManualParsedField(fields, currentField, match[2] || "");
            }
            return;
        }

        if (currentField) {
            appendManualParsedField(fields, currentField, trimmed);
        }
    });

    if (!foundField) {
        const text = cleanManualImportText(rawText);
        if (!isMeaningfulManualValue(text)) {
            return {...fields, hasContent: false};
        }
        return {
            platform: "",
            url: "",
            title: titleFromManualFreeText(text),
            summary: text,
            sourceNote: "",
            hasContent: true
        };
    }

    fields.platform = isMeaningfulManualValue(fields.platform) ? cleanManualImportText(fields.platform) : "公开文本";
    const urlCheck = normalizeManualImportUrl(fields.url);
    fields.url = urlCheck.ok ? urlCheck.url : "";
    fields.title = isMeaningfulManualValue(fields.title) ? cleanManualImportText(fields.title) : "";
    fields.summary = isMeaningfulManualValue(fields.summary) ? cleanManualImportText(fields.summary) : "";
    fields.sourceNote = isMeaningfulManualValue(fields.sourceNote) ? cleanManualImportText(fields.sourceNote) : "";

    if (!fields.title && fields.summary) {
        fields.title = titleFromManualFreeText(fields.summary);
    }

    return {
        ...fields,
        hasContent: Boolean(fields.title || fields.summary || fields.url || fields.sourceNote)
    };
}

function appendManualParsedField(fields, field, value) {
    const text = String(value || "").trim();
    if (!text) return;
    fields[field] = fields[field] ? `${fields[field]}\n${text}` : text;
}

function titleFromManualFreeText(text) {
    const cleaned = cleanManualImportText(text);
    if (!isMeaningfulManualValue(cleaned)) return "";
    const firstSentence = cleaned.split(/[。！？!?]/)[0].trim();
    const candidate = firstSentence || cleaned;
    return candidate.length > 30 ? candidate.slice(0, 30) : candidate;
}

async function loadCollectorSourceItemCounts(sources) {
    collectorSourceItemCounts.clear();
    collectorSourceDiagnosticsReady = false;
    collectorSourceDiagnosticsPartialFailure = false;
    renderCollectorHealthSummary([], true);

    const validSources = (sources || []).filter(source => Number(source.id || 0) > 0);
    if (!validSources.length) {
        collectorSourceDiagnosticsReady = true;
        renderCollectorHealthSummary([]);
        return;
    }

    await Promise.all(validSources.map(async source => {
        const sourceId = Number(source.id || 0);
        const query = new URLSearchParams({
            token: collectorToken(),
            source_id: String(sourceId),
            limit: "1",
            offset: "0"
        });
        try {
            const result = await collectorRequest(`/collector-admin/items?${query.toString()}`);
            collectorSourceItemCounts.set(sourceId, Number(result.total || 0));
        } catch (error) {
            collectorSourceDiagnosticsPartialFailure = true;
            collectorSourceItemCounts.set(sourceId, null);
        }
    }));

    collectorSourceDiagnosticsReady = true;
}

function normalizeCollectorDiagnosticValue(value) {
    return String(value || "").trim().toLowerCase();
}

function collectorSourceDuplicateMaps(sources = collectorAllSources) {
    const maps = {
        name: new Map(),
        url: new Map(),
        platformUrl: new Map()
    };
    (sources || []).forEach(source => {
        const name = normalizeCollectorDiagnosticValue(source.name);
        const url = normalizeCollectorDiagnosticValue(source.url);
        const platform = normalizeCollectorDiagnosticValue(source.platform);
        const platformUrl = `${platform}||${url}`;
        if (name) maps.name.set(name, (maps.name.get(name) || 0) + 1);
        if (url) maps.url.set(url, (maps.url.get(url) || 0) + 1);
        if (platform && url) maps.platformUrl.set(platformUrl, (maps.platformUrl.get(platformUrl) || 0) + 1);
    });
    return maps;
}

function collectorSourceItemCount(source) {
    const sourceId = Number(source && source.id ? source.id : 0);
    if (!sourceId || !collectorSourceItemCounts.has(sourceId)) return null;
    return collectorSourceItemCounts.get(sourceId);
}

function collectorSourceLooksLikeTest(source) {
    const combined = [
        source.name,
        source.platform,
        source.url,
        source.notes
    ].map(value => String(value || "")).join(" ").toLowerCase();
    return /测试|test|jsonplaceholder|not-exist|example/.test(combined);
}

function collectorSourceDiagnosticInfo(source, duplicateMaps = collectorSourceDuplicateMaps()) {
    const sourceId = Number(source && source.id ? source.id : 0);
    const itemCount = collectorSourceItemCount(source);
    const hasKnownItemCount = itemCount !== null;
    const latestRun = collectorLatestRunsBySource.get(sourceId);
    const latestStatus = latestRun ? String(latestRun.status || "").trim() : "none";
    const nameKey = normalizeCollectorDiagnosticValue(source.name);
    const urlKey = normalizeCollectorDiagnosticValue(source.url);
    const platformUrlKey = `${normalizeCollectorDiagnosticValue(source.platform)}||${urlKey}`;
    const duplicateName = nameKey && (duplicateMaps.name.get(nameKey) || 0) > 1;
    const duplicateUrl = urlKey && (duplicateMaps.url.get(urlKey) || 0) > 1;
    const duplicatePlatformUrl = normalizeCollectorDiagnosticValue(source.platform) && urlKey &&
        (duplicateMaps.platformUrl.get(platformUrlKey) || 0) > 1;
    const authorizedSource = isAuthorizedSourceType(source.source_type);
    const enabledNoItems = Boolean(source.enabled) && hasKnownItemCount && itemCount === 0 && !authorizedSource;
    const failed = latestStatus === "failed";
    const suspectTest = collectorSourceLooksLikeTest(source);
    const hasHistoricalItems = hasKnownItemCount && itemCount > 0;

    return {
        itemCount,
        hasKnownItemCount,
        latestRun,
        latestStatus,
        duplicateName,
        duplicateUrl,
        duplicatePlatformUrl,
        enabledNoItems,
        failed,
        suspectTest,
        hasHistoricalItems,
        problem: failed || enabledNoItems || duplicateName || duplicateUrl || duplicatePlatformUrl || suspectTest ||
            (Boolean(source.enabled) && latestStatus === "none" && !authorizedSource)
    };
}

function collectorSourceDiagnosticLabels(source, duplicateMaps = collectorSourceDuplicateMaps()) {
    const info = collectorSourceDiagnosticInfo(source, duplicateMaps);
    const labels = [];
    if (info.duplicateName) labels.push({text: "重复名称", level: "warning"});
    if (info.duplicateUrl) labels.push({text: "重复 URL", level: "warning"});
    if (info.duplicatePlatformUrl) labels.push({text: "platform+url 重复", level: "warning"});
    if (info.enabledNoItems) labels.push({text: "启用但无条目", level: "risk"});
    if (info.failed) labels.push({text: "最近失败", level: "danger"});
    if (info.suspectTest) labels.push({text: "疑似测试源", level: "risk"});
    if (info.hasHistoricalItems) labels.push({text: `有历史条目 ${info.itemCount} 条`, level: "safe"});
    return labels;
}

function collectorSourceGovernanceTips(source, duplicateMaps = collectorSourceDuplicateMaps()) {
    const info = collectorSourceDiagnosticInfo(source, duplicateMaps);
    const tips = [];
    if (info.hasHistoricalItems) {
        tips.push("该源已有历史采集条目，建议保留来源解释；如不再使用，可仅停用，不建议删除。");
    }
    if (info.enabledNoItems && (info.duplicateName || info.duplicateUrl || info.duplicatePlatformUrl)) {
        tips.push("该源启用但暂无条目，可先查看运行日志和采集条目，再考虑手动停用。");
    }
    if (info.suspectTest) {
        tips.push("疑似测试源，请人工确认后再停用。");
    }
    if (info.failed) {
        tips.push("最近运行失败，请先查看该源日志。");
    }
    return tips;
}

function renderCollectorSourceDiagnosticLabels(source, duplicateMaps = collectorSourceDuplicateMaps()) {
    const labels = collectorSourceDiagnosticLabels(source, duplicateMaps);
    if (!labels.length) return "";
    return `
        <div class="collector-diagnostic-tags">
            ${labels.map(label => `<span class="collector-diagnostic-tag collector-diagnostic-${collectorEscapeAttribute(label.level)}">${collectorEscapeHtml(label.text)}</span>`).join("")}
        </div>
    `;
}

function renderCollectorSourceGovernanceTips(source, duplicateMaps = collectorSourceDuplicateMaps()) {
    const tips = collectorSourceGovernanceTips(source, duplicateMaps);
    if (!tips.length) return "";
    return `
        <div class="collector-governance-tips">
            ${tips.map(tip => `<div class="collector-governance-tip">${collectorEscapeHtml(tip)}</div>`).join("")}
        </div>
    `;
}

function collectorHealthStats(sources = collectorAllSources) {
    const duplicateMaps = collectorSourceDuplicateMaps(sources);
    const stats = {
        total: (sources || []).length,
        enabled: 0,
        disabled: 0,
        withItems: 0,
        enabledNoItems: 0,
        failed: 0,
        duplicateSuspect: 0,
        suspectTest: 0
    };

    (sources || []).forEach(source => {
        const info = collectorSourceDiagnosticInfo(source, duplicateMaps);
        if (source.enabled) stats.enabled += 1;
        else stats.disabled += 1;
        if (info.hasHistoricalItems) stats.withItems += 1;
        if (info.enabledNoItems) stats.enabledNoItems += 1;
        if (info.failed) stats.failed += 1;
        if (info.duplicateName || info.duplicateUrl || info.duplicatePlatformUrl) stats.duplicateSuspect += 1;
        if (info.suspectTest) stats.suspectTest += 1;
    });

    return stats;
}

function renderCollectorHealthSummary(sources = collectorAllSources, loading = false) {
    const box = document.getElementById("collectorSourceHealthSummary");
    if (!box) return;

    if (loading) {
        box.innerHTML = `<div class="collector-health-loading">正在加载采集源健康诊断...</div>`;
        return;
    }

    const stats = collectorHealthStats(sources);
    const warning = collectorSourceDiagnosticsPartialFailure
        ? `<div class="collector-health-warning">诊断数据部分加载失败，部分源的条目数量可能暂不可用。</div>`
        : "";
    box.innerHTML = `
        <div class="collector-health-grid">
            <div><strong>${stats.total}</strong><span>采集源总数</span></div>
            <div><strong>${stats.enabled}</strong><span>启用源</span></div>
            <div><strong>${stats.disabled}</strong><span>停用源</span></div>
            <div><strong>${stats.withItems}</strong><span>有条目的源</span></div>
            <div><strong>${stats.enabledNoItems}</strong><span>启用但无条目</span></div>
            <div><strong>${stats.failed}</strong><span>最近失败源</span></div>
            <div><strong>${stats.duplicateSuspect}</strong><span>疑似重复源</span></div>
            <div><strong>${stats.suspectTest}</strong><span>疑似测试源</span></div>
        </div>
        ${warning}
        <div class="collector-health-note">健康诊断仅做管理员提示，不会自动停用、删除、合并或迁移任何采集源。</div>
    `;
}

function getCollectorSourceFilterState() {
    return {
        keyword: (document.getElementById("collectorSourceKeyword")?.value || "").trim().toLowerCase(),
        enabled: document.getElementById("collectorSourceEnabledFilter")?.value || "all",
        runStatus: document.getElementById("collectorSourceRunFilter")?.value || "all",
        sourceType: document.getElementById("collectorSourceTypeFilter")?.value || "all",
        problemOnly: collectorProblemSourceFilterActive
    };
}

function collectorSourceMatchesKeyword(source, keyword) {
    if (!keyword) return true;
    const combined = [
        source.name,
        source.platform,
        source.url,
        source.notes,
        source.keyword,
        source.source_type
    ].map(value => String(value || "").toLowerCase()).join(" ");
    return combined.includes(keyword);
}

function collectorSourceMatchesEnabled(source, enabledFilter) {
    if (!enabledFilter || enabledFilter === "all") return true;
    if (enabledFilter === "enabled") return Boolean(source.enabled);
    if (enabledFilter === "disabled") return !source.enabled;
    return true;
}

function collectorSourceMatchesType(source, typeFilter) {
    if (!typeFilter || typeFilter === "all") return true;
    const sourceType = String(source.source_type || "").trim();
    if (typeFilter === "api") return sourceType === "api" || sourceType === "json_api";
    return sourceType === typeFilter;
}

function collectorSourceLatestRunStatus(source) {
    const latestRun = collectorLatestRunsBySource.get(Number(source.id || 0));
    return latestRun ? String(latestRun.status || "unknown").trim() || "unknown" : "none";
}

function collectorSourceMatchesRunStatus(source, runStatusFilter) {
    if (!runStatusFilter || runStatusFilter === "all") return true;
    return collectorSourceLatestRunStatus(source) === runStatusFilter;
}

function collectorSourceIsProblem(source) {
    return collectorSourceDiagnosticInfo(source).problem;
}

function applyCollectorSourceFilters() {
    const state = getCollectorSourceFilterState();
    const filteredSources = collectorAllSources.filter(source => (
        collectorSourceMatchesKeyword(source, state.keyword) &&
        collectorSourceMatchesEnabled(source, state.enabled) &&
        collectorSourceMatchesType(source, state.sourceType) &&
        collectorSourceMatchesRunStatus(source, state.runStatus) &&
        (!state.problemOnly || collectorSourceIsProblem(source))
    ));
    renderCollectorSources(filteredSources, collectorAllSources.length, state);
}

function clearCollectorSourceFilters() {
    const keywordInput = document.getElementById("collectorSourceKeyword");
    const enabledInput = document.getElementById("collectorSourceEnabledFilter");
    const runInput = document.getElementById("collectorSourceRunFilter");
    const typeInput = document.getElementById("collectorSourceTypeFilter");
    if (keywordInput) keywordInput.value = "";
    if (enabledInput) enabledInput.value = "all";
    if (runInput) runInput.value = "all";
    if (typeInput) typeInput.value = "all";
    collectorProblemSourceFilterActive = false;
    applyCollectorSourceFilters();
}

function showCollectorProblemSources() {
    collectorProblemSourceFilterActive = true;
    applyCollectorSourceFilters();
}

function renderCollectorSourceFilterSummary(shownCount, totalCount, state) {
    const box = document.getElementById("collectorSourceFilterSummary");
    if (!box) return;
    const activeParts = [];
    if (state.keyword) activeParts.push(`搜索“${state.keyword}”`);
    if (state.enabled !== "all") activeParts.push(state.enabled === "enabled" ? "启用中" : "已停用");
    if (state.runStatus !== "all") activeParts.push({
        success: "最近成功",
        failed: "最近失败",
        none: "暂无运行记录",
        skipped: "已跳过"
    }[state.runStatus] || state.runStatus);
    if (state.sourceType !== "all") activeParts.push(state.sourceType === "api" ? "json_api / api" : state.sourceType);
    if (state.problemOnly) activeParts.push("只看异常源");
    box.textContent = `显示 ${shownCount} / 共 ${totalCount} 个${activeParts.length ? `；当前筛选：${activeParts.join("、")}` : ""}`;
}

function renderCollectorSources(sources, totalCount = sources.length, filterState = getCollectorSourceFilterState()) {
    const box = document.getElementById("collectorSourceList");
    if (!box) return;
    updateCollectorSourceTitle(sources.length, totalCount);
    renderCollectorHealthSummary(collectorAllSources);
    renderCollectorSourceFilterSummary(sources.length, totalCount, filterState);
    const duplicateMaps = collectorSourceDuplicateMaps(collectorAllSources);
    const problemButton = document.querySelector('[data-action="problem-sources"]');
    if (problemButton) {
        problemButton.classList.toggle("collector-filter-active", Boolean(filterState.problemOnly));
    }

    if (!sources.length) {
        box.innerHTML = `
            <div class="empty collector-source-empty">
                没有符合筛选条件的采集源。
                <button type="button" class="small-button btn-secondary" data-action="clear-source-filters">清除筛选查看全部</button>
            </div>
        `;
        return;
    }

    box.innerHTML = sources.map(source => `
        <div class="target-item collector-source-item ${collectorExpandedSources.has(Number(source.id)) ? "collector-source-expanded" : ""}" id="collector-source-${collectorEscapeAttribute(source.id)}">
            <div class="collector-source-summary">
                <div class="collector-source-main">
                    <span class="tag">${collectorEscapeHtml(collectorSourceTypeLabel(source.source_type))}</span>
                    <span class="tag ${source.enabled ? "" : "danger-tag"}">${source.enabled ? "启用中" : "已停用"}</span>
                    <strong>${collectorEscapeHtml(source.name || "未命名采集源")}</strong>
                    <span class="collector-source-platform">${collectorEscapeHtml(source.platform || "未填写平台")}</span>
                    <span class="collector-source-url">${collectorEscapeHtml(shortCollectorUrl(source.url || ""))}</span>
                    ${renderCollectorSourceRunBadge(source)}
                    ${renderCollectorSourceDiagnosticLabels(source, duplicateMaps)}
                </div>
                <div class="collector-source-actions">
                    <button type="button" class="small-button" data-action="toggle-source-detail" data-source-id="${collectorEscapeAttribute(source.id)}">${collectorExpandedSources.has(Number(source.id)) ? "收起" : "展开"}</button>
                    <button type="button" class="small-button btn-secondary collector-preview-btn" data-action="preview" data-source-id="${collectorEscapeAttribute(source.id)}">预览</button>
                    <button class="small-button verify-button" onclick="runCollectorSource(${source.id}, this)">运行单个源</button>
                    <button class="small-button" onclick="toggleCollectorSource(${source.id}, ${source.enabled ? "false" : "true"}, this)">${source.enabled ? "停用" : "启用"}</button>
                </div>
            </div>
            <div class="collector-source-details" ${collectorExpandedSources.has(Number(source.id)) ? "" : "hidden"}>
                <div>关键词：${collectorEscapeHtml(source.keyword || "空关键词：不过滤公开结果")}</div>
                <div>备注：${collectorEscapeHtml(source.notes || "暂无备注")}</div>
                ${renderCollectorSourceRunSummary(source)}
                ${renderCollectorSourceGovernanceTips(source, duplicateMaps)}
                <div class="target-url">完整 URL：${collectorEscapeHtml(source.url || "")}</div>
                <div class="collector-inline-preview" id="collector-preview-inline-${collectorEscapeAttribute(source.id)}"></div>
                <div class="collector-source-collapse-row">
                    <button type="button" class="small-button btn-secondary" data-action="view-source-items" data-source-id="${collectorEscapeAttribute(source.id)}" data-source-name="${collectorEscapeAttribute(source.name || "未命名采集源")}">查看该源采集条目</button>
                    <button type="button" class="small-button btn-secondary" data-action="view-source-runs" data-source-id="${collectorEscapeAttribute(source.id)}" data-source-name="${collectorEscapeAttribute(source.name || "未命名采集源")}">查看该源日志</button>
                    <button type="button" class="small-button" data-action="collapse-source-detail" data-source-id="${collectorEscapeAttribute(source.id)}">收起该源</button>
                </div>
            </div>
        </div>
    `).join("");
}

function renderCollectorSourceRunSummary(source) {
    const sourceId = Number(source && source.id ? source.id : 0);
    const latestRun = collectorLatestRunsBySource.get(sourceId);
    if (!latestRun) {
        return `
            <div class="collector-run-summary collector-run-summary-none">
                <span class="collector-run-status collector-run-status-none">暂无运行记录</span>
                <span>最近运行：暂无记录</span>
            </div>
        `;
    }

    const status = String(latestRun.status || "unknown").trim() || "unknown";
    const statusLabel = collectorRunStatusLabel(status);
    const statusClass = collectorRunStatusClass(status);
    const itemCount = latestRun.item_count ?? 0;
    const finishedAt = latestRun.finished_at || latestRun.started_at || source.last_run_at || "-";
    const errorText = compactCollectorRunError(latestRun.error_message || "");

    return `
        <div class="collector-run-summary collector-run-summary-${collectorEscapeAttribute(statusClass)}">
            <span class="collector-run-status collector-run-status-${collectorEscapeAttribute(statusClass)}">${collectorEscapeHtml(statusLabel)}</span>
            <span>新增 ${collectorEscapeHtml(String(itemCount))} 条</span>
            <span>结束时间 ${collectorEscapeHtml(finishedAt)}</span>
            ${errorText ? `<span class="collector-run-error">错误原因：${collectorEscapeHtml(errorText)}</span>` : ""}
        </div>
    `;
}

function renderCollectorSourceRunBadge(source) {
    const sourceId = Number(source && source.id ? source.id : 0);
    const latestRun = collectorLatestRunsBySource.get(sourceId);
    if (!latestRun) {
        return `<span class="collector-run-status collector-run-status-none">暂无运行记录</span>`;
    }
    const status = String(latestRun.status || "unknown").trim() || "unknown";
    const statusLabel = status === "success"
        ? `成功 / 新增 ${latestRun.item_count ?? 0}`
        : status === "failed"
            ? "失败"
            : collectorRunStatusLabel(status).replace("最近运行：", "");
    return `<span class="collector-run-status collector-run-status-${collectorEscapeAttribute(collectorRunStatusClass(status))}">${collectorEscapeHtml(statusLabel)}</span>`;
}

function collectorRunStatusLabel(status) {
    if (status === "success") return "最近运行：成功";
    if (status === "failed") return "最近运行：失败";
    if (status === "skipped") return "最近运行：已跳过";
    return `最近运行：${status || "未知"}`;
}

function collectorRunStatusClass(status) {
    if (status === "success") return "success";
    if (status === "failed") return "failed";
    if (status === "skipped") return "skipped";
    return "unknown";
}

function compactCollectorRunError(errorMessage) {
    const value = String(errorMessage || "").replace(/\s+/g, " ").trim();
    if (value.length <= 90) return value;
    return `${value.slice(0, 90)}...`;
}

function updateCollectorSourceTitle(count, totalCount = count) {
    const title = document.getElementById("collectorSourceTitle");
    if (title) {
        title.textContent = count === totalCount
            ? `采集源列表（共 ${totalCount} 个）`
            : `采集源列表（显示 ${count} / 共 ${totalCount} 个）`;
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

function updateCollectorItemSourceOptions() {
    const sourceInput = document.getElementById("collectorItemSource");
    if (!sourceInput) return;
    const currentValue = sourceInput.value || "";
    const options = ['<option value="">全部来源</option>'];
    collectorAllSources.forEach(source => {
        const sourceId = Number(source.id || 0);
        if (!sourceId) return;
        const sourceName = source.name || `采集源 #${sourceId}`;
        options.push(`<option value="${collectorEscapeAttribute(sourceId)}">${collectorEscapeHtml(sourceName)}（ID: ${collectorEscapeHtml(sourceId)}）</option>`);
    });
    sourceInput.innerHTML = options.join("");
    sourceInput.value = currentValue;
}

function getCollectorItemFilterState() {
    const keywordInput = document.getElementById("collectorItemKeyword");
    const statusInput = document.getElementById("collectorItemStatus");
    const platformInput = document.getElementById("collectorItemPlatform");
    const sourceInput = document.getElementById("collectorItemSource");
    return {
        keyword: keywordInput ? keywordInput.value.trim() : "",
        status: statusInput ? statusInput.value : "",
        platform: platformInput ? platformInput.value.trim() : "",
        sourceId: sourceInput ? sourceInput.value : "",
        sourceName: sourceInput && sourceInput.selectedOptions.length
            ? sourceInput.selectedOptions[0].textContent.replace(/（ID: \d+）$/, "")
            : ""
    };
}

function renderCollectorItemFilterSummary(state = getCollectorItemFilterState()) {
    const box = document.getElementById("collectorItemFilterSummary");
    if (!box) return;
    const parts = [];
    if (state.keyword) parts.push(`关键词 ${state.keyword}`);
    if (state.status) parts.push(`状态 ${state.status}`);
    if (state.platform) parts.push(`平台 ${state.platform}`);
    if (state.sourceId) parts.push(`来源 ${state.sourceName || `采集源 ID ${state.sourceId}`}`);
    if (!parts.length) {
        box.textContent = "当前显示全部采集条目";
        return;
    }
    const prefix = collectorViewingSourceName && state.sourceId
        ? `正在查看：${collectorViewingSourceName} 的采集条目；`
        : "";
    box.textContent = `${prefix}当前筛选：${parts.join(" / ")}`;
}

function clearCollectorItemFilters() {
    ["collectorItemKeyword", "collectorItemStatus", "collectorItemPlatform", "collectorItemSource"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    collectorViewingSourceName = "";
    loadCollectorItems();
}

async function viewCollectorItemsForSource(sourceId, sourceName = "") {
    const normalizedSourceId = Number(sourceId || 0);
    const resolvedSourceName = sourceName || `采集源 #${normalizedSourceId}`;
    ["collectorItemKeyword", "collectorItemStatus", "collectorItemPlatform"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    const sourceInput = document.getElementById("collectorItemSource");
    if (sourceInput) {
        updateCollectorItemSourceOptions();
        sourceInput.value = String(normalizedSourceId);
    }
    collectorViewingSourceName = resolvedSourceName;
    expandCollectorSection("collector-section-items");
    await loadCollectorItems();
    scrollCollectorSectionHeaderIntoView("collector-section-items");
}

function renderCollectorItemSource(item) {
    if (item.source_name) {
        return `来源：${collectorEscapeHtml(item.source_name)}（ID: ${collectorEscapeHtml(item.source_id)}）`;
    }
    if (item.source_id) {
        return `来源：采集源 ID ${collectorEscapeHtml(item.source_id)}`;
    }
    return "来源：人工导入 / 无采集源";
}

async function loadCollectorItems() {
    const box = document.getElementById("collectorItemList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载采集条目...</div>`;

    const filterState = getCollectorItemFilterState();
    renderCollectorItemFilterSummary(filterState);
    const query = new URLSearchParams({
        token: collectorToken(),
        limit: "50",
        offset: "0"
    });
    if (filterState.keyword) query.set("keyword", filterState.keyword);
    if (filterState.status) query.set("status", filterState.status);
    if (filterState.platform) query.set("platform", filterState.platform);
    if (filterState.sourceId) query.set("source_id", filterState.sourceId);

    try {
        const data = await collectorRequest(`/collector-admin/items?${query.toString()}`);
        updateCollectorItemTitle(data.total ?? (data.data || []).length);
        renderCollectorItems(data.data || []);
        renderCollectorItemFilterSummary(filterState);
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
    } finally {
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
    } finally {
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
        const filterState = getCollectorItemFilterState();
        const emptyText = filterState.sourceId
            ? `该采集源暂无采集条目。请确认该源是否已成功运行并写入条目；同名采集源的历史条目不会合并显示。`
            : "暂无采集条目。";
        box.innerHTML = `<div class="empty">${collectorEscapeHtml(emptyText)}</div>`;
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
            <div class="notice collector-item-source">${renderCollectorItemSource(item)} · 发布时间：${collectorEscapeHtml(item.published_at || "-")} · 抓取时间：${collectorEscapeHtml(item.fetched_at || "-")}</div>
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

async function fetchCollectorRuns(sourceId = null) {
    const query = new URLSearchParams({
        token: collectorToken(),
        limit: "50",
        offset: "0"
    });
    if (sourceId) {
        query.set("source_id", String(sourceId));
    }
    return collectorRequest(`/collector-admin/runs?${query.toString()}`);
}

function updateCollectorLatestRuns(runs) {
    collectorLatestRunsBySource.clear();
    (runs || []).forEach(run => {
        const sourceId = Number(run.source_id || 0);
        if (!sourceId || collectorLatestRunsBySource.has(sourceId)) return;
        collectorLatestRunsBySource.set(sourceId, run);
    });
}

async function viewCollectorRunsForSource(sourceId, sourceName = "") {
    collectorCurrentRunFilter = {
        sourceId: Number(sourceId),
        sourceName: sourceName || `采集源 #${sourceId}`
    };
    expandCollectorSection("collector-section-runs");
    await loadCollectorRuns(collectorCurrentRunFilter.sourceId, collectorCurrentRunFilter.sourceName);
    scrollCollectorSectionHeaderIntoView("collector-section-runs");
}

async function loadCollectorRuns(sourceId = null, sourceName = "") {
    const box = document.getElementById("collectorRunList");
    if (!box) return;
    box.innerHTML = `<div class="empty">正在加载运行日志...</div>`;

    try {
        const data = await fetchCollectorRuns(sourceId);
        if (!sourceId) {
            collectorCurrentRunFilter = null;
            updateCollectorLatestRuns(data.data || []);
        }
        updateCollectorRunTitle((data.data || []).length);
        renderCollectorRuns(data.data || [], sourceId ? {sourceId, sourceName} : null);
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

function renderCollectorRuns(runs, filter = null) {
    const box = document.getElementById("collectorRunList");
    if (!box) return;
    const filterHeader = filter ? `
        <div class="collector-run-filter-note">
            <span>正在查看：${collectorEscapeHtml(filter.sourceName || `采集源 #${filter.sourceId}`)} 的运行日志</span>
            <button type="button" class="small-button btn-secondary" data-action="view-all-runs">查看全部运行日志</button>
        </div>
    ` : "";

    if (!runs.length) {
        box.innerHTML = `${filterHeader}<div class="empty">暂无运行日志。</div>`;
        return;
    }

    box.innerHTML = `
        ${filterHeader}
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
