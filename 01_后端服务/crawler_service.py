from typing import List, Dict, Any
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from database import SessionLocal
from models import Clue, CrawlTarget


DEFAULT_CRAWL_TARGETS = [
    {
        "url": "https://example.org",
        "category": "测试线索",
        "source_platform": "公开网页自动采集"
    }
]


def extract_public_page(url: str) -> Dict[str, Any]:
    """
    采集公开网页，提取标题和正文摘要。
    第一版先做基础网页采集，不处理登录、验证码、私密内容。
    """
    headers = {
        "User-Agent": "Mozilla/5.0 XiaoguweiInfoSystem/0.1"
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    title = soup.title.string.strip() if soup.title and soup.title.string else "未识别标题"

    for tag in soup(["script", "style"]):
        tag.extract()

    text = soup.get_text(separator=" ", strip=True)
    summary = text[:500] if text else "未提取到正文内容"

    return {
        "title": title,
        "summary": summary
    }


def get_enabled_crawl_targets() -> List[Dict[str, str]]:
    """
    从数据库读取启用中的采集目标。
    如果数据库里还没有采集目标，就使用默认测试目标。
    """
    db = SessionLocal()

    try:
        targets = db.query(CrawlTarget).filter(CrawlTarget.enabled == True).all()

        if not targets:
            return DEFAULT_CRAWL_TARGETS

        return [
            {
                "url": target.url,
                "category": target.category or "外部线索",
                "source_platform": target.source_platform or "公开网页自动采集"
            }
            for target in targets
        ]

    finally:
        db.close()


def save_clue_from_page(
    url: str,
    category: str = "外部线索",
    source_platform: str = "公开网页自动采集"
) -> Dict[str, Any]:
    """
    将采集结果保存到线索库。
    如果同一个 source_url 已经存在，则不重复保存。
    """
    db = SessionLocal()

    try:
        existed = db.query(Clue).filter(Clue.source_url == url).first()
        if existed:
            return {
                "status": "skipped",
                "reason": "线索已存在，跳过重复采集",
                "id": existed.id,
                "title": existed.title,
                "url": url
            }

        page_data = extract_public_page(url)

        new_clue = Clue(
            title=page_data["title"],
            category=category,
            source_platform=source_platform,
            source_url=url,
            summary=page_data["summary"],
            status="待核验"
        )

        db.add(new_clue)
        db.commit()
        db.refresh(new_clue)

        return {
            "status": "created",
            "id": new_clue.id,
            "title": new_clue.title,
            "url": url
        }

    except Exception as e:
        db.rollback()
        return {
            "status": "failed",
            "url": url,
            "error": str(e)
        }

    finally:
        db.close()


def run_daily_crawl(targets: List[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    每日自动采集主函数。
    默认从数据库读取启用中的采集目标。
    """
    if targets is None:
        targets = get_enabled_crawl_targets()

    started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    results = []
    for target in targets:
        result = save_clue_from_page(
            url=target["url"],
            category=target.get("category", "外部线索"),
            source_platform=target.get("source_platform", "公开网页自动采集")
        )
        results.append(result)

    created_count = len([r for r in results if r["status"] == "created"])
    skipped_count = len([r for r in results if r["status"] == "skipped"])
    failed_count = len([r for r in results if r["status"] == "failed"])

    return {
        "message": "每日自动采集任务执行完成",
        "started_at": started_at,
        "total": len(results),
        "created_count": created_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "results": results
    }