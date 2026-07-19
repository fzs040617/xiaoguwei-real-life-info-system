// detail-link.js
// 作用：自动给线索卡片和真实库卡片增加“查看详情”按钮

function addDetailButtonsToCards() {
    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {
        if (card.dataset.detailReady === "true") {
            return;
        }

        const buttons = card.querySelectorAll("button[onclick]");
        let clueId = null;
        let itemId = null;

        buttons.forEach(button => {
            const code = button.getAttribute("onclick") || "";

            const clueMatch = code.match(/(?:updateClueStatus|approveClue|deleteClue|editClue|archiveClue|restoreClue)\((\d+)/);
            if (clueMatch) {
                clueId = clueMatch[1];
            }

            const itemMatch = code.match(/(?:deleteVerifiedItem|editVerifiedItem|archiveVerifiedItem|restoreVerifiedItem)\((\d+)/);
            if (itemMatch) {
                itemId = itemMatch[1];
            }
        });

        if (!clueId && !itemId) {
            return;
        }

        const detailButton = document.createElement("button");
        detailButton.className = "small-button";
        detailButton.innerText = "查看详情";

        if (clueId) {
            detailButton.onclick = function () {
                location.href = `clue-detail.html?id=${clueId}`;
            };
        } else if (itemId) {
            detailButton.onclick = function () {
                location.href = `item-detail.html?id=${itemId}`;
            };
        }

        const firstActionRow = card.querySelector(".action-row");

        if (firstActionRow) {
            firstActionRow.insertAdjacentElement("beforebegin", detailButton);
        } else {
            card.appendChild(detailButton);
        }

        card.dataset.detailReady = "true";
    });
}

const detailObserver = new MutationObserver(() => {
    addDetailButtonsToCards();
});

detailObserver.observe(document.body, {
    childList: true,
    subtree: true
});

setTimeout(addDetailButtonsToCards, 300);