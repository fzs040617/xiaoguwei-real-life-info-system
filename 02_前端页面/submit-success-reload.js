// submit-success-reload.js
// 提交成功后显示确认弹窗，由用户点击“确定并刷新页面”后再刷新。
// 解决：成功提示一闪而过、智能识别内容没有完全清空的问题。

(function () {
    window.addEventListener("load", () => {
        watchSubmitSuccessMessages();
    });

    function watchSubmitSuccessMessages() {
        const messageIds = [
            "submitMessage",
            "targetMessage",
            "mapMessage",
            "routeMessage",
            "feedbackMessage"
        ];

        messageIds.forEach(id => {
            const box = document.getElementById(id);

            if (!box) {
                return;
            }

            const observer = new MutationObserver(() => {
                const text = box.innerText || "";

                if (isSubmitSuccessMessage(text)) {
                    showSubmitSuccessModal(text);
                }
            });

            observer.observe(box, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });
    }

    function isSubmitSuccessMessage(text) {
        if (!text) {
            return false;
        }

        if (text.includes("页面即将刷新")) {
            return false;
        }

        const successKeywords = [
            "提交成功",
            "保存成功",
            "新增成功",
            "创建成功",
            "反馈提交成功",
            "路线创建成功",
            "地图点新增成功",
            "采集目标保存成功",
            "线索提交成功"
        ];

        return successKeywords.some(keyword => text.includes(keyword));
    }

    function showSubmitSuccessModal(message) {
        if (document.getElementById("submitSuccessModalMask")) {
            return;
        }

        const mask = document.createElement("div");
        mask.id = "submitSuccessModalMask";

        mask.style.position = "fixed";
        mask.style.left = "0";
        mask.style.top = "0";
        mask.style.right = "0";
        mask.style.bottom = "0";
        mask.style.background = "rgba(0, 0, 0, 0.35)";
        mask.style.zIndex = "99999";
        mask.style.display = "flex";
        mask.style.alignItems = "center";
        mask.style.justifyContent = "center";

        mask.innerHTML = `
            <div style="
                width: 420px;
                max-width: 90%;
                background: #fff;
                border-radius: 14px;
                padding: 24px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.18);
                font-family: Arial, 'Microsoft YaHei', sans-serif;
            ">
                <h2 style="margin-top:0; color:#1f7a4d;">同步成功</h2>
                <div style="
                    white-space: pre-wrap;
                    color:#333;
                    line-height:1.7;
                    margin-bottom:18px;
                ">${escapeSubmitSuccessHtml(message)}</div>

                <p style="color:#666; line-height:1.6;">
                    点击下面按钮后会刷新当前页面，并清空智能识别输入、识别预览和表单内容。
                </p>

                <div style="text-align:right; margin-top:20px;">
                    <button onclick="location.reload()" style="
                        padding: 10px 16px;
                        border: none;
                        border-radius: 8px;
                        background: #1f7a4d;
                        color: white;
                        cursor: pointer;
                        font-size: 14px;
                    ">确定并刷新页面</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
    }

    function escapeSubmitSuccessHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
})();