// feedback-history-link.js
// 反馈联动更新历史 V2：
// 用户提交反馈成功后，给被反馈对象写入“收到反馈”历史。
// 写入历史成功后自动刷新当前详情页，让用户立刻看到更新后的反馈和历史。

const FEEDBACK_HISTORY_LINK_API = "http://127.0.0.1:8000";

(function () {
    let feedbackHistoryReloading = false;

    window.addEventListener("load", () => {
        setTimeout(patchFeedbackSubmitFunctions, 600);
    });

    function patchFeedbackSubmitFunctions() {
        patchMapRouteFeedback();
        patchClueItemFeedback();
    }

    function patchMapRouteFeedback() {
        if (typeof window.submitMapRouteFeedback !== "function") {
            return;
        }

        const oldSubmit = window.submitMapRouteFeedback;

        window.submitMapRouteFeedback = async function () {
            const targetInfo = getMapRouteTargetInfoBeforeSubmit();

            await oldSubmit();

            const message = document.getElementById("mapRouteFeedbackMessage");
            const text = message ? message.innerText || "" : "";

            if (text.includes("反馈提交成功")) {
                const recorded = await recordFeedbackHistory(targetInfo);

                if (recorded) {
                    showFeedbackRefreshMessage(message);
                    refreshCurrentDetailPage();
                }
            }
        };
    }

    function patchClueItemFeedback() {
        if (typeof window.submitFeedback !== "function") {
            return;
        }

        const oldSubmit = window.submitFeedback;

        window.submitFeedback = async function (targetType) {
            const targetInfo = getClueItemTargetInfoBeforeSubmit(targetType);

            await oldSubmit(targetType);

            const message = document.getElementById("feedbackMessage");
            const text = message ? message.innerText || "" : "";

            if (text.includes("反馈提交成功")) {
                const recorded = await recordFeedbackHistory(targetInfo);

                if (recorded) {
                    showFeedbackRefreshMessage(message);
                    refreshCurrentDetailPage();
                }
            }
        };
    }

    function getMapRouteTargetInfoBeforeSubmit() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");

        let targetType = "";
        let title = "";

        if (location.pathname.includes("map-detail")) {
            targetType = "map_point";
            title = getDetailPageTitle();
        }

        if (location.pathname.includes("route-detail")) {
            targetType = "route";
            title = getDetailPageTitle();
        }

        const feedbackType = getValue("mapRouteFeedbackType") || "补充信息";
        const content = getValue("mapRouteFeedbackContent");

        return {
            targetType,
            targetId: id,
            title,
            feedbackType,
            content
        };
    }

    function getClueItemTargetInfoBeforeSubmit(targetType) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");

        const feedbackType = getValue("feedbackType") || "补充信息";
        const content = getValue("feedbackContent");

        return {
            targetType,
            targetId: id,
            title: getDetailPageTitle(),
            feedbackType,
            content
        };
    }

    function getDetailPageTitle() {
        const detailBox = document.getElementById("detailBox");

        if (!detailBox) {
            return document.title || "未命名对象";
        }

        const h2 = detailBox.querySelector("h2");
        const h3 = detailBox.querySelector("h3");
        const h1 = detailBox.querySelector("h1");

        if (h2 && h2.innerText.trim()) {
            return h2.innerText.trim();
        }

        if (h3 && h3.innerText.trim()) {
            return h3.innerText.trim();
        }

        if (h1 && h1.innerText.trim()) {
            return h1.innerText.trim();
        }

        return document.title || "未命名对象";
    }

    async function recordFeedbackHistory(info) {
        if (!info || !info.targetType || !info.targetId) {
            return false;
        }

        const shortContent = info.content && info.content.length > 80
            ? info.content.slice(0, 80) + "..."
            : info.content || "暂无反馈内容";

        try {
            const response = await fetch(`${FEEDBACK_HISTORY_LINK_API}/update-history`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    target_type: info.targetType,
                    target_id: Number(info.targetId),
                    action: "收到反馈",
                    title: info.title || "未命名对象",
                    detail: `反馈类型：${info.feedbackType || "补充信息"}；反馈内容：${shortContent}`,
                    operator: "用户反馈"
                })
            });

            if (!response.ok) {
                console.log("[反馈历史] 记录失败，后端返回非 200");
                return false;
            }

            console.log("[反馈历史] 已记录", info);
            return true;
        } catch (error) {
            console.log("[反馈历史] 记录失败", error);
            return false;
        }
    }

    function showFeedbackRefreshMessage(messageBox) {
        if (!messageBox) {
            return;
        }

        messageBox.innerText = "反馈提交成功，已写入更新历史，页面即将自动刷新...";
    }

    function refreshCurrentDetailPage() {
        if (feedbackHistoryReloading) {
            return;
        }

        feedbackHistoryReloading = true;

        setTimeout(() => {
            window.location.reload();
        }, 600);
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }
})();