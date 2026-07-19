// smart-progress-cleanup.js
// 清理重复的“智能识别进度”折叠块，只保留一个。

(function () {
    window.addEventListener("load", () => {
        setTimeout(cleanDuplicateSmartProgress, 600);
    });

    const observer = new MutationObserver(() => {
        cleanDuplicateSmartProgress();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function cleanDuplicateSmartProgress() {
        const progressBox = document.getElementById("smartProgressBox");
        const keepDetails = progressBox ? progressBox.closest("details") : null;

        const detailsList = Array.from(document.querySelectorAll("details"));

        detailsList.forEach(details => {
            const summary = details.querySelector("summary");
            const summaryText = summary ? summary.innerText.trim() : "";

            if (summaryText !== "智能识别进度") {
                return;
            }

            if (keepDetails && details === keepDetails) {
                return;
            }

            details.remove();
        });
    }
})();