// smart-core.js
// 智能识别核心 V2
// 目标：统一处理自由文本、字段文本、乱序、重复、缺失、推断、不确定项提示。
// 目前先支持地图点识别，后续线索、反馈、路线都可以复用这里的函数。

window.SmartCore = {
    parseMapPoint
};

function parseMapPoint(rawText) {
    const originalText = String(rawText || "").trim();

    const result = {
        name: "",
        category: "",
        address: "",
        latitude: "",
        longitude: "",
        mapType: "",
        targetType: "",
        targetId: "",
        source: "",
        description: "",
        warnings: [],
        inferred: [],
        confidence: "中"
    };

    if (!originalText) {
        result.warnings.push("未输入内容");
        result.confidence = "低";
        return result;
    }

    const explicit = parseExplicitFields(originalText);
    const fuzzy = parseMapPointFuzzy(originalText);

    mergeIfExists(result, explicit);
    mergeIfMissing(result, fuzzy);

    postProcessMapPoint(result, originalText);

    return result;
}

function parseExplicitFields(text) {
    const result = {};
    const lines = text.split(/\n+/);

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const parts = cleanLine.split(/[:：]/);
        if (parts.length < 2) return;

        const key = parts[0].trim();
        const value = parts.slice(1).join("：").trim();
        if (!value) return;

        const field = normalizeMapFieldKey(key);
        if (field) {
            result[field] = value;
        }
    });

    return result;
}

function parseMapPointFuzzy(text) {
    let workingText = normalizeText(text);

    const result = {};

    const coordinates = extractCoordinates(workingText);
    if (coordinates.latitude && coordinates.longitude) {
        result.latitude = coordinates.latitude;
        result.longitude = coordinates.longitude;
        workingText = removeText(workingText, coordinates.raw);
    }

    const category = findFirstKeyword(workingText, getCategoryKeywords());
    if (category) {
        result.category = category;
        workingText = removeAllOccurrences(workingText, category);
    }

    const mapType = findFirstKeyword(workingText, getMapTypeKeywords());
    if (mapType) {
        result.mapType = normalizeMapType(mapType);
        workingText = removeAllOccurrences(workingText, mapType);
    }

    const source = findFirstKeyword(workingText, getSourceKeywords());
    if (source) {
        result.source = source;
        workingText = removeAllOccurrences(workingText, source);
    }

    const targetInfo = extractTargetInfo(workingText);
    if (targetInfo.targetType) {
        result.targetType = targetInfo.targetType;
        workingText = removeText(workingText, targetInfo.rawType);
    }

    if (targetInfo.targetId) {
        result.targetId = targetInfo.targetId;
        workingText = removeText(workingText, targetInfo.rawId);
    }

    const address = extractAddress(workingText);
    if (address) {
        result.address = address;
        workingText = removeAllOccurrences(workingText, address);
    }

    const name = extractPlaceName(workingText);
    if (name) {
        result.name = name;
        workingText = removeAllOccurrences(workingText, name);
    }

    workingText = cleanRemainingText(workingText);

    if (workingText) {
        result.description = workingText;
    }

    return result;
}

function postProcessMapPoint(result, originalText) {
    if (!result.category) {
        result.category = inferCategory(originalText);
        result.inferred.push("分类");
    }

    if (!result.mapType) {
        result.mapType = inferMapType(result.category, originalText);
        result.inferred.push("地图类型");
    }

    if (!result.source) {
        result.source = "手动添加";
        result.inferred.push("来源");
    }

    if (!result.address) {
        const addressFromName = inferAddressFromName(result.name);
        if (addressFromName) {
            result.address = addressFromName;
            result.inferred.push("地址/区域");
        }
    }

    if (!result.name) {
        const guessedName = guessNameFromText(originalText, result);
        if (guessedName) {
            result.name = guessedName;
            result.inferred.push("地点名称");
        }
    }

    if (!result.description) {
        result.description = buildDefaultDescription(result);
        result.inferred.push("说明");
    }

    result.description = removeDuplicatedDescriptionParts(result.description, result);

    if (!result.name) {
        result.warnings.push("地点名称未能明确识别");
    }

    if (!result.address) {
        result.warnings.push("地址/区域未能明确识别");
    }

    if (result.inferred.length >= 3 || result.warnings.length > 0) {
        result.confidence = "低";
    } else if (result.inferred.length > 0) {
        result.confidence = "中";
    } else {
        result.confidence = "高";
    }
}

function mergeIfExists(target, source) {
    Object.keys(source || {}).forEach(key => {
        if (source[key]) {
            target[key] = source[key];
        }
    });
}

function mergeIfMissing(target, source) {
    Object.keys(source || {}).forEach(key => {
        if (!target[key] && source[key]) {
            target[key] = source[key];
        }
    });
}

function normalizeMapFieldKey(key) {
    const map = {
        "地点名称": "name",
        "名称": "name",
        "地点": "name",
        "店名": "name",
        "标题": "name",

        "分类": "category",
        "类别": "category",

        "地址": "address",
        "地址/区域": "address",
        "区域": "address",
        "位置": "address",

        "纬度": "latitude",
        "lat": "latitude",
        "latitude": "latitude",

        "经度": "longitude",
        "lng": "longitude",
        "lon": "longitude",
        "longitude": "longitude",

        "地图类型": "mapType",
        "类型": "mapType",

        "关联对象类型": "targetType",
        "关联类型": "targetType",

        "关联对象ID": "targetId",
        "关联对象id": "targetId",
        "关联ID": "targetId",
        "关联id": "targetId",

        "来源": "source",
        "来源平台": "source",

        "说明": "description",
        "描述": "description",
        "备注": "description",
        "简介": "description"
    };

    return map[key] || "";
}

function normalizeText(text) {
    return String(text || "")
        .replace(/[，,。；;、|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCategoryKeywords() {
    return [
        "生活服务",
        "避坑纠错",
        "外部线索",
        "测试线索",
        "探店",
        "租房",
        "地图",
        "路线"
    ];
}

function getMapTypeKeywords() {
    return [
        "citywalk路线",
        "citywalk",
        "生活地点",
        "美食地图",
        "租房地图",
        "游玩地图",
        "避坑地图"
    ];
}

function getSourceKeywords() {
    return [
        "公开网页自动采集",
        "前端配置采集",
        "管理员整理",
        "用户投稿",
        "手动测试",
        "手动添加",
        "公开网页",
        "自动采集",
        "备份导入",
        "小红书",
        "公众号",
        "大众点评",
        "美团",
        "抖音",
        "B站"
    ];
}

function findFirstKeyword(text, keywordList) {
    const sorted = [...keywordList].sort((a, b) => b.length - a.length);

    for (const keyword of sorted) {
        if (text.includes(keyword)) {
            return keyword;
        }
    }

    return "";
}

function removeAllOccurrences(text, keyword) {
    if (!keyword) return text;

    return String(text || "")
        .split(keyword)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function removeText(text, part) {
    if (!part) return text;

    return String(text || "")
        .replace(part, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractCoordinates(text) {
    const result = {
        latitude: "",
        longitude: "",
        raw: ""
    };

    const match = text.match(/(-?\d{1,3}\.\d+)\s*[,， ]\s*(-?\d{1,3}\.\d+)/);

    if (!match) {
        return result;
    }

    const first = match[1];
    const second = match[2];

    // 广州纬度约 23，经度约 113。
    // 如果出现 23.xxx 113.xxx，按纬度、经度识别。
    // 如果出现 113.xxx 23.xxx，自动交换。
    const n1 = Number(first);
    const n2 = Number(second);

    if (n1 > 70 && n2 < 70) {
        result.longitude = first;
        result.latitude = second;
    } else {
        result.latitude = first;
        result.longitude = second;
    }

    result.raw = match[0];
    return result;
}

function extractTargetInfo(text) {
    const result = {
        targetType: "",
        targetId: "",
        rawType: "",
        rawId: ""
    };

    if (text.includes("关联线索") || text.includes("线索ID") || text.includes("线索id")) {
        result.targetType = "clue";
        result.rawType = "关联线索";
    }

    if (text.includes("关联真实库") || text.includes("真实库ID") || text.includes("真实库id")) {
        result.targetType = "verified";
        result.rawType = "关联真实库";
    }

    const idMatch = text.match(/(?:ID|id|编号)\s*[:：]?\s*(\d+)/);
    if (idMatch) {
        result.targetId = idMatch[1];
        result.rawId = idMatch[0];
    }

    return result;
}

function extractAddress(text) {
    const patterns = [
        /广州大学城[\u4e00-\u9fa5A-Za-z0-9]{0,24}(附近|周边|旁|内|里|村|地铁站|商业中心)?/,
        /大学城[\u4e00-\u9fa5A-Za-z0-9]{0,24}(附近|周边|旁|内|里|村|地铁站|商业中心)?/,
        /(贝岗|北亭|南亭|广大|广工|华工|中大|星海|广美|广外)[\u4e00-\u9fa5A-Za-z0-9]{0,18}(附近|周边|村|商业中心|地铁站)?/
    ];

    const candidates = [];

    patterns.forEach(pattern => {
        const match = text.match(pattern);
        if (match && match[0]) {
            candidates.push(match[0].trim());
        }
    });

    if (candidates.length === 0) {
        return "";
    }

    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
}

function extractPlaceName(text) {
    const suffixList = [
        "打印店",
        "烧烤店",
        "奶茶店",
        "咖啡店",
        "便利店",
        "理发店",
        "维修店",
        "药店",
        "餐厅",
        "饭店",
        "烧烤",
        "奶茶",
        "咖啡",
        "超市",
        "公寓",
        "出租屋",
        "自习室",
        "快递点",
        "维修点",
        "驿站",
        "饭堂",
        "食堂",
        "地铁站",
        "商业中心",
        "广场",
        "图书馆",
        "体育馆",
        "店",
        "点",
        "馆"
    ];

    const anchorList = [
        "广大附近",
        "广工附近",
        "华工附近",
        "中大附近",
        "星海附近",
        "广美附近",
        "广外附近",
        "贝岗",
        "北亭",
        "南亭",
        "广大",
        "广工",
        "华工",
        "中大",
        "星海",
        "广美",
        "广外",
        "大学城南",
        "大学城北",
        "大学城"
    ];

    const candidates = [];

    suffixList.forEach(suffix => {
        let index = text.indexOf(suffix);

        while (index !== -1) {
            const end = index + suffix.length;
            let start = Math.max(0, index - 12);

            anchorList.forEach(anchor => {
                const anchorIndex = text.lastIndexOf(anchor, index);
                if (anchorIndex !== -1) {
                    start = anchorIndex;
                }
            });

            let candidate = text.slice(start, end).trim();
            candidate = cleanNameCandidate(candidate);

            if (candidate.length >= 2) {
                candidates.push(candidate);
            }

            index = text.indexOf(suffix, index + 1);
        }
    });

    if (candidates.length === 0) {
        return "";
    }

    const uniqueCandidates = Array.from(new Set(candidates));

    uniqueCandidates.sort((a, b) => {
        const scoreDiff = scorePlaceName(b) - scorePlaceName(a);
        if (scoreDiff !== 0) return scoreDiff;
        return a.length - b.length;
    });

    return uniqueCandidates[0];
}

function cleanNameCandidate(name) {
    return String(name || "")
        .replace(/^测试/, "")
        .replace(/^新增/, "")
        .replace(/^中心/, "")
        .replace(/^地点/, "")
        .replace(/\s+/g, "")
        .trim();
}

function scorePlaceName(name) {
    let score = 0;

    const strongWords = [
        "打印店",
        "烧烤店",
        "奶茶店",
        "咖啡店",
        "便利店",
        "理发店",
        "维修店",
        "餐厅",
        "饭店",
        "超市",
        "公寓",
        "出租屋",
        "自习室",
        "快递点",
        "地铁站"
    ];

    strongWords.forEach(word => {
        if (name.includes(word)) score += 5;
    });

    const areaWords = [
        "广大",
        "广工",
        "华工",
        "中大",
        "星海",
        "广美",
        "广外",
        "贝岗",
        "北亭",
        "南亭",
        "大学城"
    ];

    areaWords.forEach(word => {
        if (name.includes(word)) score += 3;
    });

    if (name.length >= 3 && name.length <= 14) score += 2;
    if (name.includes("测试") || name.includes("说明") || name.includes("新增")) score -= 4;

    return score;
}

function inferCategory(text) {
    if (text.includes("租") || text.includes("公寓") || text.includes("房")) return "租房";
    if (text.includes("吃") || text.includes("烧烤") || text.includes("奶茶") || text.includes("咖啡") || text.includes("餐")) return "探店";
    if (text.includes("路线") || text.includes("citywalk")) return "路线";
    if (text.includes("打印") || text.includes("维修") || text.includes("快递") || text.includes("理发")) return "生活服务";
    if (text.includes("避坑") || text.includes("踩雷") || text.includes("虚假") || text.includes("不准")) return "避坑纠错";
    return "外部线索";
}

function inferMapType(category, text) {
    if (text.includes("citywalk")) return "citywalk路线";
    if (category === "探店") return "美食地图";
    if (category === "租房") return "租房地图";
    if (category === "路线") return "citywalk路线";
    if (category === "生活服务") return "生活地点";
    if (category === "避坑纠错") return "避坑地图";
    return "生活地点";
}

function normalizeMapType(type) {
    if (type === "citywalk") return "citywalk路线";
    return type;
}

function inferAddressFromName(name) {
    if (!name) return "";

    const areaWords = [
        "广州大学城",
        "大学城南",
        "大学城北",
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

    for (const area of areaWords) {
        if (name.includes(area)) {
            return area.includes("大学城") ? area : `${area}附近`;
        }
    }

    return "";
}

function guessNameFromText(text, result) {
    let cleaned = normalizeText(text);

    [
        result.category,
        result.mapType,
        result.address,
        result.source,
        result.description
    ].forEach(part => {
        if (part) {
            cleaned = removeAllOccurrences(cleaned, part);
        }
    });

    cleaned = cleanRemainingText(cleaned);

    if (!cleaned) return "";

    if (cleaned.length <= 14) return cleaned;

    return cleaned.slice(0, 14);
}

function buildDefaultDescription(result) {
    const parts = [];

    if (result.name) parts.push(result.name);
    if (result.category) parts.push(result.category);
    if (result.address) parts.push(result.address);

    return parts.join("，") || "智能识别生成的信息，建议人工检查。";
}

function removeDuplicatedDescriptionParts(description, result) {
    let text = String(description || "");

    [
        result.name,
        result.category,
        result.address,
        result.mapType,
        result.source
    ].forEach(part => {
        if (part) {
            text = removeAllOccurrences(text, part);
        }
    });

    text = cleanRemainingText(text);

    if (!text) {
        return buildDefaultDescription(result);
    }

    return text;
}

function cleanRemainingText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}