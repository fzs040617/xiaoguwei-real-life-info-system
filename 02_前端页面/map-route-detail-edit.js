// map-route-detail-edit.js
// 地图点详情页 / 路线详情页编辑保存功能

const DETAIL_EDIT_API = "http://127.0.0.1:8000";
const DETAIL_EDIT_TOKEN_KEY = "xgw_user_token";

function getDetailEditToken() {
    return localStorage.getItem(DETAIL_EDIT_TOKEN_KEY) || "";
}

window.addEventListener("load", () => {
    setTimeout(injectDetailEditBox, 600);
});

function getCurrentDetailId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function isMapDetailPage() {
    return location.pathname.includes("map-detail");
}

function isRouteDetailPage() {
    return location.pathname.includes("route-detail");
}

async function injectDetailEditBox() {
    const id = getCurrentDetailId();
    const container = document.querySelector(".container");

    if (!id || !container || document.getElementById("detailEditBox")) {
        return;
    }

    if (isMapDetailPage()) {
        await injectMapPointEditBox(id, container);
    }

    if (isRouteDetailPage()) {
        await injectRouteEditBox(id, container);
    }
}

async function injectMapPointEditBox(id, container) {
    const response = await fetch(`${DETAIL_EDIT_API}/map-points/${id}`);
    const item = await response.json();

    if (!response.ok) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "detailEditBox";

    box.innerHTML = `
        <h2>编辑地图点</h2>
        <p class="notice">修改后点击“保存修改”。保存成功后会刷新页面，并自动写入更新历史。</p>

        <div class="form-row">
            <label>地点名称</label>
            <input id="editMapName" value="${escapeDetailEditAttr(item.name || "")}">
        </div>

        <div class="form-row">
            <label>分类</label>
            <select id="editMapCategory">
                ${buildOptions(["探店", "租房", "地图", "路线", "生活服务", "避坑纠错", "外部线索"], item.category)}
            </select>
        </div>

        <div class="form-row">
            <label>地址/区域</label>
            <input id="editMapAddress" value="${escapeDetailEditAttr(item.address || "")}">
        </div>

        <div class="form-row">
            <label>纬度</label>
            <input id="editMapLatitude" value="${escapeDetailEditAttr(item.latitude || "")}">
        </div>

        <div class="form-row">
            <label>经度</label>
            <input id="editMapLongitude" value="${escapeDetailEditAttr(item.longitude || "")}">
        </div>

        <div class="form-row">
            <label>地图类型</label>
            <select id="editMapType">
                ${buildOptions(["生活地点", "美食地图", "租房地图", "游玩地图", "citywalk路线", "避坑地图"], item.map_type)}
            </select>
        </div>

        <div class="form-row">
            <label>来源</label>
            <input id="editMapSource" value="${escapeDetailEditAttr(item.source || "")}">
        </div>

        <div class="form-row">
            <label>说明</label>
            <textarea id="editMapDescription">${escapeDetailEditHtml(item.description || "")}</textarea>
        </div>

        <button onclick="saveMapPointEdit(${id})">保存修改</button>
        <div id="detailEditMessage" class="message"></div>
    `;

    const historyBox = document.getElementById("detailHistorySummary");
    if (historyBox) {
        historyBox.closest(".section").insertAdjacentElement("beforebegin", box);
    } else {
        container.appendChild(box);
    }
}

async function injectRouteEditBox(id, container) {
    const response = await fetch(`${DETAIL_EDIT_API}/routes/${id}`);
    const item = await response.json();

    if (!response.ok) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "detailEditBox";

    box.innerHTML = `
        <h2>编辑路线</h2>
        <p class="notice">修改后点击“保存修改”。保存成功后会刷新页面，并自动写入更新历史。</p>

        <div class="form-row">
            <label>路线名称</label>
            <input id="editRouteName" value="${escapeDetailEditAttr(item.name || "")}">
        </div>

        <div class="form-row">
            <label>路线类型</label>
            <select id="editRouteType">
                ${buildOptions(["citywalk路线", "美食路线", "租房看房路线", "生活服务路线", "避坑路线", "其他路线"], item.route_type)}
            </select>
        </div>

        <div class="form-row">
            <label>分类</label>
            <select id="editRouteCategory">
                ${buildOptions(["路线", "探店", "租房", "生活服务", "避坑纠错", "地图", "外部线索"], item.category)}
            </select>
        </div>

        <div class="form-row">
            <label>起点/区域</label>
            <input id="editRouteStartArea" value="${escapeDetailEditAttr(item.start_area || "")}">
        </div>

        <div class="form-row">
            <label>地图点 ID，用英文逗号分隔</label>
            <input id="editRoutePointIds" value="${escapeDetailEditAttr(item.point_ids || "")}">
        </div>

        <div class="form-row">
            <label>来源</label>
            <input id="editRouteSource" value="${escapeDetailEditAttr(item.source || "")}">
        </div>

        <div class="form-row">
            <label>路线说明</label>
            <textarea id="editRouteDescription">${escapeDetailEditHtml(item.description || "")}</textarea>
        </div>

        <button onclick="saveRouteEdit(${id})">保存修改</button>
        <div id="detailEditMessage" class="message"></div>
    `;

    const historyBox = document.getElementById("detailHistorySummary");
    if (historyBox) {
        historyBox.closest(".section").insertAdjacentElement("beforebegin", box);
    } else {
        container.appendChild(box);
    }
}

async function saveMapPointEdit(id) {
    const message = document.getElementById("detailEditMessage");
    message.innerText = "正在保存地图点修改...";

    const payload = {
        token: getDetailEditToken(),
        name: getValue("editMapName"),
        category: getValue("editMapCategory"),
        address: getValue("editMapAddress"),
        latitude: getValue("editMapLatitude"),
        longitude: getValue("editMapLongitude"),
        map_type: getValue("editMapType"),
        source: getValue("editMapSource"),
        description: getValue("editMapDescription")
    };

    try {
        const response = await fetch(`${DETAIL_EDIT_API}/map-points/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "保存失败：" + JSON.stringify(data);
            return;
        }

        alert("地图点修改成功，页面将刷新。");
        location.reload();
    } catch (error) {
        message.innerText = "保存失败，请确认后端已启动：" + error.message;
    }
}

async function saveRouteEdit(id) {
    const message = document.getElementById("detailEditMessage");
    message.innerText = "正在保存路线修改...";

    const payload = {
        token: getDetailEditToken(),
        name: getValue("editRouteName"),
        route_type: getValue("editRouteType"),
        category: getValue("editRouteCategory"),
        start_area: getValue("editRouteStartArea"),
        point_ids: getValue("editRoutePointIds"),
        source: getValue("editRouteSource"),
        description: getValue("editRouteDescription")
    };

    try {
        const response = await fetch(`${DETAIL_EDIT_API}/routes/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            message.innerText = "保存失败：" + JSON.stringify(data);
            return;
        }

        alert("路线修改成功，页面将刷新。");
        location.reload();
    } catch (error) {
        message.innerText = "保存失败，请确认后端已启动：" + error.message;
    }
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function buildOptions(options, currentValue) {
    return options.map(option => {
        const selected = option === currentValue ? "selected" : "";
        return `<option value="${escapeDetailEditAttr(option)}" ${selected}>${escapeDetailEditHtml(option)}</option>`;
    }).join("");
}

function escapeDetailEditHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeDetailEditAttr(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
