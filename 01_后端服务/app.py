from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import requests
from bs4 import BeautifulSoup

from database import Base, engine, SessionLocal
from models import Clue, VerifiedItem, CrawlTarget, Feedback, MapPoint, RoutePlan, UpdateHistory, AuthUser
from scheduler import start_scheduler

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="小谷围岛广州大学城真实生活信息共建系统",
    description="真实库 + 线索库 + 自动采集 + AI审核 + 管理员审核",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = None


@app.on_event("startup")
def on_startup():
    global scheduler
    scheduler = start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    global scheduler
    if scheduler:
        scheduler.shutdown()
        print("[定时任务] 已关闭")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ClueCreate(BaseModel):
    title: str
    category: Optional[str] = None
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    summary: Optional[str] = None


class VerifiedItemCreate(BaseModel):
    token: Optional[str] = None
    title: str
    category: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    trust_level: Optional[str] = "已审核"


class ApproveClueRequest(BaseModel):
    token: Optional[str] = None
    location: Optional[str] = None
    trust_level: Optional[str] = "已审核"
    admin_note: Optional[str] = None


class PublicUrlCrawlRequest(BaseModel):
    token: Optional[str] = None
    url: str
    category: Optional[str] = "外部线索"
    source_platform: Optional[str] = "公开网页采集"


class CrawlTargetCreate(BaseModel):
    token: Optional[str] = None
    url: str
    category: Optional[str] = "外部线索"
    source_platform: Optional[str] = "公开网页自动采集"
    enabled: Optional[bool] = True
    note: Optional[str] = None


class CrawlTargetUpdate(BaseModel):
    token: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    source_platform: Optional[str] = None
    enabled: Optional[bool] = None
    note: Optional[str] = None


class AdminTokenRequest(BaseModel):
    token: str = ""


def require_admin_token(db: Session, token: Optional[str]):
    return require_admin_user(db, token or "")


@app.get("/")
def home():
    return {
        "message": "小谷围岛广州大学城真实生活信息共建系统后端已启动",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "后端服务运行正常"
    }


@app.get("/db/status")
def db_status():
    return {
        "status": "ok",
        "message": "数据库连接正常",
        "database": "xiaoguwei.db",
        "tables": ["clues", "verified_items", "crawl_targets"]
    }


@app.get("/scheduler/status")
def scheduler_status():
    return {
        "status": "ok",
        "message": "定时任务已配置",
        "daily_crawl_time": "每天早上 09:00",
        "timezone": "Asia/Shanghai"
    }


@app.post("/scheduler/test-run")
def test_run_scheduler_job(
    request: AdminTokenRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, request.token)
    from scheduler import daily_crawl_job
    result = daily_crawl_job()
    return {
        "message": "手动触发每日采集任务成功",
        "result": result
    }


@app.post("/crawler/targets")
def create_crawl_target(target: CrawlTargetCreate, db: Session = Depends(get_db)):
    require_admin_token(db, target.token)
    existed = db.query(CrawlTarget).filter(CrawlTarget.url == target.url).first()

    if existed:
        return {
            "message": "该采集目标已存在，未重复创建",
            "data": {
                "id": existed.id,
                "url": existed.url,
                "category": existed.category,
                "source_platform": existed.source_platform,
                "enabled": existed.enabled,
                "note": existed.note
            }
        }

    new_target = CrawlTarget(
        url=target.url,
        category=target.category,
        source_platform=target.source_platform,
        enabled=target.enabled,
        note=target.note
    )

    db.add(new_target)
    db.commit()
    db.refresh(new_target)

    return {
        "message": "采集目标已创建",
        "data": {
            "id": new_target.id,
            "url": new_target.url,
            "category": new_target.category,
            "source_platform": new_target.source_platform,
            "enabled": new_target.enabled,
            "note": new_target.note
        }
    }


@app.get("/crawler/targets")
def list_crawl_targets(db: Session = Depends(get_db)):
    targets = db.query(CrawlTarget).order_by(CrawlTarget.id.desc()).all()
    return {
        "count": len(targets),
        "data": targets
    }


@app.patch("/crawler/targets/{target_id}")
def update_crawl_target(
    target_id: int,
    update_data: CrawlTargetUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    target = db.query(CrawlTarget).filter(CrawlTarget.id == target_id).first()

    if target is None:
        raise HTTPException(status_code=404, detail="采集目标不存在")

    if update_data.url is not None:
        target.url = update_data.url
    if update_data.category is not None:
        target.category = update_data.category
    if update_data.source_platform is not None:
        target.source_platform = update_data.source_platform
    if update_data.enabled is not None:
        target.enabled = update_data.enabled
    if update_data.note is not None:
        target.note = update_data.note

    db.commit()
    db.refresh(target)

    return {
        "message": "采集目标已更新",
        "data": {
            "id": target.id,
            "url": target.url,
            "category": target.category,
            "source_platform": target.source_platform,
            "enabled": target.enabled,
            "note": target.note
        }
    }


@app.post("/crawler/targets/{target_id}/toggle")
def toggle_crawl_target(
    target_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    target = db.query(CrawlTarget).filter(CrawlTarget.id == target_id).first()

    if target is None:
        raise HTTPException(status_code=404, detail="采集目标不存在")

    target.enabled = not target.enabled
    db.commit()
    db.refresh(target)

    return {
        "message": "采集目标状态已切换",
        "data": {
            "id": target.id,
            "url": target.url,
            "enabled": target.enabled
        }
    }


@app.delete("/crawler/targets/{target_id}")
def delete_crawl_target(
    target_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    target = db.query(CrawlTarget).filter(CrawlTarget.id == target_id).first()

    if target is None:
        raise HTTPException(status_code=404, detail="采集目标不存在")

    deleted_info = {
        "id": target.id,
        "url": target.url,
        "category": target.category,
        "source_platform": target.source_platform
    }

    db.delete(target)
    db.commit()

    return {
        "message": "采集目标已删除",
        "data": deleted_info
    }


@app.post("/clues")
def create_clue(clue: ClueCreate, db: Session = Depends(get_db)):
    new_clue = Clue(
        title=clue.title,
        category=clue.category,
        source_platform=clue.source_platform,
        source_url=clue.source_url,
        summary=clue.summary,
        status="待核验"
    )
    db.add(new_clue)
    db.commit()
    db.refresh(new_clue)

    return {
        "message": "线索已创建",
        "data": {
            "id": new_clue.id,
            "title": new_clue.title,
            "category": new_clue.category,
            "status": new_clue.status
        }
    }


@app.get("/clues")
def list_clues(db: Session = Depends(get_db)):
    clues = db.query(Clue).order_by(Clue.id.desc()).all()
    return {
        "count": len(clues),
        "data": clues
    }


@app.post("/verified-items")
def create_verified_item(item: VerifiedItemCreate, db: Session = Depends(get_db)):
    require_admin_token(db, item.token)
    new_item = VerifiedItem(
        title=item.title,
        category=item.category,
        location=item.location,
        summary=item.summary,
        trust_level=item.trust_level or "已审核"
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return {
        "message": "真实库信息已创建",
        "data": {
            "id": new_item.id,
            "title": new_item.title,
            "category": new_item.category,
            "trust_level": new_item.trust_level
        }
    }


@app.get("/verified-items")
def list_verified_items(db: Session = Depends(get_db)):
    items = db.query(VerifiedItem).order_by(VerifiedItem.id.desc()).all()
    return {
        "count": len(items),
        "data": items
    }


@app.post("/admin/clues/{clue_id}/approve")
def approve_clue_to_verified(
    clue_id: int,
    approve_data: ApproveClueRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, approve_data.token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    new_item = VerifiedItem(
        title=clue.title,
        category=clue.category,
        location=approve_data.location,
        summary=clue.summary,
        trust_level=approve_data.trust_level or "已审核"
    )

    clue.status = "已转入真实库"

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return {
        "message": "线索已审核通过，并同步到真实库",
        "clue": {
            "id": clue.id,
            "title": clue.title,
            "status": clue.status
        },
        "verified_item": {
            "id": new_item.id,
            "title": new_item.title,
            "category": new_item.category,
            "location": new_item.location,
            "trust_level": new_item.trust_level
        }
    }


@app.post("/crawler/public-url")
def crawl_public_url(
    crawl_data: PublicUrlCrawlRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, crawl_data.token)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 XiaoguweiInfoSystem/0.1"
        }

        response = requests.get(
            crawl_data.url,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        title = soup.title.string.strip() if soup.title and soup.title.string else "未识别标题"

        for tag in soup(["script", "style"]):
            tag.extract()

        text = soup.get_text(separator=" ", strip=True)
        summary = text[:500] if text else "未提取到正文内容"

        new_clue = Clue(
            title=title,
            category=crawl_data.category,
            source_platform=crawl_data.source_platform,
            source_url=crawl_data.url,
            summary=summary,
            status="待核验"
        )

        db.add(new_clue)
        db.commit()
        db.refresh(new_clue)

        return {
            "message": "公开网页采集成功，已自动写入线索库",
            "data": {
                "id": new_clue.id,
                "title": new_clue.title,
                "category": new_clue.category,
                "source_platform": new_clue.source_platform,
                "source_url": new_clue.source_url,
                "summary_preview": new_clue.summary[:100] if new_clue.summary else None,
                "status": new_clue.status
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"采集失败：{str(e)}"
        )


@app.get("/search")
def search_items(
    keyword: str = Query(..., description="搜索关键词，例如：贝岗、夜宵、租房、咖啡"),
    db: Session = Depends(get_db)
):
    verified_results = db.query(VerifiedItem).filter(
        (VerifiedItem.title.contains(keyword)) |
        (VerifiedItem.category.contains(keyword)) |
        (VerifiedItem.location.contains(keyword)) |
        (VerifiedItem.summary.contains(keyword))
    ).order_by(VerifiedItem.id.desc()).all()

    clue_results = db.query(Clue).filter(
        (Clue.title.contains(keyword)) |
        (Clue.category.contains(keyword)) |
        (Clue.source_platform.contains(keyword)) |
        (Clue.summary.contains(keyword))
    ).order_by(Clue.id.desc()).all()

    return {
        "keyword": keyword,
        "verified_count": len(verified_results),
        "clue_count": len(clue_results),
        "verified_items": verified_results,
        "clues": clue_results,
        "notice": "真实库为已审核信息，线索库为待核验信息。"
    }

class ClueStatusUpdate(BaseModel):
    token: Optional[str] = None
    status: str


@app.patch("/clues/{clue_id}/status")
def update_clue_status(
    clue_id: int,
    status_data: ClueStatusUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, status_data.token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    clue.status = status_data.status
    db.commit()
    db.refresh(clue)

    return {
        "message": "线索状态已更新",
        "data": {
            "id": clue.id,
            "title": clue.title,
            "status": clue.status
        }
    }

@app.delete("/clues/{clue_id}")
def delete_clue(
    clue_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    deleted_info = {
        "id": clue.id,
        "title": clue.title,
        "category": clue.category,
        "status": clue.status
    }

    db.delete(clue)
    db.commit()

    return {
        "message": "线索已删除",
        "data": deleted_info
    }


@app.delete("/verified-items/{item_id}")
def delete_verified_item(
    item_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    deleted_info = {
        "id": item.id,
        "title": item.title,
        "category": item.category,
        "trust_level": item.trust_level
    }

    db.delete(item)
    db.commit()

    return {
        "message": "真实库信息已删除",
        "data": deleted_info
    }

class ClueUpdate(BaseModel):
    token: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None


class VerifiedItemUpdate(BaseModel):
    token: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    trust_level: Optional[str] = None


@app.patch("/clues/{clue_id}")
def update_clue(
    clue_id: int,
    update_data: ClueUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    if update_data.title is not None:
        clue.title = update_data.title
    if update_data.category is not None:
        clue.category = update_data.category
    if update_data.source_platform is not None:
        clue.source_platform = update_data.source_platform
    if update_data.source_url is not None:
        clue.source_url = update_data.source_url
    if update_data.summary is not None:
        clue.summary = update_data.summary
    if update_data.status is not None:
        clue.status = update_data.status

    db.commit()
    db.refresh(clue)

    return {
        "message": "线索已更新",
        "data": {
            "id": clue.id,
            "title": clue.title,
            "category": clue.category,
            "source_platform": clue.source_platform,
            "source_url": clue.source_url,
            "summary": clue.summary,
            "status": clue.status
        }
    }


@app.patch("/verified-items/{item_id}")
def update_verified_item(
    item_id: int,
    update_data: VerifiedItemUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    if update_data.title is not None:
        item.title = update_data.title
    if update_data.category is not None:
        item.category = update_data.category
    if update_data.location is not None:
        item.location = update_data.location
    if update_data.summary is not None:
        item.summary = update_data.summary
    if update_data.trust_level is not None:
        item.trust_level = update_data.trust_level

    db.commit()
    db.refresh(item)

    return {
        "message": "真实库信息已更新",
        "data": {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "location": item.location,
            "summary": item.summary,
            "trust_level": item.trust_level
        }
    }

class BackupImportRequest(BaseModel):
    token: Optional[str] = None
    system_password: Optional[str] = None
    password: Optional[str] = None
    clues: Optional[list] = None
    verified_items: Optional[list] = None
    crawl_targets: Optional[list] = None


@app.post("/backup/import")
def import_backup(
    backup_data: BackupImportRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, backup_data.token)
    if (backup_data.system_password or backup_data.password) != SYSTEM_ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="系统密码错误，禁止导入备份")

    imported_clues = 0
    skipped_clues = 0

    imported_verified_items = 0
    skipped_verified_items = 0

    imported_crawl_targets = 0
    skipped_crawl_targets = 0

    # 导入线索库
    for item in backup_data.clues or []:
        source_url = item.get("source_url")
        title = item.get("title")

        existed = None

        if source_url:
            existed = db.query(Clue).filter(Clue.source_url == source_url).first()
        elif title:
            existed = db.query(Clue).filter(Clue.title == title).first()

        if existed:
            skipped_clues += 1
            continue

        new_clue = Clue(
            title=item.get("title") or "未命名线索",
            category=item.get("category"),
            source_platform=item.get("source_platform"),
            source_url=item.get("source_url"),
            summary=item.get("summary"),
            status=item.get("status") or "待核验"
        )

        db.add(new_clue)
        imported_clues += 1

    # 导入真实库
    for item in backup_data.verified_items or []:
        title = item.get("title")
        summary = item.get("summary")

        existed = None

        if title:
            existed = db.query(VerifiedItem).filter(VerifiedItem.title == title).first()

        if existed:
            skipped_verified_items += 1
            continue

        new_item = VerifiedItem(
            title=item.get("title") or "未命名真实库信息",
            category=item.get("category"),
            location=item.get("location"),
            summary=summary,
            trust_level=item.get("trust_level") or "已审核"
        )

        db.add(new_item)
        imported_verified_items += 1

    # 导入采集目标
    for item in backup_data.crawl_targets or []:
        url = item.get("url")

        if not url:
            skipped_crawl_targets += 1
            continue

        existed = db.query(CrawlTarget).filter(CrawlTarget.url == url).first()

        if existed:
            skipped_crawl_targets += 1
            continue

        new_target = CrawlTarget(
            url=url,
            category=item.get("category") or "外部线索",
            source_platform=item.get("source_platform") or "备份导入",
            enabled=item.get("enabled", True),
            note=item.get("note")
        )

        db.add(new_target)
        imported_crawl_targets += 1

    db.commit()

    return {
        "message": "备份导入完成",
        "result": {
            "imported_clues": imported_clues,
            "skipped_clues": skipped_clues,
            "imported_verified_items": imported_verified_items,
            "skipped_verified_items": skipped_verified_items,
            "imported_crawl_targets": imported_crawl_targets,
            "skipped_crawl_targets": skipped_crawl_targets
        }
    }

@app.post("/clues/{clue_id}/archive")
def archive_clue(
    clue_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    clue.status = "已归档"
    db.commit()
    db.refresh(clue)

    return {
        "message": "线索已归档",
        "data": {
            "id": clue.id,
            "title": clue.title,
            "status": clue.status
        }
    }


@app.post("/clues/{clue_id}/restore")
def restore_clue(
    clue_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    clue.status = "待核验"
    db.commit()
    db.refresh(clue)

    return {
        "message": "线索已恢复为待核验",
        "data": {
            "id": clue.id,
            "title": clue.title,
            "status": clue.status
        }
    }


@app.post("/verified-items/{item_id}/archive")
def archive_verified_item(
    item_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    item.trust_level = "已归档"
    db.commit()
    db.refresh(item)

    return {
        "message": "真实库信息已归档",
        "data": {
            "id": item.id,
            "title": item.title,
            "trust_level": item.trust_level
        }
    }


@app.post("/verified-items/{item_id}/restore")
def restore_verified_item(
    item_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    item.trust_level = "管理员已审核"
    db.commit()
    db.refresh(item)

    return {
        "message": "真实库信息已恢复",
        "data": {
            "id": item.id,
            "title": item.title,
            "trust_level": item.trust_level
        }
    }

@app.get("/clues/{clue_id}")
def get_clue_detail(clue_id: int, db: Session = Depends(get_db)):
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    return {
        "id": clue.id,
        "title": clue.title,
        "category": clue.category,
        "source_platform": clue.source_platform,
        "source_url": clue.source_url,
        "summary": clue.summary,
        "status": clue.status,
        "created_at": clue.created_at
    }


@app.get("/verified-items/{item_id}")
def get_verified_item_detail(item_id: int, db: Session = Depends(get_db)):
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    return {
        "id": item.id,
        "title": item.title,
        "category": item.category,
        "location": item.location,
        "summary": item.summary,
        "trust_level": item.trust_level,
        "created_at": item.created_at
    }

class FeedbackCreate(BaseModel):
    target_type: str
    target_id: int
    feedback_type: Optional[str] = "补充信息"
    content: Optional[str] = None
    user_name: Optional[str] = "匿名用户"


@app.post("/feedbacks")
def create_feedback(
    feedback: FeedbackCreate,
    db: Session = Depends(get_db)
):
    if feedback.target_type not in ["clue", "verified"]:
        raise HTTPException(status_code=400, detail="target_type 只能是 clue 或 verified")

    if feedback.target_type == "clue":
        target = db.query(Clue).filter(Clue.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="线索不存在")

    if feedback.target_type == "verified":
        target = db.query(VerifiedItem).filter(VerifiedItem.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="真实库信息不存在")

    new_feedback = Feedback(
        target_type=feedback.target_type,
        target_id=feedback.target_id,
        feedback_type=feedback.feedback_type or "补充信息",
        content=feedback.content,
        user_name=feedback.user_name or "匿名用户"
    )

    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    return {
        "message": "反馈已提交",
        "data": {
            "id": new_feedback.id,
            "target_type": new_feedback.target_type,
            "target_id": new_feedback.target_id,
            "feedback_type": new_feedback.feedback_type,
            "content": new_feedback.content,
            "user_name": new_feedback.user_name,
            "created_at": new_feedback.created_at
        }
    }


@app.get("/feedbacks")
def list_feedbacks(
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Feedback)

    if target_type:
        query = query.filter(Feedback.target_type == target_type)

    if target_id is not None:
        query = query.filter(Feedback.target_id == target_id)

    feedbacks = query.order_by(Feedback.id.desc()).all()

    return {
        "count": len(feedbacks),
        "data": feedbacks
    }


@app.delete("/feedbacks/{feedback_id}")
def delete_feedback(
    feedback_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()

    if feedback is None:
        raise HTTPException(status_code=404, detail="反馈不存在")

    deleted_info = {
        "id": feedback.id,
        "target_type": feedback.target_type,
        "target_id": feedback.target_id,
        "feedback_type": feedback.feedback_type,
        "content": feedback.content
    }

    db.delete(feedback)
    db.commit()

    return {
        "message": "反馈已删除",
        "data": deleted_info
    }
@app.get("/feedbacks/stats")
def feedback_stats(db: Session = Depends(get_db)):
    feedbacks = db.query(Feedback).order_by(Feedback.id.desc()).all()

    total = len(feedbacks)
    clue_count = len([f for f in feedbacks if f.target_type == "clue"])
    verified_count = len([f for f in feedbacks if f.target_type == "verified"])

    type_counts = {}
    target_counts = {}

    for f in feedbacks:
        feedback_type = f.feedback_type or "未分类反馈"
        type_counts[feedback_type] = type_counts.get(feedback_type, 0) + 1

        key = f"{f.target_type}:{f.target_id}"
        target_counts[key] = target_counts.get(key, 0) + 1

    top_targets = []

    for key, count in sorted(target_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        target_type, target_id_text = key.split(":")
        target_id = int(target_id_text)

        title = "未知对象"
        category = None

        if target_type == "clue":
            clue = db.query(Clue).filter(Clue.id == target_id).first()
            if clue:
                title = clue.title
                category = clue.category

        if target_type == "verified":
            item = db.query(VerifiedItem).filter(VerifiedItem.id == target_id).first()
            if item:
                title = item.title
                category = item.category

        top_targets.append({
            "target_type": target_type,
            "target_id": target_id,
            "title": title,
            "category": category,
            "feedback_count": count
        })

    return {
        "message": "反馈统计获取成功",
        "total_feedbacks": total,
        "clue_feedbacks": clue_count,
        "verified_feedbacks": verified_count,
        "feedback_type_counts": type_counts,
        "top_targets": top_targets
    }

class MapPointCreate(BaseModel):
    token: Optional[str] = None
    name: str
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    map_type: Optional[str] = "生活地点"
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    source: Optional[str] = "手动添加"
    description: Optional[str] = None


class MapPointUpdate(BaseModel):
    token: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    map_type: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    source: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


@app.post("/map-points")
def create_map_point(
    point: MapPointCreate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, point.token)
    if point.target_type and point.target_type not in ["clue", "verified"]:
        raise HTTPException(status_code=400, detail="target_type 只能是 clue 或 verified")

    new_point = MapPoint(
        name=point.name,
        category=point.category,
        address=point.address,
        latitude=point.latitude,
        longitude=point.longitude,
        map_type=point.map_type or "生活地点",
        target_type=point.target_type,
        target_id=point.target_id,
        source=point.source or "手动添加",
        status="正常",
        description=point.description
    )

    db.add(new_point)
    db.commit()
    db.refresh(new_point)

    return {
        "message": "地图点已创建",
        "data": {
            "id": new_point.id,
            "name": new_point.name,
            "category": new_point.category,
            "address": new_point.address,
            "status": new_point.status
        }
    }


@app.get("/map-points")
def list_map_points(
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MapPoint)

    if keyword:
        query = query.filter(
            (MapPoint.name.contains(keyword)) |
            (MapPoint.category.contains(keyword)) |
            (MapPoint.address.contains(keyword)) |
            (MapPoint.description.contains(keyword)) |
            (MapPoint.source.contains(keyword))
        )

    if category and category != "全部":
        query = query.filter(MapPoint.category == category)

    if status and status != "全部":
        query = query.filter(MapPoint.status == status)

    points = query.order_by(MapPoint.id.desc()).all()

    return {
        "count": len(points),
        "data": points
    }


@app.get("/map-points/{point_id}")
def get_map_point_detail(
    point_id: int,
    db: Session = Depends(get_db)
):
    point = db.query(MapPoint).filter(MapPoint.id == point_id).first()

    if point is None:
        raise HTTPException(status_code=404, detail="地图点不存在")

    return {
        "id": point.id,
        "name": point.name,
        "category": point.category,
        "address": point.address,
        "latitude": point.latitude,
        "longitude": point.longitude,
        "map_type": point.map_type,
        "target_type": point.target_type,
        "target_id": point.target_id,
        "source": point.source,
        "status": point.status,
        "description": point.description,
        "created_at": point.created_at
    }


@app.patch("/map-points/{point_id}")
def update_map_point(
    point_id: int,
    update_data: MapPointUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    point = db.query(MapPoint).filter(MapPoint.id == point_id).first()

    if point is None:
        raise HTTPException(status_code=404, detail="地图点不存在")

    if update_data.name is not None:
        point.name = update_data.name
    if update_data.category is not None:
        point.category = update_data.category
    if update_data.address is not None:
        point.address = update_data.address
    if update_data.latitude is not None:
        point.latitude = update_data.latitude
    if update_data.longitude is not None:
        point.longitude = update_data.longitude
    if update_data.map_type is not None:
        point.map_type = update_data.map_type
    if update_data.target_type is not None:
        point.target_type = update_data.target_type
    if update_data.target_id is not None:
        point.target_id = update_data.target_id
    if update_data.source is not None:
        point.source = update_data.source
    if update_data.status is not None:
        point.status = update_data.status
    if update_data.description is not None:
        point.description = update_data.description

    db.commit()
    db.refresh(point)

    return {
        "message": "地图点已更新",
        "data": {
            "id": point.id,
            "name": point.name,
            "category": point.category,
            "address": point.address,
            "status": point.status
        }
    }


@app.post("/map-points/{point_id}/archive")
def archive_map_point(
    point_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    point = db.query(MapPoint).filter(MapPoint.id == point_id).first()

    if point is None:
        raise HTTPException(status_code=404, detail="地图点不存在")

    point.status = "已归档"
    db.commit()
    db.refresh(point)

    return {
        "message": "地图点已归档",
        "data": {
            "id": point.id,
            "name": point.name,
            "status": point.status
        }
    }


@app.post("/map-points/{point_id}/restore")
def restore_map_point(
    point_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    point = db.query(MapPoint).filter(MapPoint.id == point_id).first()

    if point is None:
        raise HTTPException(status_code=404, detail="地图点不存在")

    point.status = "正常"
    db.commit()
    db.refresh(point)

    return {
        "message": "地图点已恢复",
        "data": {
            "id": point.id,
            "name": point.name,
            "status": point.status
        }
    }


@app.delete("/map-points/{point_id}")
def delete_map_point(
    point_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    point = db.query(MapPoint).filter(MapPoint.id == point_id).first()

    if point is None:
        raise HTTPException(status_code=404, detail="地图点不存在")

    deleted_info = {
        "id": point.id,
        "name": point.name,
        "category": point.category,
        "address": point.address
    }

    db.delete(point)
    db.commit()

    return {
        "message": "地图点已删除",
        "data": deleted_info
    }

class RoutePlanCreate(BaseModel):
    token: Optional[str] = None
    name: str
    route_type: Optional[str] = "citywalk路线"
    category: Optional[str] = None
    start_area: Optional[str] = None
    point_ids: Optional[str] = None
    source: Optional[str] = "手动添加"
    description: Optional[str] = None


class RoutePlanUpdate(BaseModel):
    token: Optional[str] = None
    name: Optional[str] = None
    route_type: Optional[str] = None
    category: Optional[str] = None
    start_area: Optional[str] = None
    point_ids: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


def parse_route_point_ids(point_ids_text: Optional[str]):
    if not point_ids_text:
        return []

    result = []

    for part in point_ids_text.split(","):
        part = part.strip()

        if part.isdigit():
            result.append(int(part))

    return result


def enrich_route_with_points(route: RoutePlan, db: Session):
    point_ids = parse_route_point_ids(route.point_ids)

    points = []

    if point_ids:
        points = db.query(MapPoint).filter(MapPoint.id.in_(point_ids)).all()

    point_map = {point.id: point for point in points}

    ordered_points = []

    for point_id in point_ids:
        point = point_map.get(point_id)

        if point:
            ordered_points.append({
                "id": point.id,
                "name": point.name,
                "category": point.category,
                "address": point.address,
                "map_type": point.map_type,
                "status": point.status
            })

    return {
        "id": route.id,
        "name": route.name,
        "route_type": route.route_type,
        "category": route.category,
        "start_area": route.start_area,
        "point_ids": route.point_ids,
        "points": ordered_points,
        "source": route.source,
        "status": route.status,
        "description": route.description,
        "created_at": route.created_at
    }


@app.post("/routes")
def create_route_plan(
    route: RoutePlanCreate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, route.token)
    new_route = RoutePlan(
        name=route.name,
        route_type=route.route_type or "citywalk路线",
        category=route.category,
        start_area=route.start_area,
        point_ids=route.point_ids,
        source=route.source or "手动添加",
        status="正常",
        description=route.description
    )

    db.add(new_route)
    db.commit()
    db.refresh(new_route)

    return {
        "message": "路线已创建",
        "data": enrich_route_with_points(new_route, db)
    }


@app.get("/routes")
def list_route_plans(
    keyword: Optional[str] = None,
    route_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RoutePlan)

    if keyword:
        query = query.filter(
            (RoutePlan.name.contains(keyword)) |
            (RoutePlan.route_type.contains(keyword)) |
            (RoutePlan.category.contains(keyword)) |
            (RoutePlan.start_area.contains(keyword)) |
            (RoutePlan.source.contains(keyword)) |
            (RoutePlan.description.contains(keyword))
        )

    if route_type and route_type != "全部":
        query = query.filter(RoutePlan.route_type == route_type)

    if status and status != "全部":
        query = query.filter(RoutePlan.status == status)

    routes = query.order_by(RoutePlan.id.desc()).all()

    return {
        "count": len(routes),
        "data": [enrich_route_with_points(route, db) for route in routes]
    }


@app.get("/routes/{route_id}")
def get_route_plan_detail(
    route_id: int,
    db: Session = Depends(get_db)
):
    route = db.query(RoutePlan).filter(RoutePlan.id == route_id).first()

    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")

    return enrich_route_with_points(route, db)


@app.patch("/routes/{route_id}")
def update_route_plan(
    route_id: int,
    update_data: RoutePlanUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    route = db.query(RoutePlan).filter(RoutePlan.id == route_id).first()

    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")

    if update_data.name is not None:
        route.name = update_data.name
    if update_data.route_type is not None:
        route.route_type = update_data.route_type
    if update_data.category is not None:
        route.category = update_data.category
    if update_data.start_area is not None:
        route.start_area = update_data.start_area
    if update_data.point_ids is not None:
        route.point_ids = update_data.point_ids
    if update_data.source is not None:
        route.source = update_data.source
    if update_data.status is not None:
        route.status = update_data.status
    if update_data.description is not None:
        route.description = update_data.description

    db.commit()
    db.refresh(route)

    return {
        "message": "路线已更新",
        "data": enrich_route_with_points(route, db)
    }


@app.post("/routes/{route_id}/archive")
def archive_route_plan(
    route_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    route = db.query(RoutePlan).filter(RoutePlan.id == route_id).first()

    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")

    route.status = "已归档"
    db.commit()
    db.refresh(route)

    return {
        "message": "路线已归档",
        "data": enrich_route_with_points(route, db)
    }


@app.post("/routes/{route_id}/restore")
def restore_route_plan(
    route_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    route = db.query(RoutePlan).filter(RoutePlan.id == route_id).first()

    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")

    route.status = "正常"
    db.commit()
    db.refresh(route)

    return {
        "message": "路线已恢复",
        "data": enrich_route_with_points(route, db)
    }


@app.delete("/routes/{route_id}")
def delete_route_plan(
    route_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    route = db.query(RoutePlan).filter(RoutePlan.id == route_id).first()

    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")

    deleted_info = {
        "id": route.id,
        "name": route.name,
        "route_type": route.route_type,
        "status": route.status
    }

    db.delete(route)
    db.commit()

    return {
        "message": "路线已删除",
        "data": deleted_info
    }

class UpdateHistoryCreate(BaseModel):
    target_type: str
    target_id: int
    action: str
    title: Optional[str] = None
    detail: Optional[str] = None
    operator: Optional[str] = "系统"


@app.post("/update-history")
def create_update_history(
    history: UpdateHistoryCreate,
    db: Session = Depends(get_db)
):
    new_history = UpdateHistory(
        target_type=history.target_type,
        target_id=history.target_id,
        action=history.action,
        title=history.title,
        detail=history.detail,
        operator=history.operator or "系统"
    )

    db.add(new_history)
    db.commit()
    db.refresh(new_history)

    return {
        "message": "更新历史已记录",
        "data": {
            "id": new_history.id,
            "target_type": new_history.target_type,
            "target_id": new_history.target_id,
            "action": new_history.action,
            "title": new_history.title,
            "detail": new_history.detail,
            "operator": new_history.operator,
            "created_at": new_history.created_at
        }
    }


@app.get("/update-history")
def list_update_history(
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(UpdateHistory)

    if target_type and target_type != "全部":
        query = query.filter(UpdateHistory.target_type == target_type)

    if target_id is not None:
        query = query.filter(UpdateHistory.target_id == target_id)

    if keyword:
        query = query.filter(
            (UpdateHistory.action.contains(keyword)) |
            (UpdateHistory.title.contains(keyword)) |
            (UpdateHistory.detail.contains(keyword)) |
            (UpdateHistory.operator.contains(keyword))
        )

    histories = query.order_by(UpdateHistory.id.desc()).all()

    return {
        "count": len(histories),
        "data": histories
    }

class ClueDetailEditUpdate(BaseModel):
    token: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None


class VerifiedDetailEditUpdate(BaseModel):
    token: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    trust_level: Optional[str] = None


@app.patch("/detail-edit/clues/{clue_id}")
def edit_clue_from_detail(
    clue_id: int,
    update_data: ClueDetailEditUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    clue = db.query(Clue).filter(Clue.id == clue_id).first()

    if clue is None:
        raise HTTPException(status_code=404, detail="线索不存在")

    if update_data.title is not None:
        clue.title = update_data.title
    if update_data.category is not None:
        clue.category = update_data.category
    if update_data.source_platform is not None:
        clue.source_platform = update_data.source_platform
    if update_data.source_url is not None:
        clue.source_url = update_data.source_url
    if update_data.summary is not None:
        clue.summary = update_data.summary
    if update_data.status is not None:
        clue.status = update_data.status

    db.commit()
    db.refresh(clue)

    return {
        "message": "线索已编辑",
        "data": {
            "id": clue.id,
            "title": clue.title,
            "category": clue.category,
            "source_platform": clue.source_platform,
            "source_url": clue.source_url,
            "summary": clue.summary,
            "status": clue.status
        }
    }


@app.patch("/detail-edit/verified-items/{item_id}")
def edit_verified_item_from_detail(
    item_id: int,
    update_data: VerifiedDetailEditUpdate,
    db: Session = Depends(get_db)
):
    require_admin_token(db, update_data.token)
    item = db.query(VerifiedItem).filter(VerifiedItem.id == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="真实库信息不存在")

    if update_data.title is not None:
        item.title = update_data.title
    if update_data.category is not None:
        item.category = update_data.category
    if update_data.location is not None:
        item.location = update_data.location
    if update_data.summary is not None:
        item.summary = update_data.summary
    if update_data.trust_level is not None:
        item.trust_level = update_data.trust_level

    db.commit()
    db.refresh(item)

    return {
        "message": "真实库信息已编辑",
        "data": {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "location": item.location,
            "summary": item.summary,
            "trust_level": item.trust_level
        }
    }

class FeedbackCreateV2(BaseModel):
    target_type: str
    target_id: int
    feedback_type: Optional[str] = "补充信息"
    content: Optional[str] = None
    user_name: Optional[str] = "匿名用户"


@app.post("/feedbacks-v2")
def create_feedback_v2(
    feedback: FeedbackCreateV2,
    db: Session = Depends(get_db)
):
    allowed_types = ["clue", "verified", "map_point", "route"]

    if feedback.target_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="target_type 只能是 clue、verified、map_point 或 route"
        )

    if feedback.target_type == "clue":
        target = db.query(Clue).filter(Clue.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="线索不存在")

    if feedback.target_type == "verified":
        target = db.query(VerifiedItem).filter(VerifiedItem.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="真实库信息不存在")

    if feedback.target_type == "map_point":
        target = db.query(MapPoint).filter(MapPoint.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="地图点不存在")

    if feedback.target_type == "route":
        target = db.query(RoutePlan).filter(RoutePlan.id == feedback.target_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="路线不存在")

    new_feedback = Feedback(
        target_type=feedback.target_type,
        target_id=feedback.target_id,
        feedback_type=feedback.feedback_type or "补充信息",
        content=feedback.content,
        user_name=feedback.user_name or "匿名用户"
    )

    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    return {
        "message": "反馈已提交",
        "data": {
            "id": new_feedback.id,
            "target_type": new_feedback.target_type,
            "target_id": new_feedback.target_id,
            "feedback_type": new_feedback.feedback_type,
            "content": new_feedback.content,
            "user_name": new_feedback.user_name,
            "created_at": new_feedback.created_at
        }
    }

class ClearUpdateHistoryRequest(BaseModel):
    token: str = ""
    password: str
    confirm_text: str


@app.delete("/update-history/clear-all")
def clear_all_update_history(
    request: ClearUpdateHistoryRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, request.token)
    admin_password = "xgw2026"

    if request.password != admin_password:
        raise HTTPException(status_code=403, detail="密码错误，禁止清空更新历史")

    if request.confirm_text != "清空历史":
        raise HTTPException(status_code=400, detail="确认文字错误，请输入：清空历史")

    count = db.query(UpdateHistory).count()

    db.query(UpdateHistory).delete()
    db.commit()

    return {
        "message": "所有更新历史已清空",
        "deleted_count": count
    }

def serialize_db_item(item):
    """
    把 SQLAlchemy 对象转成可导出的字典。
    datetime 会转成字符串，避免 JSON 报错。
    """
    result = {}

    for column in item.__table__.columns:
        value = getattr(item, column.name)

        if isinstance(value, datetime):
            result[column.name] = value.isoformat()
        else:
            result[column.name] = value

    return result


@app.get("/backup/export")
def export_all_backup(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    clues = db.query(Clue).all()
    verified_items = db.query(VerifiedItem).all()
    crawl_targets = db.query(CrawlTarget).all()
    feedbacks = db.query(Feedback).all()
    map_points = db.query(MapPoint).all()
    routes = db.query(RoutePlan).all()
    update_histories = db.query(UpdateHistory).all()

    backup_data = {
        "system_name": "小谷围岛广州大学城真实生活信息共建系统",
        "backup_version": "v1",
        "exported_at": datetime.now().isoformat(),
        "summary": {
            "clues": len(clues),
            "verified_items": len(verified_items),
            "crawl_targets": len(crawl_targets),
            "feedbacks": len(feedbacks),
            "map_points": len(map_points),
            "routes": len(routes),
            "update_histories": len(update_histories)
        },
        "data": {
            "clues": [serialize_db_item(item) for item in clues],
            "verified_items": [serialize_db_item(item) for item in verified_items],
            "crawl_targets": [serialize_db_item(item) for item in crawl_targets],
            "feedbacks": [serialize_db_item(item) for item in feedbacks],
            "map_points": [serialize_db_item(item) for item in map_points],
            "routes": [serialize_db_item(item) for item in routes],
            "update_histories": [serialize_db_item(item) for item in update_histories]
        }
    }

    return backup_data

class BackupImportRequest(BaseModel):
    token: str = ""
    password: str
    confirm_text: str
    backup_data: dict


def parse_backup_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return value

    return value


def import_backup_items(db: Session, model, items: list):
    imported_count = 0
    skipped_count = 0
    failed_count = 0
    failed_items = []

    column_names = [column.name for column in model.__table__.columns]

    for item in items:
        try:
            item_id = item.get("id")

            if item_id is None:
                skipped_count += 1
                continue

            existing = db.query(model).filter(model.id == item_id).first()

            if existing:
                skipped_count += 1
                continue

            clean_data = {}

            for key in column_names:
                if key in item:
                    value = item[key]

                    if key.endswith("_at") or key in ["created_at", "updated_at"]:
                        value = parse_backup_datetime(value)

                    clean_data[key] = value

            new_item = model(**clean_data)
            db.add(new_item)
            imported_count += 1

        except Exception as error:
            failed_count += 1
            failed_items.append({
                "id": item.get("id"),
                "error": str(error)
            })

    return {
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "failed_items": failed_items
    }


@app.post("/backup/import")
def import_backup_data(
    request: BackupImportRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, request.token)
    admin_password = "xgw2026"

    if request.password != admin_password:
        raise HTTPException(status_code=403, detail="密码错误，禁止导入备份")

    if request.confirm_text != "导入备份":
        raise HTTPException(status_code=400, detail="确认文字错误，请输入：导入备份")

    backup_data = request.backup_data

    if not isinstance(backup_data, dict):
        raise HTTPException(status_code=400, detail="备份数据格式错误")

    data = backup_data.get("data")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="备份文件缺少 data 字段")

    result = {}

    result["clues"] = import_backup_items(db, Clue, data.get("clues", []))
    result["verified_items"] = import_backup_items(db, VerifiedItem, data.get("verified_items", []))
    result["crawl_targets"] = import_backup_items(db, CrawlTarget, data.get("crawl_targets", []))
    result["feedbacks"] = import_backup_items(db, Feedback, data.get("feedbacks", []))
    result["map_points"] = import_backup_items(db, MapPoint, data.get("map_points", []))
    result["routes"] = import_backup_items(db, RoutePlan, data.get("routes", []))
    result["update_histories"] = import_backup_items(db, UpdateHistory, data.get("update_histories", []))

    db.commit()

    total_imported = sum(item["imported_count"] for item in result.values())
    total_skipped = sum(item["skipped_count"] for item in result.values())
    total_failed = sum(item["failed_count"] for item in result.values())

    return {
        "message": "备份导入完成",
        "mode": "安全合并导入：已存在 ID 会跳过，不覆盖旧数据",
        "total_imported": total_imported,
        "total_skipped": total_skipped,
        "total_failed": total_failed,
        "detail": result
    }

BACKUP_IMPORT_VERIFY_CODES = {}


@app.get("/backup/import-code")
def get_backup_import_code(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    require_admin_token(db, token)
    import random
    import string
    from uuid import uuid4

    token = uuid4().hex
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    BACKUP_IMPORT_VERIFY_CODES[token] = code

    return {
        "message": "备份导入验证码已生成",
        "verify_token": token,
        "verify_code": code
    }


class BackupImportSecureRequest(BaseModel):
    token: str = ""
    password: str
    verify_token: str
    verify_code: str
    backup_data: dict


@app.post("/backup/import-v2")
def import_backup_data_v2(
    request: BackupImportSecureRequest,
    db: Session = Depends(get_db)
):
    require_admin_token(db, request.token)
    admin_password = "xgw2026"

    if request.password != admin_password:
        raise HTTPException(status_code=403, detail="密码错误，禁止导入备份")

    server_code = BACKUP_IMPORT_VERIFY_CODES.get(request.verify_token)

    if not server_code:
        raise HTTPException(status_code=400, detail="验证码已失效，请刷新验证码后重试")

    if request.verify_code.strip().upper() != server_code:
        raise HTTPException(status_code=400, detail="验证码错误，禁止导入备份")

    # 验证通过后删除验证码，避免重复使用
    BACKUP_IMPORT_VERIFY_CODES.pop(request.verify_token, None)

    backup_data = request.backup_data

    if not isinstance(backup_data, dict):
        raise HTTPException(status_code=400, detail="备份数据格式错误")

    data = backup_data.get("data")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="备份文件缺少 data 字段")

    result = {}

    result["clues"] = import_backup_items(db, Clue, data.get("clues", []))
    result["verified_items"] = import_backup_items(db, VerifiedItem, data.get("verified_items", []))
    result["crawl_targets"] = import_backup_items(db, CrawlTarget, data.get("crawl_targets", []))
    result["feedbacks"] = import_backup_items(db, Feedback, data.get("feedbacks", []))
    result["map_points"] = import_backup_items(db, MapPoint, data.get("map_points", []))
    result["routes"] = import_backup_items(db, RoutePlan, data.get("routes", []))
    result["update_histories"] = import_backup_items(db, UpdateHistory, data.get("update_histories", []))

    db.commit()

    total_imported = sum(item["imported_count"] for item in result.values())
    total_skipped = sum(item["skipped_count"] for item in result.values())
    total_failed = sum(item["failed_count"] for item in result.values())

    return {
        "message": "备份导入完成",
        "mode": "安全合并导入：已存在 ID 会跳过，不覆盖旧数据",
        "total_imported": total_imported,
        "total_skipped": total_skipped,
        "total_failed": total_failed,
        "detail": result
    }

import hashlib
import secrets
import re


AUTH_ALLOWED_PATTERN = re.compile(r"^[A-Za-z0-9!@#$%^&*()_\-+=\[\]{};:'\",.<>/?\\|`~]+$")


class AuthRegisterRequest(BaseModel):
    account: str
    password: str
    nickname: Optional[str] = None
    avatar_base64: Optional[str] = None


class AuthLoginRequest(BaseModel):
    account: str
    password: str


class AuthTokenRequest(BaseModel):
    token: str


class AuthUpdateRequest(BaseModel):
    token: str
    account: Optional[str] = None
    password: Optional[str] = None
    nickname: Optional[str] = None
    avatar_base64: Optional[str] = None


def validate_account_or_password(value: str, field_name: str):
    if value is None:
        raise HTTPException(status_code=400, detail=f"{field_name}不能为空")

    if len(value) < 3:
        raise HTTPException(status_code=400, detail=f"{field_name}至少需要 3 个字符")

    if len(value) > 64:
        raise HTTPException(status_code=400, detail=f"{field_name}不能超过 64 个字符")

    if not AUTH_ALLOWED_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name}只能包含英文大小写、数字和常用标点符号，不能包含中文、空格或特殊不可见字符"
        )


def make_password_hash(password: str, salt: str):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def public_user_data(user: AuthUser):
    return {
        "id": user.id,
        "account": user.account,
        "nickname": user.nickname,
        "role": user.role,
        "avatar_base64": user.avatar_base64,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at
    }


def get_user_by_token(db: Session, token: str):
    if not token:
        raise HTTPException(status_code=401, detail="请先登录")

    user = db.query(AuthUser).filter(AuthUser.session_token == token).first()

    if user is None:
        raise HTTPException(status_code=401, detail="请先登录，登录状态无效或已过期")

    return user


@app.post("/auth/register")
def register_user(
    request: AuthRegisterRequest,
    db: Session = Depends(get_db)
):
    account = request.account.strip()
    password = request.password.strip()
    nickname = (request.nickname or account).strip()

    validate_account_or_password(account, "账号")
    validate_account_or_password(password, "密码")

    existing = db.query(AuthUser).filter(AuthUser.account == account).first()

    if existing:
        raise HTTPException(status_code=400, detail="账号已存在，请换一个账号")

    is_first_user = db.query(AuthUser).count() == 0
    role = "admin" if is_first_user else "user"

    salt = secrets.token_hex(16)
    password_hash = make_password_hash(password, salt)
    session_token = secrets.token_urlsafe(32)

    user = AuthUser(
        account=account,
        nickname=nickname or account,
        password_salt=salt,
        password_hash=password_hash,
        role=role,
        avatar_base64=request.avatar_base64,
        session_token=session_token,
        created_at=datetime.now(),
        last_login_at=datetime.now()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "注册成功",
        "token": session_token,
        "data": public_user_data(user)
    }


@app.post("/auth/login")
def login_user(
    request: AuthLoginRequest,
    db: Session = Depends(get_db)
):
    account = request.account.strip()
    password = request.password.strip()

    validate_account_or_password(account, "账号")
    validate_account_or_password(password, "密码")

    user = db.query(AuthUser).filter(AuthUser.account == account).first()

    if user is None:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    password_hash = make_password_hash(password, user.password_salt)

    if password_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    user.session_token = secrets.token_urlsafe(32)
    user.last_login_at = datetime.now()

    db.commit()
    db.refresh(user)

    return {
        "message": "登录成功",
        "token": user.session_token,
        "data": public_user_data(user)
    }


@app.post("/auth/me")
def get_current_user(
    request: AuthTokenRequest,
    db: Session = Depends(get_db)
):
    user = get_user_by_token(db, request.token)

    return {
        "message": "当前用户读取成功",
        "data": public_user_data(user)
    }


@app.patch("/auth/profile")
def update_user_profile(
    request: AuthUpdateRequest,
    db: Session = Depends(get_db)
):
    user = get_user_by_token(db, request.token)

    if request.account is not None:
        new_account = request.account.strip()
        validate_account_or_password(new_account, "账号")

        existing = db.query(AuthUser).filter(AuthUser.account == new_account, AuthUser.id != user.id).first()

        if existing:
            raise HTTPException(status_code=400, detail="账号已存在，请换一个账号")

        user.account = new_account

    if request.password is not None and request.password.strip():
        new_password = request.password.strip()
        validate_account_or_password(new_password, "密码")

        salt = secrets.token_hex(16)
        user.password_salt = salt
        user.password_hash = make_password_hash(new_password, salt)

    if request.nickname is not None:
        nickname = request.nickname.strip()
        user.nickname = nickname or user.account

    if request.avatar_base64 is not None:
        user.avatar_base64 = request.avatar_base64

    db.commit()
    db.refresh(user)

    return {
        "message": "用户信息已更新",
        "data": public_user_data(user)
    }


@app.post("/auth/logout")
def logout_user(
    request: AuthTokenRequest,
    db: Session = Depends(get_db)
):
    user = get_user_by_token(db, request.token)

    user.session_token = None
    db.commit()

    return {
        "message": "已退出登录"
    }

SYSTEM_ADMIN_PASSWORD = "xgw2026"


class AuthRegisterV2Request(BaseModel):
    account: str
    password: str
    password_confirm: str
    nickname: Optional[str] = None
    avatar_base64: Optional[str] = None
    role: Optional[str] = "user"
    admin_password: Optional[str] = None


class AuthUpdateV2Request(BaseModel):
    token: str
    account: Optional[str] = None
    nickname: Optional[str] = None
    avatar_base64: Optional[str] = None
    old_password: Optional[str] = None
    password: Optional[str] = None
    password_confirm: Optional[str] = None


@app.post("/auth/register-v2")
def register_user_v2(
    request: AuthRegisterV2Request,
    db: Session = Depends(get_db)
):
    account = request.account.strip()
    password = request.password.strip()
    password_confirm = request.password_confirm.strip()
    nickname = (request.nickname or account).strip()
    role = (request.role or "user").strip()

    validate_account_or_password(account, "账号")
    validate_account_or_password(password, "密码")

    if password != password_confirm:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")

    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="用户属性只能是普通用户或管理员")

    if role == "admin":
        if request.admin_password != SYSTEM_ADMIN_PASSWORD:
            raise HTTPException(status_code=403, detail="系统密码错误，不能注册管理员账号")

    existing = db.query(AuthUser).filter(AuthUser.account == account).first()

    if existing:
        raise HTTPException(status_code=400, detail="账号已存在，请换一个账号")

    salt = secrets.token_hex(16)
    password_hash = make_password_hash(password, salt)
    session_token = secrets.token_urlsafe(32)

    user = AuthUser(
        account=account,
        nickname=nickname or account,
        password_salt=salt,
        password_hash=password_hash,
        role=role,
        avatar_base64=request.avatar_base64,
        session_token=session_token,
        created_at=datetime.now(),
        last_login_at=datetime.now()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "注册成功",
        "token": session_token,
        "data": public_user_data(user)
    }


@app.patch("/auth/profile-v2")
def update_user_profile_v2(
    request: AuthUpdateV2Request,
    db: Session = Depends(get_db)
):
    user = get_user_by_token(db, request.token)

    if request.account is not None:
        new_account = request.account.strip()
        validate_account_or_password(new_account, "账号")

        existing = db.query(AuthUser).filter(
            AuthUser.account == new_account,
            AuthUser.id != user.id
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="账号已存在，请换一个账号")

        user.account = new_account

    if request.nickname is not None:
        nickname = request.nickname.strip()
        user.nickname = nickname or user.account

    if request.avatar_base64 is not None:
        user.avatar_base64 = request.avatar_base64

    wants_change_password = (
        request.old_password is not None or
        request.password is not None or
        request.password_confirm is not None
    )

    if wants_change_password:
        old_password = (request.old_password or "").strip()
        new_password = (request.password or "").strip()
        new_password_confirm = (request.password_confirm or "").strip()

        if not old_password:
            raise HTTPException(status_code=400, detail="修改密码必须输入原密码")

        if not new_password:
            raise HTTPException(status_code=400, detail="请输入新密码")

        if new_password != new_password_confirm:
            raise HTTPException(status_code=400, detail="两次输入的新密码不一致")

        old_hash = make_password_hash(old_password, user.password_salt)

        if old_hash != user.password_hash:
            raise HTTPException(status_code=403, detail="原密码错误，不能修改密码")

        validate_account_or_password(new_password, "新密码")

        salt = secrets.token_hex(16)
        user.password_salt = salt
        user.password_hash = make_password_hash(new_password, salt)

    db.commit()
    db.refresh(user)

    return {
        "message": "用户信息已更新",
        "data": public_user_data(user)
    }

class ClearUpdateHistoryAdminRequest(BaseModel):
    token: str
    password: str
    confirm_text: str


def verify_user_password(user: AuthUser, password: str):
    password_hash = make_password_hash(password, user.password_salt)
    return password_hash == user.password_hash


@app.delete("/update-history/clear-all-admin")
def clear_all_update_history_admin(
    request: ClearUpdateHistoryAdminRequest,
    db: Session = Depends(get_db)
):
    user = get_user_by_token(db, request.token)

    if user.role != "admin":
        raise HTTPException(status_code=403, detail="只有管理员账号可以清空更新历史")

    if not verify_user_password(user, request.password):
        raise HTTPException(status_code=403, detail="管理员密码错误，禁止清空更新历史")

    if request.confirm_text != "清空历史":
        raise HTTPException(status_code=400, detail="确认文字错误，请输入：清空历史")

    count = db.query(UpdateHistory).count()

    db.query(UpdateHistory).delete()
    db.commit()

    return {
        "message": "所有更新历史已清空",
        "deleted_count": count,
        "operator": user.account
    }

class ClearUpdateHistoryAdminV2Request(BaseModel):
    token: str
    system_password: str
    confirm_text: str


class ClearUpdateHistoryRangeAdminRequest(BaseModel):
    token: str = ""
    system_password: str = ""
    confirm_text: str = ""
    start_date: str = ""
    end_date: str = ""


def require_admin_user(db: Session, token: str):
    user = get_user_by_token(db, token)

    if user.role != "admin":
        raise HTTPException(status_code=403, detail="无权限操作，只有管理员可以执行此操作")

    return user


def verify_system_password(system_password: str):
    if system_password != SYSTEM_ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="系统密码错误，禁止执行危险操作")


@app.delete("/update-history/clear-all-admin-v2")
def clear_all_update_history_admin_v2(
    request: ClearUpdateHistoryAdminV2Request,
    db: Session = Depends(get_db)
):
    user = require_admin_user(db, request.token)
    verify_system_password(request.system_password)

    if request.confirm_text != "清空历史":
        raise HTTPException(status_code=400, detail="确认文字错误，请输入：清空历史")

    count = db.query(UpdateHistory).count()

    db.query(UpdateHistory).delete()
    db.commit()

    return {
        "message": "所有更新历史已清空",
        "deleted_count": count,
        "operator": user.account
    }


@app.delete("/update-history/clear-range-admin")
def clear_range_update_history_admin(
    request: ClearUpdateHistoryRangeAdminRequest,
    db: Session = Depends(get_db)
):
    user = require_admin_user(db, request.token)
    verify_system_password(request.system_password)

    if request.confirm_text != "清空历史":
        raise HTTPException(status_code=400, detail="确认文字错误，请输入：清空历史")

    start_text = (request.start_date or "").strip()
    end_text = (request.end_date or "").strip()

    if not start_text or not end_text:
        raise HTTPException(status_code=400, detail="请选择开始日期和结束日期")

    date_pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(date_pattern, start_text) or not re.match(date_pattern, end_text):
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")

    try:
        start_day = datetime.strptime(start_text, "%Y-%m-%d")
        end_day = datetime.strptime(end_text, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")

    start_at = datetime.combine(start_day.date(), datetime.min.time())
    end_at = datetime.combine(end_day.date(), datetime.max.time())

    if start_at > end_at:
        raise HTTPException(status_code=400, detail="开始日期不能晚于结束日期")

    query = db.query(UpdateHistory).filter(
        UpdateHistory.created_at >= start_at,
        UpdateHistory.created_at <= end_at
    )
    count = query.count()

    query.delete(synchronize_session=False)
    db.commit()

    return {
        "message": "指定时间区间内的更新历史已清空",
        "deleted_count": count,
        "operator": user.account,
        "start_date": start_text,
        "end_date": end_text
    }

class BackupImportSecureV3Request(BaseModel):
    token: str
    system_password: str
    verify_token: str
    verify_code: str
    backup_data: dict


@app.post("/backup/import-v3")
def import_backup_data_v3(
    request: BackupImportSecureV3Request,
    db: Session = Depends(get_db)
):
    user = require_admin_user(db, request.token)
    verify_system_password(request.system_password)

    server_code = BACKUP_IMPORT_VERIFY_CODES.get(request.verify_token)

    if not server_code:
        raise HTTPException(status_code=400, detail="验证码已失效，请刷新验证码后重试")

    if request.verify_code.strip().upper() != server_code:
        raise HTTPException(status_code=400, detail="验证码错误，禁止导入备份")

    BACKUP_IMPORT_VERIFY_CODES.pop(request.verify_token, None)

    backup_data = request.backup_data

    if not isinstance(backup_data, dict):
        raise HTTPException(status_code=400, detail="备份数据格式错误")

    data = backup_data.get("data")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="备份文件缺少 data 字段")

    result = {}

    result["clues"] = import_backup_items(db, Clue, data.get("clues", []))
    result["verified_items"] = import_backup_items(db, VerifiedItem, data.get("verified_items", []))
    result["crawl_targets"] = import_backup_items(db, CrawlTarget, data.get("crawl_targets", []))
    result["feedbacks"] = import_backup_items(db, Feedback, data.get("feedbacks", []))
    result["map_points"] = import_backup_items(db, MapPoint, data.get("map_points", []))
    result["routes"] = import_backup_items(db, RoutePlan, data.get("routes", []))
    result["update_histories"] = import_backup_items(db, UpdateHistory, data.get("update_histories", []))

    db.commit()

    total_imported = sum(item["imported_count"] for item in result.values())
    total_skipped = sum(item["skipped_count"] for item in result.values())
    total_failed = sum(item["failed_count"] for item in result.values())

    return {
        "message": "备份导入完成",
        "mode": "管理员安全合并导入：已存在 ID 会跳过，不覆盖旧数据",
        "operator": user.account,
        "total_imported": total_imported,
        "total_skipped": total_skipped,
        "total_failed": total_failed,
        "detail": result
    }
