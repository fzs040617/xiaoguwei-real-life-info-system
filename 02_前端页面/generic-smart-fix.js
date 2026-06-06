// generic-smart-fix.js
// 通用智能识别修复 V2：
// 修复提交线索、采集目标、反馈页的智能识别。
// 不依赖旧识别逻辑，直接覆盖 parseGenericSmartText 和 confirmGenericSmartSubmit。
// 流程：识别 → 填表 → 显示预览 → 用户确认同步。

window.parseGenericSmartText = function () {
    try {
        genericFixProgress(10, "通用智能识别修复补丁已触发");

        const pageType = detectGenericPageTypeFixed();
        const input = document.getElementById("genericSmartInput");
        const text = input ? input.value.trim() : "";

        if (!pageType) {
            genericFixProgress(100, "未识别当前页面类型");
            alert("没有识别到当前页面类型。");
            return;
        }

        if (!text) {
            genericFixProgress(20, "输入为空");
            alert("请先粘贴一段信息。");
            return;
        }

        genericFixProgress(30, "已读取输入内容");

        let data = {};

        if (pageType === "clue") {
            data = parseClueTextFixed(text);
        } else if (pageType === "crawler") {
            data = parseCrawlerTextFixed(text);
        } else if (pageType === "clueFeedback" || pageType === "verifiedFeedback") {
            data = parseFeedbackTextFixed(text);
        }

        genericFixProgress(60, "已完成规则识别");

        fillGenericFormFixed(pageType, data);

        genericFixProgress(80, "已填入表单");

        const preview = document.getElementById("genericSmartPreview");
        if (preview) {
            preview.innerText =
                "已识别并填入表单，请检查无误后再点击“确认同步到系统”。\n\n" +
                buildGenericPreviewFixed(pageType, data);
        }

        const btn = document.getElementById("genericSmartConfirmBtn");
        if (btn) {
            btn.style.display = "inline-block";
        }

        genericFixProgress(100, "通用智能识别完成");
    } catch (error) {
        genericFixProgress(100, "通用智能识别报错：" + error.message);
        alert("智能识别报错：\n" + error.message);
    }
};

function detectGenericPageTypeFixed() {
    if (document.getElementById("clueTitle")) {
        return "clue";
    }

    if (document.getElementById("targetUrl")) {
        return "crawler";
    }

    if (document.getElementById("feedbackContent")) {
        if (location.pathname.includes("clue-detail")) {
            return "clueFeedback";
        }

        if (location.pathname.includes("item-detail")) {
            return "verifiedFeedback";
        }

        return "feedback";
    }

    return "";
}

function parseClueTextFixed(text) {
    const raw = String(text || "").trim();
    let working = normalizeGenericTextFixed(raw);

    const data = {
        title: "",
        category: "",
        source: "",
        url: "",
        summary: "",
        confidence: "中",
        inferred: [],
        warnings: []
    };

    const explicit = parseExplicitFieldsFixed(raw);
    Object.assign(data, explicit);

    if (!data.url) {
        const url = extractUrlFixed(working);
        if (url) {
            data.url = url;
            working = removeTextFixed(working, url);
        }
    }

    if (!data.category) {
        const category = findKeywordFixed(working, getCategoryKeywordsFixed());
        if (category) {
            data.category = category;
            working = removeTextFixed(working, category);
        }
    }

    if (!data.source) {
        const source = findKeywordFixed(working, getSourceKeywordsFixed());
        if (source) {
            data.source = source;
            working = removeTextFixed(working, source);
        }
    }

    if (!data.title) {
        const title = extractTitleFixed(working);
        if (title) {
            data.title = title;
            working = removeTextFixed(working, title);
        }
    }

    working = cleanTextFixed(working);

    if (!data.summary && working) {
        data.summary = working;
    }

    if (!data.category) {
        data.category = inferCategoryFixed(raw);
        data.inferred.push("分类");
    }

    if (!data.source) {
        data.source = "用户投稿";
        data.inferred.push("来源平台");
    }

    if (!data.title) {
        data.title = guessShortTextFixed(data.summary || raw, 18);
        data.inferred.push("线索标题");
    }

    if (!data.summary) {
        data.summary = "智能识别生成的线索，建议人工检查后提交。";
        data.inferred.push("线索简介");
    }

    data.summary = removeDuplicatePartsFixed(data.summary, [
        data.title,
        data.category,
        data.source,
        data.url
    ]);

    if (!data.title) {
        data.warnings.push("线索标题未明确识别");
    }

    if (!data.summary) {
        data.warnings.push("线索简介较少");
    }

    data.confidence = getConfidenceFixed(data);
    return data;
}

function parseCrawlerTextFixed(text) {
    const raw = String(text || "").trim();
    let working = normalizeGenericTextFixed(raw);

    const data = {
        url: "",
        category: "",
        source: "",
        summary: "",
        confidence: "中",
        inferred: [],
        warnings: []
    };

    const explicit = parseExplicitFieldsFixed(raw);
    Object.assign(data, explicit);

    if (!data.url) {
        const url = extractUrlFixed(working);
        if (url) {
            data.url = url;
            working = removeTextFixed(working, url);
        }
    }

    if (!data.category) {
        const category = findKeywordFixed(working, getCategoryKeywordsFixed());
        if (category) {
            data.category = category;
            working = removeTextFixed(working, category);
        }
    }

    if (!data.source) {
        const source = findKeywordFixed(working, getSourceKeywordsFixed());
        if (source) {
            data.source = source;
            working = removeTextFixed(working, source);
        }
    }

    working = cleanTextFixed(working);

    if (!data.summary && working) {
        data.summary = working;
    }

    if (!data.url) {
        data.warnings.push("采集网址未识别");
    }

    if (!data.category) {
        data.category = "外部线索";
        data.inferred.push("分类");
    }

    if (!data.source) {
        data.source = "公开网页自动采集";
        data.inferred.push("来源平台");
    }

    if (!data.summary) {
        data.summary = "智能识别生成的采集目标，建议人工检查。";
        data.inferred.push("备注");
    }

    data.confidence = getConfidenceFixed(data);
    return data;
}

function parseFeedbackTextFixed(text) {
    const raw = String(text || "").trim();
    let working = normalizeGenericTextFixed(raw);

    const data = {
        userName: "",
        feedbackType: "",
        feedbackContent: "",
        confidence: "中",
        inferred: [],
        warnings: []
    };

    const explicit = parseExplicitFieldsFixed(raw);
    Object.assign(data, explicit);

    if (!data.feedbackType) {
        const type = findKeywordFixed(working, getFeedbackTypeKeywordsFixed());
        if (type) {
            data.feedbackType = type;
            working = removeTextFixed(working, type);
        }
    }

    if (!data.userName) {
        const name = extractUserNameFixed(working);
        if (name) {
            data.userName = name;
            working = removeTextFixed(working, name);
        }
    }

    working = cleanTextFixed(working);

    if (!data.feedbackContent && working) {
        data.feedbackContent = working;
    }

    if (!data.feedbackType) {
        data.feedbackType = inferFeedbackTypeFixed(raw);
        data.inferred.push("反馈类型");
    }

    if (!data.userName) {
        data.userName = "匿名用户";
        data.inferred.push("昵称");
    }

    if (!data.feedbackContent) {
        data.feedbackContent = "智能识别生成的反馈，建议人工检查。";
        data.inferred.push("反馈内容");
        data.warnings.push("反馈内容较少");
    }

    data.feedbackContent = removeDuplicatePartsFixed(data.feedbackContent, [
        data.userName,
        data.feedbackType
    ]);

    data.confidence = getConfidenceFixed(data);
    return data;
}

function parseExplicitFieldsFixed(text) {
    const result = {};
    const lines = String(text || "").split(/\n+/);

    lines.forEach(line => {
        const clean = line.trim();
        if (!clean) return;

        const parts = clean.split(/[:：]/);
        if (parts.length < 2) return;

        const key = parts[0].trim();
        const value = parts.slice(1).join("：").trim();
        if (!value) return;

        const field = normalizeGenericFieldKeyFixed(key);
        if (field) {
            result[field] = value;
        }
    });

    return result;
}

function normalizeGenericFieldKeyFixed(key) {
    const map = {
        "标题": "title",
        "线索标题": "title",
        "名称": "title",
        "地点名称": "title",
        "店名": "title",

        "分类": "category",
        "类别": "category",

        "来源": "source",
        "来源平台": "source",
        "平台": "source",

        "链接": "url",
        "来源链接": "url",
        "网址": "url",
        "采集网址": "url",

        "简介": "summary",
        "说明": "summary",
        "描述": "summary",
        "备注": "summary",
        "内容": "summary",

        "昵称": "userName",
        "用户名": "userName",
        "用户": "userName",

        "反馈类型": "feedbackType",
        "类型": "feedbackType",

        "反馈内容": "feedbackContent",
        "反馈": "feedbackContent"
    };

    return map[key] || "";
}

function normalizeGenericTextFixed(text) {
    return String(text || "")
        .replace(/[，,。；;、|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCategoryKeywordsFixed() {
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

function getSourceKeywordsFixed() {
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

function getFeedbackTypeKeywordsFixed() {
    return [
        "补充信息",
        "真实反馈",
        "价格信息",
        "已过期",
        "纠错",
        "其他"
    ];
}

function extractUrlFixed(text) {
    const match = String(text || "").match(/https?:\/\/[^\s]+/);
    return match ? match[0] : "";
}

function findKeywordFixed(text, list) {
    const sorted = [...list].sort((a, b) => b.length - a.length);

    for (const item of sorted) {
        if (text.includes(item)) {
            return item;
        }
    }

    return "";
}

function removeTextFixed(text, part) {
    if (!part) return text;

    return String(text || "")
        .split(part)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractTitleFixed(text) {
    const suffixes = [
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
        "店",
        "点",
        "馆"
    ];

    const anchors = [
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

    suffixes.forEach(suffix => {
        let index = text.indexOf(suffix);

        while (index !== -1) {
            const end = index + suffix.length;
            let start = Math.max(0, index - 12);

            anchors.forEach(anchor => {
                const anchorIndex = text.lastIndexOf(anchor, index);
                if (anchorIndex !== -1) {
                    start = anchorIndex;
                }
            });

            let candidate = text.slice(start, end).trim();
            candidate = candidate.replace(/^测试/, "").replace(/^新增/, "").replace(/\s+/g, "");

            if (candidate.length >= 2) {
                candidates.push(candidate);
            }

            index = text.indexOf(suffix, index + 1);
        }
    });

    if (candidates.length === 0) {
        return "";
    }

    const unique = Array.from(new Set(candidates));

    unique.sort((a, b) => {
        const diff = scoreTitleFixed(b) - scoreTitleFixed(a);
        if (diff !== 0) return diff;
        return a.length - b.length;
    });

    return unique[0];
}

function scoreTitleFixed(title) {
    let score = 0;

    ["打印店", "烧烤店", "奶茶店", "咖啡店", "便利店", "理发店", "维修店", "餐厅", "超市", "公寓", "出租屋", "自习室", "快递点"].forEach(word => {
        if (title.includes(word)) score += 5;
    });

    ["广大", "广工", "华工", "中大", "星海", "广美", "广外", "贝岗", "北亭", "南亭", "大学城"].forEach(word => {
        if (title.includes(word)) score += 3;
    });

    if (title.length >= 3 && title.length <= 14) score += 2;
    if (title.includes("测试") || title.includes("说明") || title.includes("新增")) score -= 4;

    return score;
}

function extractUserNameFixed(text) {
    const explicitMatch = text.match(/(?:我是|昵称|用户|用户名)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9_]{2,10})/);
    if (explicitMatch) {
        return explicitMatch[1];
    }

    const tokens = text.split(/\s+/).filter(Boolean);

    if (tokens.length > 1) {
        const first = tokens[0];

        const badWords = ["这家店", "这个", "价格", "已经", "需要", "昨天", "今天", "信息", "反馈", "过期", "纠错"];
        if (first.length >= 2 && first.length <= 8 && !badWords.includes(first)) {
            return first;
        }
    }

    return "";
}

function inferCategoryFixed(text) {
    if (text.includes("租") || text.includes("公寓") || text.includes("房")) return "租房";
    if (text.includes("吃") || text.includes("烧烤") || text.includes("奶茶") || text.includes("咖啡") || text.includes("餐")) return "探店";
    if (text.includes("路线") || text.includes("citywalk")) return "路线";
    if (text.includes("打印") || text.includes("维修") || text.includes("快递") || text.includes("理发")) return "生活服务";
    if (text.includes("避坑") || text.includes("踩雷") || text.includes("虚假") || text.includes("不准")) return "避坑纠错";
    return "外部线索";
}

function inferFeedbackTypeFixed(text) {
    if (text.includes("过期") || text.includes("搬走") || text.includes("关门") || text.includes("不开")) return "已过期";
    if (text.includes("错") || text.includes("不准") || text.includes("不对")) return "纠错";
    if (text.includes("价格") || text.includes("涨") || text.includes("便宜") || text.includes("贵")) return "价格信息";
    if (text.includes("属实") || text.includes("去过") || text.includes("真实")) return "真实反馈";
    return "补充信息";
}

function cleanTextFixed(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function guessShortTextFixed(text, maxLength) {
    const cleaned = cleanTextFixed(text).replace(/\s+/g, "");
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength);
}

function removeDuplicatePartsFixed(text, parts) {
    let result = String(text || "");

    parts.forEach(part => {
        if (part) {
            result = removeTextFixed(result, part);
        }
    });

    result = cleanTextFixed(result);

    return result;
}

function getConfidenceFixed(data) {
    if (data.warnings && data.warnings.length > 0) {
        return "低";
    }

    if (data.inferred && data.inferred.length >= 2) {
        return "中";
    }

    return "高";
}

function fillGenericFormFixed(pageType, data) {
    if (pageType === "clue") {
        setInputFixed("clueTitle", data.title);
        setSelectFixed("clueCategory", data.category);
        setInputFixed("cluePlatform", data.source);
        setInputFixed("clueUrl", data.url);
        setInputFixed("clueSummary", data.summary);
        return;
    }

    if (pageType === "crawler") {
        setInputFixed("targetUrl", data.url);
        setSelectFixed("targetCategory", data.category);
        setInputFixed("targetPlatform", data.source);
        setInputFixed("targetNote", data.summary);
        return;
    }

    if (pageType === "clueFeedback" || pageType === "verifiedFeedback") {
        setInputFixed("feedbackUserName", data.userName);
        setSelectFixed("feedbackType", data.feedbackType);
        setInputFixed("feedbackContent", data.feedbackContent);
        return;
    }
}

function setInputFixed(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
        el.value = value;
    }
}

function setSelectFixed(id, value) {
    const el = document.getElementById(id);
    if (!el || !value) return;

    const matched = Array.from(el.options).find(option => option.value === value || option.text === value);

    if (matched) {
        el.value = matched.value;
    }
}

function buildGenericPreviewFixed(pageType, data) {
    const base = [
        "识别置信度：" + (data.confidence || "中"),
        "推断字段：" + ((data.inferred && data.inferred.length > 0) ? data.inferred.join("、") : "无"),
        "不确定项：" + ((data.warnings && data.warnings.length > 0) ? data.warnings.join("；") : "无"),
        ""
    ];

    if (pageType === "clue") {
        return base.concat([
            "线索标题：" + (data.title || "未识别"),
            "分类：" + (data.category || "未识别"),
            "来源平台：" + (data.source || "未识别"),
            "来源链接：" + (data.url || "未识别"),
            "线索简介：" + (data.summary || "未识别")
        ]).join("\n");
    }

    if (pageType === "crawler") {
        return base.concat([
            "采集网址：" + (data.url || "未识别"),
            "分类：" + (data.category || "未识别"),
            "来源平台：" + (data.source || "未识别"),
            "备注：" + (data.summary || "未识别")
        ]).join("\n");
    }

    return base.concat([
        "昵称：" + (data.userName || "匿名用户"),
        "反馈类型：" + (data.feedbackType || "未识别"),
        "反馈内容：" + (data.feedbackContent || "未识别")
    ]).join("\n");
}

window.confirmGenericSmartSubmit = function () {
    const pageType = detectGenericPageTypeFixed();

    if (pageType === "clue") {
        if (!document.getElementById("clueTitle").value.trim()) {
            alert("线索标题为空，不能同步。");
            return;
        }

        if (confirm("确认将当前线索表单同步到系统吗？")) {
            submitClue();
        }

        return;
    }

    if (pageType === "crawler") {
        if (!document.getElementById("targetUrl").value.trim()) {
            alert("采集网址为空，不能同步。");
            return;
        }

        if (confirm("确认将当前采集目标同步到系统吗？")) {
            submitCrawlTarget();
        }

        return;
    }

    if (pageType === "clueFeedback") {
        if (!document.getElementById("feedbackContent").value.trim()) {
            alert("反馈内容为空，不能同步。");
            return;
        }

        if (confirm("确认提交当前线索反馈吗？")) {
            submitFeedback("clue");
        }

        return;
    }

    if (pageType === "verifiedFeedback") {
        if (!document.getElementById("feedbackContent").value.trim()) {
            alert("反馈内容为空，不能同步。");
            return;
        }

        if (confirm("确认提交当前真实库反馈吗？")) {
            submitFeedback("verified");
        }

        return;
    }
};

function genericFixProgress(percent, text) {
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

    console.log("[通用智能识别修复]", text);
}