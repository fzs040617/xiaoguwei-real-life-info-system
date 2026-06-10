from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

from crawler_service import run_daily_crawl


def daily_crawl_job():
    """
    每天早上9点自动执行的采集任务。
    现在已经接入真实采集逻辑：公开网页 → 线索库。
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("=" * 60)
    print(f"[每日自动采集任务] 已触发，当前时间：{now}")

    result = run_daily_crawl()

    print(f"[每日自动采集任务] 执行结果：{result}")
    print("=" * 60)

    return result


def daily_platform_collector_job():
    """
    每天凌晨执行外部平台公开源采集任务。
    只读取 collector_data.db 中 enabled=true 的公开采集源。
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("=" * 60)
    print(f"[外部平台每日采集任务] 已触发，当前时间：{now}")

    try:
        from platform_collector import run_all_enabled_sources
        result = run_all_enabled_sources()
    except Exception as exc:
        result = {
            "message": "外部平台每日采集任务失败，但不影响主系统",
            "error": str(exc)
        }

    print(f"[外部平台每日采集任务] 执行结果：{result}")
    print("=" * 60)

    return result


def start_scheduler():
    """
    启动定时任务。保留旧采集任务，并新增独立外部平台公开源采集任务。
    """
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

    scheduler.add_job(
        daily_crawl_job,
        trigger="cron",
        hour=9,
        minute=0,
        id="daily_crawl_job",
        replace_existing=True
    )

    scheduler.add_job(
        daily_platform_collector_job,
        trigger="cron",
        hour=3,
        minute=30,
        id="daily_platform_collector_job",
        replace_existing=True
    )

    scheduler.start()

    print("[定时任务] 已启动：每天早上 09:00 自动采集")
    print("[定时任务] 已启动：每天凌晨 03:30 外部平台公开源采集")
    return scheduler
