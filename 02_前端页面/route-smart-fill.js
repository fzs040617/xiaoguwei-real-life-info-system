// route-smart-fill.js
// 路线中心智能识别填表：
// 支持自由文本、乱序、缺失、部分重复。
// 流程：识别填表 → 用户检查 → 确认同步到系统。

const ROUTE_SMART_API_BASE = "http://127.0.0.1:8000";

let routeSmartMapPoints = [];

window.addEventListener("load", () => {
    injectRouteSmartBox();
    loadRouteSmartMapPoints();
});

function injectRouteSmartBox() {
    const container = document.querySelector(".container");

    if (!container || document.getElementById("routeSmartBox")) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "routeSmartBox";

    box.innerHTML = `
        <h2>智能识别新建路线</h2>
        <p class="notice">
            可以直接输入一段路线想法，系统会尽量识别路线名称、类型、起点、来源、说明，并自动匹配已存在的地图点。
            识别可能有偏差，请检查下方表单后再点击“确认同步到系统”。
        </p>

        <div class="form-row">
            <label>粘贴路线信息</label>
            <textarea id="routeSmartInput" placeholder="例如：广大附近打印店 贝岗夜宵 大学城南出发 citywalk 手动整理 适合晚上从大学城南出发，先打印资料，再去贝岗吃夜宵"></textarea>
        </div>

        <button onclick="parseRouteSmartText()">智能识别填表</button>
        <button id="routeSmartConfirmBtn" style="margin-left: 8px; display:none;" onclick="confirmRouteSmartSubmit()">确认同步到系统</button>
        <button style="margin-left: 8px;" onclick="clearRouteSmartInput()">清空</button>

        <div id="routeSmartPreview" class="crawl-result-box" style="margin-top: 14px;"></div>
    `;

    const firstBox = container.querySelector(".box");

    if (firstBox) {
        firstBox.insertAdjacentElement("beforebegin", box);
    } else {
        container.prepend(box);
    }
}

async function loadRouteSmartMapPoints() {
    try {
        const response = await fetch(`${ROUTE_SMART_API_BASE}/map-points?status=正常`);
        const data = await response.json();
        routeSmartMapPoints = data.data || [];
    } catch (error) {
        routeSmartMapPoints = [];
    }
}

async function parseRouteSmartText() {
    const rawText = document.getElementById("routeSmartInput").value.trim();

    if (!rawText) {
        alert("请先输入一段路线信息。");
        return;
    }

    if (routeSmartMapPoints.length === 0) {
        await loadRouteSmartMapPoints();
    }

    const data = parseRouteText(rawText);

    fillRouteForm(data);

    document.getElementById("routeSmartPreview").innerText =
        "已识别并填入下方表单，请检查无误后再点击“确认同步到系统”。\n\n" + buildRouteSmartPreview(data);

    const btn = document.getElementById("routeSmartConfirmBtn");
    if (btn) {
        btn.style.display = "inline-block";
    }
}

function parseRouteText(text) {
    let workingText = normalizeRouteText(text);
    const result = {};

    const routeTypeList = [
        "citywalk路线",
        "citywalk",
        "美食路线",
        "夜宵路线",
        "租房看房路线",
        "看房路线",
        "生活服务路线",
        "避坑路线",
        "其他路线"
    ];

    const sourceList = [
        "手动整理",
        "手动添加",
        "手动测试",
        "用户投稿",
        "管理员整理",
        "公开网页",
        "自动采集"
    ];

    const routeTypeRaw = findFirstRouteKeyword(workingText, routeTypeList);
    if (routeTypeRaw) {
        result.routeType = normalizeRouteType(routeTypeRaw);
        workingText = removeAllRouteKeyword(workingText, routeTypeRaw);
    }

    const source = findFirstRouteKeyword(workingText, sourceList);
    if (source) {
        result.source = source;
        workingText = removeAllRouteKeyword(workingText, source);
    }

    const startArea = extractStartArea(workingText);
    if (startArea) {
        result.startArea = startArea;
        workingText = removeAllRouteKeyword(workingText, startArea);
        workingText = removeAllRouteKeyword(workingText, "出发");
        workingText = removeAllRouteKeyword(workingText, "起点");
    }

    const matchedPoints = matchRouteMapPoints(text);
    if (matchedPoints.length > 0) {
        result.pointIds = matchedPoints.map(point => point.id).join(",");
    }

    if (!result.routeType) {
        result.routeType = inferRouteType(text, matchedPoints);
    }

    result.category = inferRouteCategory(result.routeType);

    result.name = inferRouteName(text, result.routeType, result.startArea, matchedPoints);

    workingText = cleanRouteRemainingText(workingText);

    if (workingText) {
        result.description = workingText;
    } else {
        result.description = buildDefaultRouteDescription(result, matchedPoints);
    }

    return result;
}

function normalizeRouteText(text) {
    return String(text || "")
        .replace(/[，,。；;、|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findFirstRouteKeyword(text, keywordList) {
    const sortedList = [...keywordList].sort((a, b) => b.length - a.length);

    for (const keyword of sortedList) {
        if (text.includes(keyword)) {
            return keyword;
        }
    }

    return "";
}

function removeAllRouteKeyword(text, keyword) {
    if (!keyword) return text;

    return text
        .split(keyword)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeRouteType(type) {
    if (type === "citywalk") return "citywalk路线";
    if (type === "夜宵路线") return "美食路线";
    if (type === "看房路线") return "租房看房路线";
    return type;
}

function extractStartArea(text) {
    const patterns = [
        /(大学城南|大学城北|贝岗|北亭|南亭|广大|广工|华工|中大|星海|广美|广外|广州大学城)[\u4e00-\u9fa5A-Za-z0-9]{0,12}(出发|起点|附近|地铁站)?/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[0]) {
            return match[0].replace("出发", "").replace("起点", "").trim();
        }
    }

    return "";
}

function matchRouteMapPoints(text) {
    const matched = [];

    routeSmartMapPoints.forEach(point => {
        const name = point.name || "";
        const address = point.address || "";
        const description = point.description || "";

        if (!name) {
            return;
        }

        if (text.includes(name)) {
            matched.push(point);
            return;
        }

        const shortName = simplifyPointName(name);
        if (shortName && text.includes(shortName)) {
            matched.push(point);
            return;
        }

        if (address && text.includes(address)) {
            matched.push(point);
            return;
        }

        if (description && description.length <= 12 && text.includes(description)) {
            matched.push(point);
            return;
        }
    });

    const unique = [];
    const seen = new Set();

    matched.forEach(point => {
        if (!seen.has(point.id)) {
            seen.add(point.id);
            unique.push(point);
        }
    });

    return unique;
}

function simplifyPointName(name) {
    return String(name || "")
        .replace("附近", "")
        .replace("某", "")
        .replace(/\s+/g, "")
        .trim();
}

function inferRouteType(text, points) {
    if (text.includes("租") || text.includes("看房") || hasPointCategory(points, "租房")) {
        return "租房看房路线";
    }

    if (text.includes("吃") || text.includes("夜宵") || text.includes("美食") || hasPointCategory(points, "探店")) {
        return "美食路线";
    }

    if (text.includes("打印") || text.includes("快递") || text.includes("维修") || hasPointCategory(points, "生活服务")) {
        return "生活服务路线";
    }

    if (text.includes("避坑") || text.includes("踩雷") || hasPointCategory(points, "避坑纠错")) {
        return "避坑路线";
    }

    return "citywalk路线";
}

function hasPointCategory(points, category) {
    return points.some(point => point.category === category);
}

function inferRouteCategory(routeType) {
    if (routeType === "美食路线") return "探店";
    if (routeType === "租房看房路线") return "租房";
    if (routeType === "生活服务路线") return "生活服务";
    if (routeType === "避坑路线") return "避坑纠错";
    return "路线";
}

function inferRouteName(text, routeType, startArea, points) {
    if (startArea) {
        return `${startArea}${routeType}`;
    }

    if (points.length > 0) {
        const first = points[0].name || "大学城";
        return `${first}${routeType}`;
    }

    if (text.length <= 16) {
        return text;
    }

    return `大学城${routeType}`;
}

function buildDefaultRouteDescription(data, points) {
    const pointNames = points.map(point => point.name).join(" → ");

    if (pointNames) {
        return `路线包含：${pointNames}`;
    }

    return "智能识别生成的路线草稿，建议人工检查后使用。";
}

function cleanRouteRemainingText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

function fillRouteForm(data) {
    if (data.name) {
        document.getElementById("routeName").value = data.name;
    }

    if (data.routeType) {
        setRouteSelectValue("routeType", data.routeType);
    }

    if (data.category) {
        setRouteSelectValue("routeCategory", data.category);
    }

    if (data.startArea) {
        document.getElementById("routeStartArea").value = data.startArea;
    }

    if (data.pointIds) {
        document.getElementById("routePointIds").value = data.pointIds;
    }

    if (data.source) {
        document.getElementById("routeSource").value = data.source;
    }

    if (data.description) {
        document.getElementById("routeDescription").value = data.description;
    }
}

function setRouteSelectValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select || !value) return;

    const matched = Array.from(select.options).find(option => option.value === value || option.text === value);

    if (matched) {
        select.value = matched.value;
    }
}

function confirmRouteSmartSubmit() {
    const name = document.getElementById("routeName").value.trim();

    if (!name) {
        alert("路线名称为空，不能同步。请先检查识别结果。");
        return;
    }

    const confirmed = confirm("确认将当前路线表单同步到系统吗？");

    if (!confirmed) {
        return;
    }

    createRoute();
}

function buildRouteSmartPreview(data) {
    return [
        "路线名称：" + (data.name || "未识别"),
        "路线类型：" + (data.routeType || "未识别"),
        "分类：" + (data.category || "未识别"),
        "起点/区域：" + (data.startArea || "未识别"),
        "地图点 ID：" + (data.pointIds || "未匹配到地图点"),
        "来源：" + (data.source || "未识别"),
        "路线说明：" + (data.description || "未识别")
    ].join("\n");
}

function clearRouteSmartInput() {
    document.getElementById("routeSmartInput").value = "";
    document.getElementById("routeSmartPreview").innerText = "";

    const btn = document.getElementById("routeSmartConfirmBtn");
    if (btn) {
        btn.style.display = "none";
    }
}