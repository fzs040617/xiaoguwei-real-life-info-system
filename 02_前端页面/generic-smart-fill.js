// generic-smart-fill.js
// 通用智能识别填表：用于提交线索、采集目标、详情页反馈。
// 流程：自由文本识别 → 自动填表 → 用户检查 → 确认同步。
// 这是规则版，后续可升级为 AI 识别版。

let genericSmartPageType = "";
let genericSmartLatestData = null;

window.addEventListener("load", () => {
    detectGenericSmartPage();
    injectGenericSmartBox();
});

function detectGenericSmartPage() {
    if (document.getElementById("clueTitle")) {
        genericSmartPageType = "clue";
        return;
    }

    if (document.getElementById("targetUrl")) {
        genericSmartPageType = "crawler";
        return;
    }

    if (document.getElementById("feedbackContent")) {
        if (location.pathname.includes("clue-detail")) {
            genericSmartPageType = "clueFeedback";
            return;
        }

        if (location.pathname.includes("item-detail")) {
            genericSmartPageType = "verifiedFeedback";
            return;
        }

        genericSmartPageType = "feedback";
        return;
    }
}

function injectGenericSmartBox() {
    if (!genericSmartPageType) {
        return;
    }

    if (document.getElementById("genericSmartBox")) {
        return;
    }

    const container = document.querySelector(".container");
    if (!container) {
        return;
    }

    const box = document.createElement("div");
    box.className = "box";
    box.id = "genericSmartBox";

    box.innerHTML = `
        <h2>${getGenericSmartTitle()}</h2>
        <p class="notice">
            可以直接粘贴一段自然语言信息，系统会尽量识别并填入表单。识别可能有偏差，请检查后再点击“确认同步到系统”。
        </p>

        <div class="form-row">
            <label>粘贴信息</label>
            <textarea id="genericSmartInput" placeholder="${getGenericSmartPlaceholder()}"></textarea>
        </div>

        <button onclick="parseGenericSmartText()">智能识别填表</button>
        <button id="genericSmartConfirmBtn" style="margin-left: 8px; display:none;" onclick="confirmGenericSmartSubmit()">确认同步到系统</button>
        <button style="margin-left: 8px;" onclick="clearGenericSmartInput()">清空</button>

        <div id="genericSmartPreview" class="crawl-result-box" style="margin-top: 14px;"></div>
    `;

    const firstBox = container.querySelector(".box");

    if (firstBox) {
        firstBox.insertAdjacentElement("beforebegin", box);
    } else {
        container.prepend(box);
    }
}

function getGenericSmartTitle() {
    if (genericSmartPageType === "clue") {
        return "智能识别提交线索";
    }

    if (genericSmartPageType === "crawler") {
        return "智能识别采集目标";
    }

    if (genericSmartPageType === "clueFeedback" || genericSmartPageType === "verifiedFeedback" || genericSmartPageType === "feedback") {
        return "智能识别用户反馈";
    }

    return "智能识别填表";
}

function getGenericSmartPlaceholder() {
    if (genericSmartPageType === "clue") {
        return "例如：贝岗夜宵烧烤 探店 用户投稿 https://example.com 昨天路过看到还在营业，价格大概人均30，需要核验";
    }

    if (genericSmartPageType === "crawler") {
        return "例如：https://www.iana.org/domains/reserved 外部线索 公开网页 测试采集目标";
    }

    return "例如：测试用户 已过期 这家店已经搬走了，需要管理员复核";
}

function parseGenericSmartText() {
    const input = document.getElementById("genericSmartInput");
    const rawText = input.value.trim();

    if (!rawText) {
        alert("请先粘贴一段信息。");
        return;
    }

    let data = parseGenericKeyValueText(rawText);

    if (Object.keys(data).length === 0) {
        if (genericSmartPageType === "clue") {
            data = parseSmartClueText(rawText);
        } else if (genericSmartPageType === "crawler") {
            data = parseSmartCrawlerText(rawText);
        } else {
            data = parseSmartFeedbackText(rawText);
        }
    }

    genericSmartLatestData = data;
    fillGenericForm(data);

    document.getElementById("genericSmartPreview").innerText =
        "已识别并填入表单，请检查无误后再点击“确认同步到系统”。\n\n" + buildGenericPreview(data);

    const btn = document.getElementById("genericSmartConfirmBtn");
    if (btn) {
        btn.style.display = "inline-block";
    }
}

function parseGenericKeyValueText(text) {
    const lines = text.split(/\n+/);
    const result = {};

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const parts = cleanLine.split(/[:：]/);
        if (parts.length < 2) return;

        const key = parts[0].trim();
        const value = parts.slice(1).join("：").trim();
        if (!value) return;

        const field = normalizeGenericKey(key);
        if (field) {
            result[field] = value;
        }
    });

    return result;
}

function normalizeGenericKey(key) {
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

    return map[key] || null;
}

function parseSmartClueText(text) {
    let workingText = normalizeSmartText(text);
    const result = {};

    const url = extractUrl(workingText);
    if (url) {
        result.url = url;
        workingText = removeAllKeyword(workingText, url);
    }

    const category = findFirstKeyword(workingText, getCategoryList());
    if (category) {
        result.category = category;
        workingText = removeAllKeyword(workingText, category);
    }

    const source = findFirstKeyword(workingText, getSourceList());
    if (source) {
        result.source = source;
        workingText = removeAllKeyword(workingText, source);
    }

    const title = extractClueTitle(workingText);
    if (title) {
        result.title = title;
        workingText = removeAllKeyword(workingText, title);
    }

    workingText = cleanRemainingText(workingText);
    if (workingText) {
        result.summary = workingText;
    }

    if (!result.title && result.summary) {
        result.title = guessShortTitle(result.summary);
    }

    if (!result.category) {
        result.category = inferCategoryFromText(text);
    }

    if (!result.source) {
        result.source = "用户投稿";
    }

    return result;
}

function parseSmartCrawlerText(text) {
    let workingText = normalizeSmartText(text);
    const result = {};

    const url = extractUrl(workingText);
    if (url) {
        result.url = url;
        workingText = removeAllKeyword(workingText, url);
    }

    const category = findFirstKeyword(workingText, getCategoryList());
    if (category) {
        result.category = category;
        workingText = removeAllKeyword(workingText, category);
    }

    const source = findFirstKeyword(workingText, getSourceList());
    if (source) {
        result.source = source;
        workingText = removeAllKeyword(workingText, source);
    }

    workingText = cleanRemainingText(workingText);
    if (workingText) {
        result.summary = workingText;
    }

    if (!result.category) {
        result.category = "外部线索";
    }

    if (!result.source) {
        result.source = "公开网页自动采集";
    }

    return result;
}

function parseSmartFeedbackText(text) {
    let workingText = normalizeSmartText(text);
    const result = {};

    const feedbackTypeList = ["补充信息", "真实反馈", "纠错", "已过期", "价格信息", "其他"];
    const feedbackType = findFirstKeyword(workingText, feedbackTypeList);

    if (feedbackType) {
        result.feedbackType = feedbackType;
        workingText = removeAllKeyword(workingText, feedbackType);
    }

    const userName = extractUserName(workingText);
    if (userName) {
        result.userName = userName;
        workingText = removeAllKeyword(workingText, userName);
    }

    workingText = cleanRemainingText(workingText);
    if (workingText) {
        result.feedbackContent = workingText;
    }

    if (!result.feedbackType) {
        result.feedbackType = inferFeedbackTypeFromText(text);
    }

    return result;
}

function getCategoryList() {
    return ["生活服务", "避坑纠错", "外部线索", "探店", "租房", "地图", "路线", "测试线索"];
}

function getSourceList() {
    return [
        "手动测试",
        "用户投稿",
        "管理员整理",
        "公开网页自动采集",
        "公开网页",
        "前端配置采集",
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

function normalizeSmartText(text) {
    return String(text || "")
        .replace(/[，,。；;、|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : "";
}

function findFirstKeyword(text, keywordList) {
    const sortedList = [...keywordList].sort((a, b) => b.length - a.length);

    for (const keyword of sortedList) {
        if (text.includes(keyword)) {
            return keyword;
        }
    }

    return "";
}

function removeAllKeyword(text, keyword) {
    if (!keyword) return text;

    return text
        .split(keyword)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractClueTitle(text) {
    const suffixList = [
        "打印店", "烧烤店", "奶茶店", "咖啡店", "便利店", "理发店", "维修店", "药店",
        "餐厅", "饭店", "烧烤", "奶茶", "咖啡", "超市", "公寓", "出租屋", "自习室",
        "快递点", "维修点", "驿站", "饭堂", "食堂", "地铁站", "商业中心", "店", "点", "馆"
    ];

    const anchorList = [
        "广大附近", "广工附近", "华工附近", "中大附近", "星海附近", "广美附近", "广外附近",
        "贝岗", "北亭", "南亭", "广大", "广工", "华工", "中大", "星海", "广美", "广外",
        "大学城南", "大学城北", "大学城"
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

            const candidate = text.slice(start, end).trim();

            if (candidate.length >= 2) {
                candidates.push(candidate);
            }

            index = text.indexOf(suffix, index + 1);
        }
    });

    if (candidates.length === 0) {
        return "";
    }

    candidates.sort((a, b) => {
        const scoreDiff = scoreTitle(b) - scoreTitle(a);
        if (scoreDiff !== 0) return scoreDiff;
        return a.length - b.length;
    });

    return candidates[0];
}

function scoreTitle(title) {
    let score = 0;

    ["店", "点", "馆", "公寓", "出租屋", "地铁站", "商业中心"].forEach(word => {
        if (title.includes(word)) score += 4;
    });

    ["广大", "广工", "华工", "中大", "星海", "广美", "广外", "贝岗", "北亭", "南亭", "大学城"].forEach(word => {
        if (title.includes(word)) score += 2;
    });

    if (title.length >= 3 && title.length <= 14) score += 2;
    if (title.includes("测试") || title.includes("说明") || title.includes("新增")) score -= 3;

    return score;
}

function extractUserName(text) {
    const match = text.match(/(用户|昵称|我是)?([\u4e00-\u9fa5A-Za-z0-9_]{2,8})(说|反馈|认为)?/);

    if (!match) {
        return "";
    }

    const candidate = match[2];

    const badWords = ["这家店", "这个", "价格", "已经", "需要", "昨天", "今天", "信息", "反馈"];
    if (badWords.includes(candidate)) {
        return "";
    }

    return candidate;
}

function cleanRemainingText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

function inferCategoryFromText(text) {
    if (text.includes("租") || text.includes("公寓") || text.includes("房")) return "租房";
    if (text.includes("吃") || text.includes("烧烤") || text.includes("奶茶") || text.includes("咖啡") || text.includes("餐")) return "探店";
    if (text.includes("路线") || text.includes("citywalk")) return "路线";
    if (text.includes("打印") || text.includes("维修") || text.includes("快递") || text.includes("理发")) return "生活服务";
    if (text.includes("避坑") || text.includes("不准") || text.includes("虚假")) return "避坑纠错";
    return "外部线索";
}

function inferFeedbackTypeFromText(text) {
    if (text.includes("过期") || text.includes("搬走") || text.includes("关门") || text.includes("不开")) return "已过期";
    if (text.includes("错") || text.includes("不准") || text.includes("不对")) return "纠错";
    if (text.includes("价格") || text.includes("涨") || text.includes("便宜") || text.includes("贵")) return "价格信息";
    if (text.includes("属实") || text.includes("去过") || text.includes("真实")) return "真实反馈";
    return "补充信息";
}

function guessShortTitle(text) {
    const cleaned = cleanRemainingText(text);
    if (cleaned.length <= 16) return cleaned;
    return cleaned.slice(0, 16);
}

function fillGenericForm(data) {
    if (genericSmartPageType === "clue") {
        if (data.title) document.getElementById("clueTitle").value = data.title;
        if (data.category) setSelectValue("clueCategory", data.category);
        if (data.source) document.getElementById("cluePlatform").value = data.source;
        if (data.url) document.getElementById("clueUrl").value = data.url;
        if (data.summary) document.getElementById("clueSummary").value = data.summary;
        return;
    }

    if (genericSmartPageType === "crawler") {
        if (data.url) document.getElementById("targetUrl").value = data.url;
        if (data.category) setSelectValue("targetCategory", data.category);
        if (data.source) document.getElementById("targetPlatform").value = data.source;
        if (data.summary) document.getElementById("targetNote").value = data.summary;
        return;
    }

    if (genericSmartPageType === "clueFeedback" || genericSmartPageType === "verifiedFeedback" || genericSmartPageType === "feedback") {
        if (data.userName) document.getElementById("feedbackUserName").value = data.userName;
        if (data.feedbackType) setSelectValue("feedbackType", data.feedbackType);
        if (data.feedbackContent) document.getElementById("feedbackContent").value = data.feedbackContent;
        return;
    }
}

function setSelectValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select || !value) return;

    const options = Array.from(select.options);
    const matched = options.find(option => option.value === value || option.text === value);

    if (matched) {
        select.value = matched.value;
    }
}

function confirmGenericSmartSubmit() {
    if (genericSmartPageType === "clue") {
        if (!document.getElementById("clueTitle").value.trim()) {
            alert("线索标题为空，不能同步。请先检查识别结果。");
            return;
        }

        if (confirm("确认将当前线索表单同步到系统吗？")) {
            submitClue();
        }

        return;
    }

    if (genericSmartPageType === "crawler") {
        if (!document.getElementById("targetUrl").value.trim()) {
            alert("采集网址为空，不能同步。请先检查识别结果。");
            return;
        }

        if (confirm("确认将当前采集目标同步到系统吗？")) {
            submitCrawlTarget();
        }

        return;
    }

    if (genericSmartPageType === "clueFeedback") {
        if (!document.getElementById("feedbackContent").value.trim()) {
            alert("反馈内容为空，不能同步。请先检查识别结果。");
            return;
        }

        if (confirm("确认提交当前线索反馈吗？")) {
            submitFeedback("clue");
        }

        return;
    }

    if (genericSmartPageType === "verifiedFeedback") {
        if (!document.getElementById("feedbackContent").value.trim()) {
            alert("反馈内容为空，不能同步。请先检查识别结果。");
            return;
        }

        if (confirm("确认提交当前真实库反馈吗？")) {
            submitFeedback("verified");
        }

        return;
    }
}

function buildGenericPreview(data) {
    if (genericSmartPageType === "clue") {
        return [
            "线索标题：" + (data.title || "未识别"),
            "分类：" + (data.category || "未识别"),
            "来源平台：" + (data.source || "未识别"),
            "来源链接：" + (data.url || "未识别"),
            "线索简介：" + (data.summary || "未识别")
        ].join("\n");
    }

    if (genericSmartPageType === "crawler") {
        return [
            "采集网址：" + (data.url || "未识别"),
            "分类：" + (data.category || "未识别"),
            "来源平台：" + (data.source || "未识别"),
            "备注：" + (data.summary || "未识别")
        ].join("\n");
    }

    return [
        "昵称：" + (data.userName || "匿名用户/未识别"),
        "反馈类型：" + (data.feedbackType || "未识别"),
        "反馈内容：" + (data.feedbackContent || "未识别")
    ].join("\n");
}

function clearGenericSmartInput() {
    document.getElementById("genericSmartInput").value = "";
    document.getElementById("genericSmartPreview").innerText = "";
    genericSmartLatestData = null;

    const btn = document.getElementById("genericSmartConfirmBtn");
    if (btn) {
        btn.style.display = "none";
    }
}