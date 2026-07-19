// smart-progress.js
// 通用智能识别进度条 + 诊断器
// 作用：显示“按钮是否触发、输入是否读取、核心函数是否存在、识别是否成功、填表是否成功”。

(function () {
    window.addEventListener("load", () => {
        injectSmartProgressBox();
        patchSmartFunctions();
        smartLog("智能识别诊断器已加载", "ok");
    });

    function injectSmartProgressBox() {
        if (document.getElementById("smartProgressBox")) {
            return;
        }

        const smartInput =
            document.getElementById("mapSmartInput") ||
            document.getElementById("genericSmartInput") ||
            document.getElementById("routeSmartInput");

        if (!smartInput) {
            return;
        }

        const box = document.createElement("div");
        box.id = "smartProgressBox";
        box.className = "crawl-result-box";
        box.style.marginTop = "14px";

        box.innerHTML = `
            <div><strong>智能识别进度</strong></div>
            <div style="margin-top:8px; background:#e5e5e5; border-radius:8px; overflow:hidden;">
                <div id="smartProgressBar" style="width:0%; height:12px; background:#1f7a4d;"></div>
            </div>
            <div id="smartProgressText" style="margin-top:8px;">等待操作</div>
            <pre id="smartProgressLog" style="white-space:pre-wrap; font-size:13px; color:#555; margin-top:8px;"></pre>
        `;

        const smartBox = smartInput.closest(".box");

        if (smartBox) {
            smartBox.appendChild(box);
        }
    }

    function setProgress(percent, text) {
        const bar = document.getElementById("smartProgressBar");
        const label = document.getElementById("smartProgressText");

        if (bar) {
            bar.style.width = percent + "%";
        }

        if (label) {
            label.innerText = text;
        }
    }

    function smartLog(message, type) {
        const logBox = document.getElementById("smartProgressLog");
        const time = new Date().toLocaleTimeString();
        const tag = type === "error" ? "❌" : type === "ok" ? "✅" : "ℹ️";

        console.log("[智能识别]", message);

        if (logBox) {
            logBox.innerText += `[${time}] ${tag} ${message}\n`;
        }
    }

    function clearLog() {
        const logBox = document.getElementById("smartProgressLog");
        if (logBox) {
            logBox.innerText = "";
        }
        setProgress(0, "准备开始");
    }

    function patchSmartFunctions() {
        patchMapSmart();
        patchGenericSmart();
        patchRouteSmart();
    }

    function patchMapSmart() {
        if (!document.getElementById("mapSmartInput")) {
            return;
        }

        window.parseMapSmartText = function () {
            clearLog();

            try {
                setProgress(10, "已点击智能识别按钮");
                smartLog("按钮触发成功", "ok");

                const input = document.getElementById("mapSmartInput");
                const rawText = input ? input.value.trim() : "";

                if (!rawText) {
                    setProgress(20, "输入为空");
                    smartLog("没有读取到输入内容", "error");
                    alert("请先粘贴一段地点信息。");
                    return;
                }

                setProgress(30, "已读取输入内容");
                smartLog("输入内容：" + rawText, "ok");

                let result = null;

                if (window.SmartCore && typeof window.SmartCore.parseMapPoint === "function") {
                    setProgress(45, "检测到 smart-core.js，正在调用 V2 识别核心");
                    smartLog("SmartCore.parseMapPoint 存在", "ok");
                    result = window.SmartCore.parseMapPoint(rawText);
                } else {
                    setProgress(45, "未检测到 smart-core.js，启用备用识别逻辑");
                    smartLog("SmartCore 不存在或未加载，使用备用识别", "error");
                    result = fallbackParseMap(rawText);
                }

                setProgress(65, "识别完成，准备填表");
                smartLog("识别结果：" + JSON.stringify(result, null, 2), "ok");

                if (typeof window.fillMapForm === "function") {
                    window.fillMapForm(result);
                    smartLog("已调用 fillMapForm 填表", "ok");
                } else {
                    fallbackFillMapForm(result);
                    smartLog("fillMapForm 不存在，已使用备用填表", "error");
                }

                const previewBox = document.getElementById("mapSmartPreview");
                if (previewBox) {
                    previewBox.innerText =
                        "已识别并填入下方表单，请检查无误后再点击“确认同步到系统”。\n\n" +
                        buildMapPreview(result);
                } else {
                    smartLog("未找到 mapSmartPreview 预览框", "error");
                }

                const confirmBtn = document.getElementById("mapSmartConfirmBtn");
                if (confirmBtn) {
                    confirmBtn.style.display = "inline-block";
                    smartLog("确认同步按钮已显示", "ok");
                } else {
                    smartLog("未找到 mapSmartConfirmBtn 按钮", "error");
                }

                setProgress(100, "智能识别完成");
            } catch (error) {
                setProgress(100, "识别过程报错");
                smartLog("错误信息：" + error.message, "error");
                alert("智能识别报错，请把进度日志发给我。\n\n" + error.message);
            }
        };
    }

    function patchGenericSmart() {
        if (!document.getElementById("genericSmartInput")) {
            return;
        }

        const oldParse = window.parseGenericSmartText;

        window.parseGenericSmartText = function () {
            clearLog();

            try {
                setProgress(10, "已点击智能识别按钮");
                smartLog("通用识别按钮触发成功", "ok");

                const input = document.getElementById("genericSmartInput");
                const rawText = input ? input.value.trim() : "";

                if (!rawText) {
                    setProgress(20, "输入为空");
                    smartLog("没有读取到输入内容", "error");
                    alert("请先粘贴一段信息。");
                    return;
                }

                setProgress(30, "已读取输入内容");
                smartLog("输入内容：" + rawText, "ok");

                if (typeof oldParse === "function") {
                    setProgress(55, "正在调用原通用识别函数");
                    oldParse();
                    setProgress(100, "通用智能识别完成");
                    smartLog("原通用识别函数执行完毕", "ok");
                } else {
                    setProgress(100, "识别函数不存在");
                    smartLog("parseGenericSmartText 不存在，说明 generic-smart-fill.js 没有加载成功", "error");
                    alert("通用智能识别函数没有加载成功，请检查 generic-smart-fill.js 是否引用。");
                }
            } catch (error) {
                setProgress(100, "识别过程报错");
                smartLog("错误信息：" + error.message, "error");
                alert("智能识别报错，请把进度日志发给我。\n\n" + error.message);
            }
        };
    }

    function patchRouteSmart() {
        if (!document.getElementById("routeSmartInput")) {
            return;
        }

        const oldParse = window.parseRouteSmartText;

        window.parseRouteSmartText = function () {
            clearLog();

            try {
                setProgress(10, "已点击路线智能识别按钮");
                smartLog("路线识别按钮触发成功", "ok");

                const input = document.getElementById("routeSmartInput");
                const rawText = input ? input.value.trim() : "";

                if (!rawText) {
                    setProgress(20, "输入为空");
                    smartLog("没有读取到输入内容", "error");
                    alert("请先输入一段路线信息。");
                    return;
                }

                setProgress(30, "已读取输入内容");
                smartLog("输入内容：" + rawText, "ok");

                if (typeof oldParse === "function") {
                    setProgress(55, "正在调用原路线识别函数");
                    oldParse();
                    setProgress(100, "路线智能识别完成");
                    smartLog("原路线识别函数执行完毕", "ok");
                } else {
                    setProgress(100, "路线识别函数不存在");
                    smartLog("parseRouteSmartText 不存在，说明 route-smart-fill.js 没有加载成功", "error");
                    alert("路线智能识别函数没有加载成功，请检查 route-smart-fill.js 是否引用。");
                }
            } catch (error) {
                setProgress(100, "识别过程报错");
                smartLog("错误信息：" + error.message, "error");
                alert("智能识别报错，请把进度日志发给我。\n\n" + error.message);
            }
        };
    }

    function fallbackParseMap(text) {
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
            confidence: "低"
        };

        const raw = String(text || "").trim();

        const categories = ["生活服务", "避坑纠错", "外部线索", "测试线索", "探店", "租房", "地图", "路线"];
        const mapTypes = ["生活地点", "美食地图", "租房地图", "游玩地图", "citywalk路线", "避坑地图"];
        const sources = ["手动测试", "手动添加", "用户投稿", "管理员整理", "公开网页", "自动采集"];

        result.category = findKeyword(raw, categories);
        result.mapType = findKeyword(raw, mapTypes);
        result.source = findKeyword(raw, sources);

        const addressMatch = raw.match(/(广州大学城[\u4e00-\u9fa5A-Za-z0-9]{0,20}|大学城[\u4e00-\u9fa5A-Za-z0-9]{0,20}|广大附近|贝岗|北亭|南亭|广工|华工|中大|星海|广美|广外)/);
        if (addressMatch) {
            result.address = addressMatch[0];
        }

        const nameMatch = raw.match(/[\u4e00-\u9fa5A-Za-z0-9]{0,12}(打印店|烧烤店|奶茶店|咖啡店|便利店|理发店|维修店|餐厅|饭店|超市|公寓|出租屋|自习室|快递点|地铁站|店|点|馆)/);
        if (nameMatch) {
            result.name = nameMatch[0];
        }

        if (!result.category) {
            if (raw.includes("打印") || raw.includes("维修") || raw.includes("快递")) {
                result.category = "生活服务";
            } else if (raw.includes("吃") || raw.includes("烧烤") || raw.includes("奶茶")) {
                result.category = "探店";
            } else {
                result.category = "外部线索";
            }
            result.inferred.push("分类");
        }

        if (!result.mapType) {
            result.mapType = result.category === "生活服务" ? "生活地点" : "生活地点";
            result.inferred.push("地图类型");
        }

        if (!result.source) {
            result.source = "手动添加";
            result.inferred.push("来源");
        }

        let desc = raw;
        [result.name, result.category, result.address, result.mapType, result.source].forEach(part => {
            if (part) {
                desc = desc.split(part).join(" ");
            }
        });

        result.description = desc.replace(/\s+/g, " ").trim() || "备用识别生成的信息，请人工检查。";

        if (!result.name) {
            result.warnings.push("地点名称未明确识别");
        }

        if (!result.address) {
            result.warnings.push("地址/区域未明确识别");
        }

        return result;
    }

    function fallbackFillMapForm(data) {
        setInputValue("mapName", data.name);
        setSelectValue("mapCategory", data.category);
        setInputValue("mapAddress", data.address);
        setInputValue("mapLatitude", data.latitude);
        setInputValue("mapLongitude", data.longitude);
        setSelectValue("mapType", data.mapType);
        setSelectValue("mapTargetType", data.targetType);
        setInputValue("mapTargetId", data.targetId);
        setInputValue("mapSource", data.source);
        setInputValue("mapDescription", data.description);
    }

    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el && value) {
            el.value = value;
        }
    }

    function setSelectValue(id, value) {
        const el = document.getElementById(id);
        if (!el || !value) return;

        const matched = Array.from(el.options).find(option => option.value === value || option.text === value);

        if (matched) {
            el.value = matched.value;
        }
    }

    function findKeyword(text, list) {
        const sorted = [...list].sort((a, b) => b.length - a.length);
        return sorted.find(item => text.includes(item)) || "";
    }

    function buildMapPreview(data) {
        const inferredText = data.inferred && data.inferred.length > 0 ? data.inferred.join("、") : "无";
        const warningText = data.warnings && data.warnings.length > 0 ? data.warnings.join("；") : "无";

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
})();