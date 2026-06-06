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


def start_scheduler():
    """
    启动定时任务。
    第一版设置为每天早上9点自动运行。
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

    scheduler.start()

    print("[定时任务] 已启动：每天早上 09:00 自动采集")
    return scheduler