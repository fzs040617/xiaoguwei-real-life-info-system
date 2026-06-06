const API_BASE = "http://127.0.0.1:8000";
const MAP_ADMIN_TOKEN_KEY = "xgw_user_token";

function getMapAdminToken() {
    return localStorage.getItem(MAP_ADMIN_TOKEN_KEY) || "";
}

let currentMapCategory = "全部";
let currentMapStatus = "正常";

function handleMapSearchKeyDown(event) {
    if (event.key === "Enter") {
        loadMapPoints();
    }
}

function setMapCategory(category) {
    currentMapCategory = category;
    updateMapFilterButtons();
    loadMapPoints();
}

function setMapStatus(status) {
    currentMapStatus = status;
    updateMapFilterButtons();
    loadMapPoints();
}

function updateMapFilterButtons() {
    const categories = ["全部", "探店", "租房", "地图", "路线", "生活服务", "避坑纠错", "外部线索"];
    categories.forEach(category => {
        const btn = document.getElementById("mapCat" + category);
        if (btn) {
            btn.classList.remove("active");
        }
    });

    const activeCategory = document.getElementById("mapCat" + currentMapCategory);
    if (activeCategory) {
        activeCategory.classList.add("active");
    }

    const statuses = ["正常", "已归档", "全部"];
    statuses.forEach(status => {
        const btn = document.getElementById("mapStatus" + status);
        if (btn) {
            btn.classList.remove("active");
        }
    });

    const activeStatus = document.getElementById("mapStatus" + currentMapStatus);
    if (activeStatus) {
        activeStatus.classList.add("active");
    }
}

async function createMapPoint() {
    const name = document.getElementById("mapName").value.trim();
    const category = document.getElementById("mapCategory").value;
    const address = document.getElementById("mapAddress").value.trim();
    const latitude = document.getElementById("mapLatitude").value.trim();
    const longitude = document.getElementById("mapLongitude").value.trim();
    const mapType = document.getElementById("mapType").value;
    const targetType = document.getElementById("mapTargetType").value;
    const targetIdText = document.getElementById("mapTargetId").value.trim();
    const source = document.getElementById("mapSource").value.trim();
    const description = document.getElementById("mapDescription").value.trim();

    if (!name) {
        alert("请填写地点名称。");
        return;
    }

    const payload = {
        token: getMapAdminToken(),
        name: name,
        category: category,
        address: address || null,
        latitude: latitude || null,
        longitude: longitude || null,
        map_type: mapType,
        target_type: targetType || null,
        target_id: targetIdText ? Number(targetIdText) : null,
        source: source || "手动添加",
        description: description || null
    };

    const response = await fetch(`${API_BASE}/map-points`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("mapMessage").innerText = "地图点新增成功。";

        document.getElementById("mapName").value = "";
        document.getElementById("mapAddress").value = "";
        document.getElementById("mapLatitude").value = "";
        document.getElementById("mapLongitude").value = "";
        document.getElementById("mapTargetId").value = "";
        document.getElementById("mapSource").value = "";
        document.getElementById("mapDescription").value = "";

        await loadMapPoints();
    } else {
        document.getElementById("mapMessage").innerText = "新增失败：" + JSON.stringify(data);
    }
}

async function loadMapPoints() {
    const box = document.getElementById("mapPointList");
    const keyword = document.getElementById("mapKeyword") ? document.getElementById("mapKeyword").value.trim() : "";

    const params = new URLSearchParams();

    if (keyword) {
        params.set("keyword", keyword);
    }

    if (currentMapCategory !== "全部") {
        params.set("category", currentMapCategory);
    }

    if (currentMapStatus !== "全部") {
        params.set("status", currentMapStatus);
    }

    try {
        const response = await fetch(`${API_BASE}/map-points?${params.toString()}`);
        const data = await response.json();
        const points = data.data || [];

        if (points.length === 0) {
            box.innerHTML = `<div class="empty">当前筛选下暂无地图点。</div>`;
            return;
        }

        box.innerHTML = points.map(point => renderMapPointCard(point)).join("");

    } catch (error) {
        box.innerHTML = `<div class="empty">地图点加载失败，请确认后端已启动。</div>`;
    }
}

function renderMapPointCard(point) {
    const archived = point.status === "已归档";
    const mapQuery = buildMapQuery(point);

    const relatedButton = buildRelatedButton(point);

    return `
        <div class="card">
            <div>
                <span class="tag">${escapeHtml(point.map_type || "生活地点")}</span>
                <span class="tag">${escapeHtml(point.category || "未分类")}</span>
                <span class="tag ${archived ? "danger-tag" : ""}">${escapeHtml(point.status || "正常")}</span>
            </div>

            <h3>${escapeHtml(point.name)}</h3>

            <div>地址/区域：${escapeHtml(point.address || "暂无地址")}</div>
            <div>坐标：${escapeHtml(point.latitude || "暂无纬度")}，${escapeHtml(point.longitude || "暂无经度")}</div>
            <div>来源：${escapeHtml(point.source || "未知来源")}</div>

            <div class="summary">${escapeHtml(point.description || "暂无说明")}</div>

            <div class="action-row">
                <div class="action-title">地图跳转</div>
                <button class="small-button" onclick="openAmapSearch('${escapeJs(mapQuery)}')">高德搜索</button>
                <button class="small-button" onclick="openBaiduMapSearch('${escapeJs(mapQuery)}')">百度地图</button>
                ${relatedButton}
            </div>

            <div class="action-row">
                <div class="action-title">地图点管理</div>
                <button class="small-button" onclick="editMapPoint(${point.id})">编辑</button>
                ${
                    archived
                    ? `<button class="small-button approve-button" onclick="restoreMapPoint(${point.id})">恢复</button>`
                    : `<button class="small-button warn-button" onclick="archiveMapPoint(${point.id})">归档</button>`
                }
                <button class="small-button danger-button" onclick="deleteMapPoint(${point.id}, '${escapeJs(point.name)}')">彻底删除</button>
            </div>
        </div>
    `;
}

function buildMapQuery(point) {
    if (point.latitude && point.longitude) {
        return `${point.latitude},${point.longitude}`;
    }

    return point.address || point.name || "广州大学城";
}

function buildRelatedButton(point) {
    if (!point.target_type || !point.target_id) {
        return "";
    }

    if (point.target_type === "clue") {
        return `<button class="small-button" onclick="location.href='clue-detail.html?id=${point.target_id}'">查看关联线索</button>`;
    }

    if (point.target_type === "verified") {
        return `<button class="small-button" onclick="location.href='item-detail.html?id=${point.target_id}'">查看关联真实库</button>`;
    }

    return "";
}

async function editMapPoint(pointId) {
    const name = prompt("修改地点名称：留空表示不修改");
    const category = prompt("修改分类：探店/租房/地图/路线/生活服务/避坑纠错/外部线索，留空表示不修改");
    const address = prompt("修改地址/区域：留空表示不修改");
    const latitude = prompt("修改纬度：留空表示不修改");
    const longitude = prompt("修改经度：留空表示不修改");
    const mapType = prompt("修改地图类型：生活地点/美食地图/租房地图/游玩地图/citywalk路线/避坑地图，留空表示不修改");
    const source = prompt("修改来源：留空表示不修改");
    const description = prompt("修改说明：留空表示不修改");

    const payload = {};

    if (name) payload.name = name;
    if (category) payload.category = category;
    if (address) payload.address = address;
    if (latitude) payload.latitude = latitude;
    if (longitude) payload.longitude = longitude;
    if (mapType) payload.map_type = mapType;
    if (source) payload.source = source;
    if (description) payload.description = description;

    if (Object.keys(payload).length === 0) {
        alert("没有填写任何修改内容。");
        return;
    }

    payload.token = getMapAdminToken();

    const response = await fetch(`${API_BASE}/map-points/${pointId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
        alert("地图点已更新。");
        await loadMapPoints();
    } else {
        alert("更新失败：" + JSON.stringify(data));
    }
}

async function archiveMapPoint(pointId) {
    if (!confirm("确认归档这个地图点吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/map-points/${pointId}/archive?token=${encodeURIComponent(getMapAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("地图点已归档。");
        await loadMapPoints();
    } else {
        alert("归档失败。");
    }
}

async function restoreMapPoint(pointId) {
    if (!confirm("确认恢复这个地图点吗？")) {
        return;
    }

    const response = await fetch(`${API_BASE}/map-points/${pointId}/restore?token=${encodeURIComponent(getMapAdminToken())}`, {
        method: "POST"
    });

    if (response.ok) {
        alert("地图点已恢复。");
        await loadMapPoints();
    } else {
        alert("恢复失败。");
    }
}

async function deleteMapPoint(pointId, pointName) {
    if (!confirm(`确认彻底删除这个地图点吗？\n\n${pointName}\n\n建议优先归档。`)) {
        return;
    }

    const response = await fetch(`${API_BASE}/map-points/${pointId}?token=${encodeURIComponent(getMapAdminToken())}`, {
        method: "DELETE"
    });

    if (response.ok) {
        alert("地图点已删除。");
        await loadMapPoints();
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

function openAmapSearch(query) {
    if (!query) {
        query = "广州大学城";
    }

    const url = `https://www.amap.com/search?query=${encodeURIComponent(query)}`;
    window.open(url, "_blank");
}

function openBaiduMapSearch(query) {
    if (!query) {
        query = "广州大学城";
    }

    const encoded = encodeURIComponent(query);
    const url = `https://map.baidu.com/search/${encoded}?querytype=s&wd=${encoded}`;
    window.open(url, "_blank");
}
