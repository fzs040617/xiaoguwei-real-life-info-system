// password-eye.js
// 密码显示/隐藏眼睛按钮 V3：
// 1. 只保留一个系统眼睛按钮
// 2. 自动处理动态弹窗里的密码框
// 3. 防止重复生成多个眼睛

(function () {
    if (window.__PASSWORD_EYE_V3_LOADED__) {
        return;
    }

    window.__PASSWORD_EYE_V3_LOADED__ = true;

    window.addEventListener("load", () => {
        enhancePasswordInputs();
    });

    const observer = new MutationObserver(() => {
        enhancePasswordInputs();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    setInterval(() => {
        enhancePasswordInputs();
    }, 800);

    function enhancePasswordInputs() {
        const inputs = Array.from(document.querySelectorAll("input"));

        inputs.forEach(input => {
            const isManagedPassword =
                input.type === "password" ||
                input.type === "text" && input.dataset.passwordEyeManaged === "true";

            if (!isManagedPassword) {
                return;
            }

            ensurePasswordEye(input);
        });
    }

    function ensurePasswordEye(input) {
        input.dataset.passwordEyeManaged = "true";

        let wrapper = input.closest(".password-eye-wrapper");

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.className = "password-eye-wrapper";

            const parent = input.parentNode;
            parent.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }

        const oldButtons = Array.from(wrapper.querySelectorAll(".password-eye-toggle"));

        oldButtons.slice(1).forEach(button => button.remove());

        let toggle = wrapper.querySelector(".password-eye-toggle");

        if (!toggle) {
            toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "password-eye-toggle";
            toggle.innerText = input.type === "password" ? "👁" : "🙈";
            toggle.title = input.type === "password" ? "显示密码" : "隐藏密码";

            toggle.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();

                if (input.type === "password") {
                    input.type = "text";
                    toggle.innerText = "🙈";
                    toggle.title = "隐藏密码";
                } else {
                    input.type = "password";
                    toggle.innerText = "👁";
                    toggle.title = "显示密码";
                }

                input.focus();
            };

            wrapper.appendChild(toggle);
        }
    }
})();