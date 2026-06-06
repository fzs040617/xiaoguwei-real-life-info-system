// archive-filter.js
// 作用：让首页和审核中心默认隐藏“已归档”的线索和真实库信息
// 数据管理中心 manage.html 不引用这个文件，所以仍然可以看到全部数据并恢复归档内容

function isArchivedClue(item) {
    return item && item.status === "已归档";
}

function isArchivedVerifiedItem(item) {
    return item && item.trust_level === "已归档";
}

async function loadHomeData() {
    try {
        const verifiedBox = document.getElementById("verifiedResults");
        const clueBox = document.getElementById("clueResults");

        if (!verifiedBox || !clueBox) {
            return;
        }

        const verifiedResponse = await fetch(`${API_BASE}/verified-items`);
        const verifiedData = await verifiedResponse.json();

        const cluesResponse = await fetch(`${API_BASE}/clues`);
        const cluesData = await cluesResponse.json();

        currentVerifiedItems = (verifiedData.data || []).filter(item => !isArchivedVerifiedItem(item));
        currentClues = (cluesData.data || []).filter(item => !isArchivedClue(item));

        renderVerified(currentVerifiedItems);
        renderClues(currentClues);
    } catch (error) {
        document.getElementById("verifiedResults").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
        document.getElementById("clueResults").innerHTML = `<div class="empty">加载失败，请确认后端已启动。</div>`;
    }
}

async function search() {
    const keyword = document.getElementById("keywordInput").value.trim();

    if (!keyword) {
        loadHomeData();
        return;
    }

    const response = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();

    currentVerifiedItems = (data.verified_items || []).filter(item => !isArchivedVerifiedItem(item));
    currentClues = (data.clues || []).filter(item => !isArchivedClue(item));

    renderVerified(currentVerifiedItems);
    renderClues(currentClues);
}