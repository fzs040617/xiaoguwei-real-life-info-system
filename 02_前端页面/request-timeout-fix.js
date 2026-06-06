// request-timeout-fix.js
// 请求诊断修复版：
// 1. 默认只写入 console，不再把请求日志追加到页面正文
// 2. 需要页面内诊断框时，可手动设置 window.XGW_SHOW_REQUEST_DEBUG_BOX = true

(function () {
    if (window.__REQUEST_TIMEOUT_FIX_LOADED__) {
        return;
    }

    window.__REQUEST_TIMEOUT_FIX_LOADED__ = true;

    const ORIGINAL_FETCH = window.fetch;
    const DEFAULT_TIMEOUT = 8000;

    window.fetch = async function (url, options = {}) {
        const controller = new AbortController();
        const timeout = options.timeout || DEFAULT_TIMEOUT;

        const timer = setTimeout(() => {
            controller.abort();
        }, timeout);

        const finalOptions = {
            ...options,
            signal: controller.signal
        };

        showRequestDebug("正在请求：" + url);

        try {
            const response = await ORIGINAL_FETCH(url, finalOptions);
            clearTimeout(timer);

            showRequestDebug("请求完成：" + url + "，状态码：" + response.status);

            return response;
        } catch (error) {
            clearTimeout(timer);

            if (error.name === "AbortError") {
                showRequestDebug("请求超时：" + url + "。后端 8 秒内没有返回。");
                throw new Error("请求超时：后端接口 8 秒内没有返回。请检查 /docs 是否能打开。");
            }

            showRequestDebug("请求失败：" + url + "，错误：" + error.message);
            throw error;
        }
    };

    function showRequestDebug(text) {
        console.log("[请求诊断]", text);

        if (!window.XGW_SHOW_REQUEST_DEBUG_BOX) {
            return;
        }

        const time = new Date().toLocaleTimeString();
        const line = `[${time}] ${text}\n`;

        const smartLog = document.getElementById("smartProgressLog");
        if (smartLog) {
            smartLog.innerText += line;
            smartLog.scrollTop = smartLog.scrollHeight;
            return;
        }

        let box = document.getElementById("requestDebugBox");

        if (!box) {
            box = document.createElement("div");
            box.id = "requestDebugBox";
            box.className = "crawl-result-box";
            box.style.margin = "12px auto";
            box.style.maxWidth = "1100px";
            box.style.fontSize = "13px";

            const container = document.querySelector(".container");
            if (container) {
                container.prepend(box);
            } else {
                document.body.prepend(box);
            }
        }

        box.innerText += line;
    }
})();
