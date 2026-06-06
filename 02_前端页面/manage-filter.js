// manage-filter.js
// 作用：给数据管理中心增加筛选功能：全部 / 正常 / 已归档
// 它会覆盖 manage.js 里的 loadManageData / loadManageVerifiedItems / loadManageClues

const MANAGE_FILTERS = {
    all: "全部数据",
    normal: "正常数据",
    archived: "已归档数据"
};

let manageFilter = "all";

function injectManageFilterBar() {
    const container = document.querySelector(".container");

    if (!container) {
        return;
    }

    if (document.getElementById("manageFilterBox")) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "manageFilterBox";

    box.innerHTML = `
        <h2>数据筛选</h2>
        <p class="notice">
            数据管理中心会显示全部数据，包括首页默认隐藏的“已归档”内容。你可以在这里切换查看范围。
        </p>
        <button id="manageFilterAll" class="small-button filter-button active" onclick="setManageFilter('all')">全部数据</button>
        <button id="manageFilterNormal" class="small-button filter-button" onclick="setManageFilter('normal')">正常数据</button>
        <button id="manageFilterArchived" class="small-button filter-button" onclick="setManageFilter('archived')">已归档数据</button>
        <div id="manageFilterNotice" class="empty">当前筛选：全部数据</div>
    `;

    const firstBox = container.querySelector(".box");

    if (firstBox) {
        firstBox.insertAdjacentElement("afterend", box);
    } else {
        container.prepend(box);
    }
}

function setManageFilter(filter) {
    manageFilter = filter;
    updateManageFilterButtons();
    loadManageData();
}

function updateManageFilterButtons() {
    const allBtn = document.getElementById("manageFilterAll");
    const normalBtn = document.getElementById("manageFilterNormal");
    const archivedBtn = document.getElementById("manageFilterArchived");
    const notice = document.getElementById("manageFilterNotice");

    if (!allBtn || !normalBtn || !archivedBtn || !notice) {
        return;
    }

    allBtn.classList.remove("active");
    normalBtn.classList.remove("active");
    archivedBtn.classList.remove("active");

    if (manageFilter === "all") {
        allBtn.classList.add("active");
    } else if (manageFilter === "normal") {
        normalBtn.classList.add("active");
    } else if (manageFilter === "archived") {
        archivedBtn.classList.add("active");
    }

    notice.innerText = "当前筛选：" + MANAGE_FILTERS[manageFilter];
}

function isManageArchivedClue(clue) {
    return clue && clue.status === "已归档";
}

function isManageArchivedVerifiedItem(item) {
    return item && item.trust_level === "已归档";
}

function applyManageClueFilter(clues) {
    if (manageFilter === "normal") {
        return clues.filter(clue => !isManageArchivedClue(clue));
    }

    if (manageFilter === "archived") {
        return clues.filter(clue => isManageArchivedClue(clue));
    }

    return clues;
}

function applyManageVerifiedFilter(items) {
    if (manageFilter === "normal") {
        return items.filter(item => !isManageArchivedVerifiedItem(item));
    }

    if (manageFilter === "archived") {
        return items.filter(item => isManageArchivedVerifiedItem(item));
    }

    return items;
}

async function loadManageData() {
    injectManageFilterBar();
    updateManageFilterButtons();

    await loadManageVerifiedItems();
    await loadManageClues();
}

async function loadManageVerifiedItems() {
    const box = document.getElementById("manageVerifiedList");

    try {
        const response = await fetch(`${API_BASE}/verified-items`);
        const data = await response.json();

        const allItems = data.data || [];
        const items = applyManageVerifiedFilter(allItems);

        if (items.length === 0) {
            box.innerHTML = `<div class="empty">当前筛选下暂无真实库数据</div>`;
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

        const allClues = data.data || [];
        const clues = applyManageClueFilter(allClues);

        if (clues.length === 0) {
            box.innerHTML = `<div class="empty">当前筛选下暂无线索库数据</div>`;
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