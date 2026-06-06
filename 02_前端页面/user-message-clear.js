// user-message-clear.js
// 用户弹窗错误提示自动清除 V2：
// 解决“密码输错后，第二次重新输入时错误提示还停留”的问题。
// 只要用户在登录/注册/编辑资料弹窗里重新输入、聚焦、按键、粘贴、选择，就自动清空提示。

(function () {
    window.addEventListener("load", () => {
        bindGlobalUserMessageClear();
        startUserMessageClearBackupTimer();
    });

    function bindGlobalUserMessageClear() {
        document.addEventListener("input", handleUserModalInput, true);
        document.addEventListener("change", handleUserModalInput, true);
        document.addEventListener("keydown", handleUserModalInput, true);
        document.addEventListener("paste", handleUserModalInput, true);
        document.addEventListener("focusin", handleUserModalInput, true);
        document.addEventListener("click", handleUserModalClick, true);
    }

    function handleUserModalInput(event) {
        const modal = document.getElementById("userModalMask");

        if (!modal) {
            return;
        }

        const target = event.target;

        if (!target) {
            return;
        }

        const isEditable =
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT";

        if (!isEditable) {
            return;
        }

        if (!modal.contains(target)) {
            return;
        }

        clearUserModalMessages();
    }

    function handleUserModalClick(event) {
        const modal = document.getElementById("userModalMask");

        if (!modal) {
            return;
        }

        const target = event.target;

        if (!target || !modal.contains(target)) {
            return;
        }

        const isPasswordEye = target.classList && target.classList.contains("password-eye-toggle");

        if (isPasswordEye) {
            clearUserModalMessages();
        }
    }

    function clearUserModalMessages() {
        const ids = [
            "userModalMessage"
        ];

        ids.forEach(id => {
            const box = document.getElementById(id);
            if (box) {
                box.innerText = "";
            }
        });

        const modal = document.getElementById("userModalMask");

        if (modal) {
            const messageBoxes = modal.querySelectorAll(".message");
            messageBoxes.forEach(box => {
                box.innerText = "";
            });
        }
    }

    function startUserMessageClearBackupTimer() {
        let lastInputSnapshot = "";

        setInterval(() => {
            const modal = document.getElementById("userModalMask");

            if (!modal) {
                lastInputSnapshot = "";
                return;
            }

            const inputs = Array.from(modal.querySelectorAll("input, textarea, select"));
            const currentSnapshot = inputs.map(input => input.value || "").join("|");

            if (lastInputSnapshot && currentSnapshot !== lastInputSnapshot) {
                clearUserModalMessages();
            }

            lastInputSnapshot = currentSnapshot;
        }, 300);
    }
})();