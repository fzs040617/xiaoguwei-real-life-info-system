// map-smart-fill.js
// 地图中心智能识别 V2：调用 smart-core.js。
// 流程：智能识别 → 填入表单 → 显示置信度和不确定项 → 用户确认同步。

let latestMapSmartData = null;

function parseMapSmartText() {
    const rawText = document.getElementById("mapSmartInput").value.trim();

    if (!rawText) {
        alert("请先粘贴一段地点信息。");
        return;
    }

    if (!window.SmartCore || !window.SmartCore.parseMapPoint) {
        alert("smart-core.js 未加载，请检查 map.html 里的脚本引用顺序。");
        return;
    }

    const result = window.SmartCore.parseMapPoint(rawText);

    latestMapSmartData = result;

    fillMapForm(result);

    document.getElementById("mapSmartPreview").innerText =
        "已识别并填入下方表单，请检查无误后再点击“确认同步到系统”。\n\n" +
        buildMapPreview(result);

    const confirmBtn = document.getElementById("mapSmartConfirmBtn");
    if (confirmBtn) {
        confirmBtn.style.display = "inline-block";
    }
}

function fillMapForm(data) {
    if (data.name) {
        document.getElementById("mapName").value = data.name;
    }

    if (data.category) {
        setSelectValue("mapCategory", data.category);
    }

    if (data.address) {
        document.getElementById("mapAddress").value = data.address;
    }

    if (data.latitude) {
        document.getElementById("mapLatitude").value = data.latitude;
    }

    if (data.longitude) {
        document.getElementById("mapLongitude").value = data.longitude;
    }

    if (data.mapType) {
        setSelectValue("mapType", data.mapType);
    }

    if (data.targetType) {
        setSelectValue("mapTargetType", normalizeTargetType(data.targetType));
    }

    if (data.targetId) {
        document.getElementById("mapTargetId").value = data.targetId;
    }

    if (data.source) {
        document.getElementById("mapSource").value = data.source;
    }

    if (data.description) {
        document.getElementById("mapDescription").value = data.description;
    }
}

function setSelectValue(selectId, value) {
    const select = document.getElementById(selectId);

    if (!select || !value) {
        return;
    }

    const options = Array.from(select.options);
    const matched = options.find(option => option.value === value || option.text === value);

    if (matched) {
        select.value = matched.value;
    }
}

function normalizeTargetType(value) {
    if (value === "线索" || value === "clue" || value === "关联线索") {
        return "clue";
    }

    if (value === "真实库" || value === "verified" || value === "关联真实库") {
        return "verified";
    }

    return "";
}

function confirmMapSmartSubmit() {
    const name = document.getElementById("mapName").value.trim();

    if (!name) {
        alert("地点名称为空，不能同步。请先检查识别结果。");
        return;
    }

    const warningText = latestMapSmartData && latestMapSmartData.warnings && latestMapSmartData.warnings.length > 0
        ? "\n\n注意：仍有不确定项，请确认你已经人工检查。"
        : "";

    const confirmed = confirm("确认将当前表单内容同步到系统吗？" + warningText);

    if (!confirmed) {
        return;
    }

    createMapPoint();
}

function buildMapPreview(data) {
    const inferredText = data.inferred && data.inferred.length > 0
        ? data.inferred.join("、")
        : "无";

    const warningText = data.warnings && data.warnings.length > 0
        ? data.warnings.join("；")
        : "无";

    return [
        "识别置信度：" + (data.confidence || "中"),
        "推断字段：" + inferredText,
        "不确定项：" + warningText,
        "",
        "地点名称：" + (data.name || "未识别"),
        "分类：" + (data.category || "未识别"),
        "地址/区域：" + (data.address || "未识别"),
        "纬度：" + (data.latitude || "未识别"),
        "经度：" + (data.longitude || "未识别"),
        "地图类型：" + (data.mapType || "未识别"),
        "关联对象类型：" + (data.targetType || "未识别"),
        "关联对象 ID：" + (data.targetId || "未识别"),
        "来源：" + (data.source || "未识别"),
        "说明：" + (data.description || "未识别")
    ].join("\n");
}

function clearMapSmartInput() {
    document.getElementById("mapSmartInput").value = "";
    document.getElementById("mapSmartPreview").innerText = "";
    latestMapSmartData = null;

    const confirmBtn = document.getElementById("mapSmartConfirmBtn");
    if (confirmBtn) {
        confirmBtn.style.display = "none";
    }
}