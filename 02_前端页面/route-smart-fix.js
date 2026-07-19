// route-smart-fix.js
// 路线智能识别修复补丁：
// 解决“识别成功但不填表”的问题。
// 不依赖地图点加载，先识别路线名称、类型、起点、来源、说明。

window.parseRouteSmartText = function () {
    try {
        routeFixProgress(10, "路线识别补丁已触发");

        const input = document.getElementById("routeSmartInput");
        const text = input ? input.value.trim() : "";

        if (!text) {
            alert("请先输入一段路线信息。");
            routeFixProgress(20, "输入为空");
            return;
        }

        routeFixProgress(30, "已读取输入内容");

        const data = parseRouteTextFixed(text);

        routeFixProgress(60, "已完成基础识别");

        fillRouteFormFixed(data);

        routeFixProgress(80, "已填入路线表单");

        const preview = document.getElementById("routeSmartPreview");
        if (preview) {
            preview.innerText =
                "已识别并填入下方表单，请检查无误后再点击“确认同步到系统”。\n\n" +
                buildRoutePreviewFixed(data);
        }

        const btn = document.getElementById("routeSmartConfirmBtn");
        if (btn) {
            btn.style.display = "inline-block";
        }

        routeFixProgress(100, "路线智能识别完成");
    } catch (error) {
        routeFixProgress(100, "路线智能识别报错：" + error.message);
        alert("路线智能识别报错：\n" + error.message);
    }
};

function parseRouteTextFixed(text) {
    const raw = String(text || "").trim();
    let working = raw.replace(/[，,。；;、|]/g, " ").replace(/\s+/g, " ").trim();

    const result = {
        name: "",
        routeType: "",
        category: "",
        startArea: "",
        pointIds: "",
        source: "",
        description: ""
    };

    const routeTypes = [
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

    const sources = [
        "手动整理",
        "手动添加",
        "手动测试",
        "用户投稿",
        "管理员整理",
        "公开网页",
        "自动采集"
    ];

    const matchedRouteType = findRouteKeywordFixed(working, routeTypes);
    if (matchedRouteType) {
        result.routeType = normalizeRouteTypeFixed(matchedRouteType);
        working = removeRouteTextFixed(working, matchedRouteType);
    }

    const matchedSource = findRouteKeywordFixed(working, sources);
    if (matchedSource) {
        result.source = matchedSource;
        working = removeRouteTextFixed(working, matchedSource);
    }

    const startArea = extractStartAreaFixed(working);
    if (startArea) {
        result.startArea = startArea;
        working = removeRouteTextFixed(working, startArea);
        working = removeRouteTextFixed(working, "出发");
        working = removeRouteTextFixed(working, "起点");
    }

    if (!result.routeType) {
        result.routeType = inferRouteTypeFixed(raw);
    }

    result.category = inferRouteCategoryFixed(result.routeType);

    working = working.replace(/\s+/g, " ").trim();

    if (working) {
        result.description = working;
    } else {
        result.description = "智能识别生成的路线草稿，建议人工检查。";
    }

    result.name = inferRouteNameFixed(raw, result.routeType, result.startArea, result.description);

    result.pointIds = matchPointIdsFromLoadedCardsFixed(raw);

    return result;
}

function findRouteKeywordFixed(text, list) {
    const sorted = [...list].sort((a, b) => b.length - a.length);

    for (const item of sorted) {
        if (text.includes(item)) {
            return item;
        }
    }

    return "";
}

function removeRouteTextFixed(text, part) {
    if (!part) {
        return text;
    }

    return String(text || "")
        .split(part)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeRouteTypeFixed(type) {
    if (type === "citywalk") return "citywalk路线";
    if (type === "夜宵路线") return "美食路线";
    if (type === "看房路线") return "租房看房路线";
    return type;
}

function extractStartAreaFixed(text) {
    const areas = [
        "大学城南",
        "大学城北",
        "广州大学城",
        "大学城",
        "贝岗",
        "北亭",
        "南亭",
        "广大",
        "广工",
        "华工",
        "中大",
        "星海",
        "广美",
        "广外"
    ];

    for (const area of areas) {
        if (text.includes(area + "出发")) {
            return area;
        }

        if (text.includes(area + "起点")) {
            return area;
        }
    }

    for (const area of areas) {
        if (text.includes(area)) {
            return area;
        }
    }

    return "";
}

function inferRouteTypeFixed(text) {
    if (text.includes("租") || text.includes("看房") || text.includes("房")) {
        return "租房看房路线";
    }

    if (text.includes("吃") || text.includes("夜宵") || text.includes("美食") || text.includes("烧烤") || text.includes("奶茶")) {
        return "美食路线";
    }

    if (text.includes("打印") || text.includes("快递") || text.includes("维修") || text.includes("理发")) {
        return "生活服务路线";
    }

    if (text.includes("避坑") || text.includes("踩雷")) {
        return "避坑路线";
    }

    return "citywalk路线";
}

function inferRouteCategoryFixed(routeType) {
    if (routeType === "美食路线") return "探店";
    if (routeType === "租房看房路线") return "租房";
    if (routeType === "生活服务路线") return "生活服务";
    if (routeType === "避坑路线") return "避坑纠错";
    return "路线";
}

function inferRouteNameFixed(raw, routeType, startArea, description) {
    if (startArea) {
        return startArea + routeType;
    }

    const cleaned = String(description || raw || "").replace(/\s+/g, "");

    if (cleaned.length > 0 && cleaned.length <= 12) {
        return cleaned + routeType;
    }

    return "大学城" + routeType;
}

function fillRouteFormFixed(data) {
    setRouteInputFixed("routeName", data.name);
    setRouteSelectFixed("routeType", data.routeType);
    setRouteSelectFixed("routeCategory", data.category);
    setRouteInputFixed("routeStartArea", data.startArea);
    setRouteInputFixed("routePointIds", data.pointIds);
    setRouteInputFixed("routeSource", data.source);
    setRouteInputFixed("routeDescription", data.description);
}

function setRouteInputFixed(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
        el.value = value;
    }
}

function setRouteSelectFixed(id, value) {
    const el = document.getElementById(id);
    if (!el || !value) {
        return;
    }

    const matched = Array.from(el.options).find(option => option.value === value || option.text === value);

    if (matched) {
        el.value = matched.value;
    }
}

function buildRoutePreviewFixed(data) {
    return [
        "路线名称：" + (data.name || "未识别"),
        "路线类型：" + (data.routeType || "未识别"),
        "分类：" + (data.category || "未识别"),
        "起点/区域：" + (data.startArea || "未识别"),
        "地图点 ID：" + (data.pointIds || "未匹配到地图点，可手动补充"),
        "来源：" + (data.source || "未识别"),
        "路线说明：" + (data.description || "未识别")
    ].join("\n");
}

function matchPointIdsFromLoadedCardsFixed(text) {
    // 先不强依赖后端地图点接口。
    // 如果页面已经加载出“可选地图点”卡片，就从卡片文字里尝试匹配 ID。
    const cards = document.querySelectorAll("#selectableMapPointList .card");
    const ids = [];

    cards.forEach(card => {
        const cardText = card.innerText || "";

        const idMatch = cardText.match(/ID：(\d+)/);
        if (!idMatch) {
            return;
        }

        const pointId = idMatch[1];

        const title = card.querySelector("h3") ? card.querySelector("h3").innerText.trim() : "";

        if (title && text.includes(title)) {
            ids.push(pointId);
            return;
        }

        const shortTitle = title.replace("附近", "").replace(/\s+/g, "");
        if (shortTitle && text.includes(shortTitle)) {
            ids.push(pointId);
        }
    });

    return Array.from(new Set(ids)).join(",");
}

function routeFixProgress(percent, text) {
    const bar = document.getElementById("smartProgressBar");
    const label = document.getElementById("smartProgressText");
    const log = document.getElementById("smartProgressLog");

    if (bar) {
        bar.style.width = percent + "%";
    }

    if (label) {
        label.innerText = text;
    }

    if (log) {
        const time = new Date().toLocaleTimeString();
        log.innerText += `[${time}] ℹ️ ${text}\n`;
    }

    console.log("[路线智能识别修复]", text);
}

window.confirmRouteSmartSubmit = function () {
    const name = document.getElementById("routeName").value.trim();

    if (!name) {
        alert("路线名称为空，不能同步。请先检查识别结果。");
        return;
    }

    if (confirm("确认将当前路线表单同步到系统吗？")) {
        createRoute();
    }
};