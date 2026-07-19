const API_BASE = "http://127.0.0.1:8000";
const ROUTE_ADMIN_TOKEN_KEY = "xgw_user_token";

function getRouteAdminToken() {
    return localStorage.getItem(ROUTE_ADMIN_TOKEN_KEY) || "";
}

let currentRouteType = "全部";
let currentRouteStatus = "正常";

async function loadRoutePage() {
    await loadSelectableMapPoints();
    await loadRoutes();
}

function handleRouteSearchKeyDown(event) {
    if (event.key === "Enter") {
        loadRoutes();
    }
}

function handleRouteMapSearchKeyDown(event) {
    if (event.key === "Enter") {
        loadSelectableMapPoints();
    }
}

function setRouteType(type) {
    currentRouteType = type;
    updateRouteFilterButtons();
    loadRoutes();
}

function setRouteStatus(status) {
    currentRouteStatus = status;
    updateRouteFilterButtons();
    loadRoutes();
}

function updateRouteFilterButtons() {
    const types = ["全部", "citywalk路线", "美食路线", "租房看房路线", "生活服务路线", "避坑路线"];

    types.forEach(type => {
        const btn = document.getElementById("routeType" + type);
        if (btn) {
            btn.classList.remove("active");
        }
    });

    const activeType = document.getElementById("routeType" + currentRouteType);
    if (activeType) {
        activeType.classList.add("active");
    }

    const statuses = ["正常", "已归档", "全部"];

    statuses.forEach(status => {
        const btn = document.getElementById("routeStatus" + status);
        if (btn) {
            btn.classList.remove("active");
        }
    });

    const activeStatus = document.getElementById("routeStatus" + currentRouteStatus);
    if (activeStatus) {
        activeStatus.classList.add("active");
    }
}

async function loadSelectableMapPoints() {
    const box = document.getElementById("selectableMapPointList");
    const keyword = document.getElementById("routeMapKeyword")
        ? document.getElementById("routeMapKeyword").value.trim()
        : "";

    const params = new URLSearchParams();
    params.set("status", "正常");

    if (keyword) {
        params.set("keyword", keyword);
    }

    try {
        const response = await fetch(`${API_BASE}/map-points?${params.toString()}`);
        const data = await response.json();
        const points = data.data || [];

        if (points.length === 0) {
            box.innerHTML = `<div class="empty">暂无可选地图点。请先去地图中心新增地图点。</div>`;
            return;
        }

        box.innerHTML = points.map(point => `
            <div class="card">
                <div>
                    <span class="tag">${escapeHtml(point.map_type || "生活地点")}</span>
                    <span class="tag">${escapeHtml(point.category || "未分类")}</span>
                </div>

                <h3>${escapeHtml(point.name)}</h3>
                <div>ID：${point.id}</div>
                <div>地址：${escapeHtml(point.address || "暂无地址")}</div>
                <div class="summary">${escapeHtml(point.description || "暂无说明")}</div>

                <button class="small-button" onclick="addPointToRouteDraft(${point.id})">加入路线草稿</button>
                <button class="small-button" onclick="location.href='map.html'">去地图中心</button>
            </div>
        `).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">地图点加载失败，请确认后端已启动。</div>`;
    }
}

function addPointToRouteDraft(pointId) {
    const input = document.getElementById("routePointIds");
    const existing = input.value.trim();

    let ids = existing
        ? existing.split(",").map(item => item.trim()).filter(Boolean)
        : [];

    const pointIdText = String(pointId);

    if (!ids.includes(pointIdText)) {
        ids.push(pointIdText);
    }

    input.value = ids.join(",");

    document.getElementById("routeMessage").innerText = `已加入地图点 ID：${pointId}`;
}

function clearRouteDraft() {
    document.getElementById("routeName").value = "";
    document.getElementById("routeStartArea").value = "";
    document.getElementById("routePointIds").value = "";
    document.getElementById("routeSource").value = "";
    document.getElementById("routeDescription").value = "";
    document.getElementById("routeMessage").innerText = "";
}

async function createRoute() {
    const name = document.getElementById("routeName").value.trim();
    const routeType = document.getElementById("routeType").value;
    const category = document.getElementById("routeCategory").value;
    const startArea = document.getElementById("routeStartArea").value.trim();
    const pointIds = document.getElementById("routePointIds").value.trim();
    const source = document.getElementById("routeSource").value.trim();
    const description = document.getElementById("routeDescription").value.trim();

    if (!name) {
        alert("请填写路线名称。");
        return;
    }

    const response = await fetch(`${API_BASE}/routes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            token: getRouteAdminToken(),
            name: name,
            route_type: routeType,
            category: category,
            start_area: startArea || null,
            point_ids: pointIds || null,
            source: source || "手动添加",
            description: description || null
        })
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("routeMessage").innerText = "路线创建成功。";
        clearRouteDraft();
        await loadRoutes();
    } else {
        document.getElementById("routeMessage").innerText = "创建失败：" + JSON.stringify(data);
    }
}

async function loadRoutes() {
    const box = document.getElementById("routeList");
    const keyword = document.getElementById("routeKeyword")
        ? document.getElementById("routeKeyword").value.trim()
        : "";

    const params = new URLSearchParams();

    if (keyword) {
        params.set("keyword", keyword);
    }

    if (currentRouteType !== "全部") {
        params.set("route_type", currentRouteType);
    }

    if (currentRouteStatus !== "全部") {
        params.set("status", currentRouteStatus);
    }

    try {
        const response = await fetch(`${API_BASE}/routes?${params.toString()}`);
        const data = await response.json();
        const routes = data.data || [];

        if (routes.length === 0) {
            box.innerHTML = `<div class="empty">当前筛选下暂无路线。</div>`;
            return;
        }

        box.innerHTML = routes.map(route => renderRouteCard(route)).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">路线加载失败，请确认后端已启动。</div>`;
    }
}

function renderRouteCard(route) {
    const archived = route.status === "已归档";

    const pointsHtml = (route.points || []).map(point => `
        <div class="target-item">
            <span class="tag">${escapeHtml(point.category || "未分类")}</span>
            <strong>${escapeHtml(point.name)}</strong>
            <div>地址：${escapeHtml(point.address || "暂无地址")}</div>
        </div>
    `).join("");

    return `
        <div class="card">
            <div>
                <span class="tag">${escapeHtml(route.route_type || "路线")}</span>
                <span class="tag">${escapeHtml(route.category || "未分类")}</span>
                <span class="tag ${archived ? "danger-tag" : ""}">${escapeHtml(route.status || "正常")}</span>
            </div>

            <h3>${escapeHtml(route.name)}</h3>

            <div>起点/区域：${escapeHtml(route.start_area || "暂无起点")}</div>
            <div>地图点 ID：${escapeHtml(route.point_ids || "暂无地图点")}</div>
            <div>来源：${escapeHtml(route.source || "未知来源")}</div>
            <div class="summary">${escapeHtml(route.description || "暂无说明")}</div>

            <div class="action-row">
                <div class="action-title">路线包含的地图点</div>
                ${pointsHtml || `<div class="empty">暂无已绑定地图点</div>`}
            </div>

            <div class="action-row">
                <div class="action-title">路线管理</div>
                <button class="small-button" onclick="editRoute(${route.id})">编辑</button>
                ${
                    archived
                    ? `<button class="small-button approve-button" onclick="restoreRoute(${route.id})">恢复</button>`
                    : `<button class="small-button warn-button" onclick="archiveRoute(${route.id})">归档</button>`
                }
                <button class="small-button danger-button" onclick="deleteRoute(${route.id}, '${escapeJs(route.name)}')">彻底删除</button>
            </div>
        </div>
    `;
}

async function editRoute(routeId) {
    const name = prompt("修改路线名称：留空表示不修改");
    const routeType = prompt("修改路线类型：citywalk路线/美食路线/租房看房路线/生活服务路线/避坑路线/其他路线，留空表示不修改");
    const category = prompt("修改分类：路线/探店/租房/生活服务/避坑纠错/地图/外部线索，留空表示不修改");
    const startArea = prompt("修改起点/区域：留空表示不修改");
    const pointIds = prompt("修改地图点 ID，例如：1,2,3，留空表示不修改");
    const source = prompt("修改来源：留空表示不修改");
    const description = prompt("修改路线说明：留空表示不修改");

    const payload = {};

    if (name) payload.name = name;
    if (routeType) payload.route_type = routeType;
    if (category) payload.category = category;
    if (startArea) payload.start_area = startArea;
    if (pointIds) payload.point_ids = pointIds;
    if (source) payload.source = source;
    if (description) payload.description = description;

    if (Object.keys(payload).length === 0) {
        alert("没有填写任何修改内容。");
        return;
    }

    payload.token = getRouteAdminToken();

    const response = await fetch(`${API_BASE}/routes/${routeId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
        alert("路线已更新。");
        await loadRoutes();
    } else {
        alert("更新失败：" + JSON.stringify(data));
    }
}

async function archiveRoute(routeId) {
    if (!confirm("确认归档这条路线吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/routes/${routeId}/archive?token=${encodeURIComponent(getRouteAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("路线已归档。");
        await loadRoutes();
    } else {
        alert("归档失败。");
    }
}

async function restoreRoute(routeId) {
    if (!confirm("确认恢复这条路线吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/routes/${routeId}/restore?token=${encodeURIComponent(getRouteAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("路线已恢复。");
        await loadRoutes();
    } else {
        alert("恢复失败。");
    }
}

async function deleteRoute(routeId, routeName) {
    if (!confirm(`确认彻底删除这条路线吗？\n\n${routeName}\n\n建议优先归档。`)) {
        return;
    }

    const response = await fetch(`${API_BASE}/routes/${routeId}?token=${encodeURIComponent(getRouteAdminToken())}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("路线已删除。");
        await loadRoutes();
    } else {
        alert("删除失败。");
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

function escapeJs(text) {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, " ");
}
