from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


BASE_DIR = Path(__file__).resolve().parent
COLLECTOR_DB_PATH = BASE_DIR / "collector_data.db"
REQUEST_TIMEOUT_SECONDS = 10
MAX_ITEMS_PER_SOURCE = 30
DETECT_KEYWORD_SUGGESTION = "小谷围 广州大学城 大学城 贝岗 南亭"

DEFAULT_KEYWORDS = [
    "小谷围",
    "广州大学城",
    "大学城",
    "贝岗",
    "南亭",
    "广大",
    "中大",
    "华工",
]

ALLOWED_SOURCE_TYPES = {"rss", "api", "public_html"}
ALLOWED_ITEM_STATUSES = {"new", "reviewed", "ignored"}


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(COLLECTOR_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_collector_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS collector_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                platform TEXT,
                source_type TEXT NOT NULL,
                url TEXT NOT NULL,
                keyword TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                interval_hours INTEGER NOT NULL DEFAULT 24,
                last_run_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                notes TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS collector_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                item_count INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                FOREIGN KEY(source_id) REFERENCES collector_sources(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS collector_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                platform TEXT,
                title TEXT,
                url TEXT,
                summary TEXT,
                published_at TEXT,
                fetched_at TEXT NOT NULL,
                raw_hash TEXT NOT NULL,
                raw_json TEXT,
                raw_text TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                FOREIGN KEY(source_id) REFERENCES collector_sources(id)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_collector_items_source ON collector_items(source_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_collector_items_status ON collector_items(status)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_collector_items_url_unique ON collector_items(url) WHERE url IS NOT NULL AND url != ''")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_collector_items_hash_unique ON collector_items(raw_hash)")
        conn.commit()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    data = dict(row)
    if "enabled" in data:
        data["enabled"] = bool(data["enabled"])
    return data


def normalize_source_type(source_type: str) -> str:
    value = (source_type or "").strip()
    if value not in ALLOWED_SOURCE_TYPES:
        raise ValueError("source_type must be rss, api, or public_html")
    return value


def list_sources() -> List[Dict[str, Any]]:
    init_collector_db()
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM collector_sources ORDER BY id DESC").fetchall()
    return [row_to_dict(row) for row in rows]


def get_source(source_id: int) -> Optional[Dict[str, Any]]:
    init_collector_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM collector_sources WHERE id = ?", (source_id,)).fetchone()
    return row_to_dict(row) if row else None


def create_source(data: Dict[str, Any]) -> Dict[str, Any]:
    init_collector_db()
    source_type = normalize_source_type(data.get("source_type", "rss"))
    current = now_text()
    enabled = 1 if data.get("enabled", True) else 0
    interval_hours = max(1, int(data.get("interval_hours") or 24))

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO collector_sources
            (name, platform, source_type, url, keyword, enabled, interval_hours, last_run_at, created_at, updated_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
            """,
            (
                (data.get("name") or "").strip(),
                (data.get("platform") or "").strip(),
                source_type,
                (data.get("url") or "").strip(),
                (data.get("keyword") or "").strip(),
                enabled,
                interval_hours,
                current,
                current,
                (data.get("notes") or "").strip(),
            ),
        )
        conn.commit()
        source_id = cursor.lastrowid

    return get_source(source_id) or {}


def update_source(source_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    init_collector_db()
    source = get_source(source_id)
    if not source:
        return None

    allowed_fields = {
        "name",
        "platform",
        "source_type",
        "url",
        "keyword",
        "enabled",
        "interval_hours",
        "notes",
    }
    updates = []
    values: List[Any] = []

    for field in allowed_fields:
        if field not in data or data[field] is None:
            continue
        value = data[field]
        if field == "source_type":
            value = normalize_source_type(str(value))
        elif field == "enabled":
            value = 1 if value else 0
        elif field == "interval_hours":
            value = max(1, int(value))
        elif isinstance(value, str):
            value = value.strip()
        updates.append(f"{field} = ?")
        values.append(value)

    if not updates:
        return source

    updates.append("updated_at = ?")
    values.append(now_text())
    values.append(source_id)

    with get_connection() as conn:
        conn.execute(
            f"UPDATE collector_sources SET {', '.join(updates)} WHERE id = ?",
            values,
        )
        conn.commit()

    return get_source(source_id)


def keyword_list(keyword: Optional[str]) -> List[str]:
    text = (keyword or "").strip()
    if not text:
        return DEFAULT_KEYWORDS
    parts = []
    for chunk in text.replace("，", ",").replace("、", ",").replace("\n", ",").split(","):
        item = chunk.strip()
        if item:
            parts.append(item)
    return parts or DEFAULT_KEYWORDS


def item_matches_keywords(item: Dict[str, Any], keywords: Iterable[str]) -> bool:
    combined = " ".join(
        str(item.get(key) or "")
        for key in ["title", "summary", "url", "raw_text"]
    ).lower()
    return any(keyword.lower() in combined for keyword in keywords)


def request_source(url: str) -> requests.Response:
    headers = {
        "User-Agent": "XiaoguweiRealLifeInfoSystem/0.1 public-source-collector"
    }
    response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response


def safe_text(value: Any, limit: int = 2000) -> str:
    text = "" if value is None else str(value).strip()
    return text[:limit]


def raw_hash_for(item: Dict[str, Any]) -> str:
    raw = json.dumps(
        {
            "title": item.get("title"),
            "url": item.get("url"),
            "summary": item.get("summary"),
            "published_at": item.get("published_at"),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_rss_or_atom(text: str, base_url: str) -> List[Dict[str, Any]]:
    root = ET.fromstring(text)
    entries = root.findall(".//item")
    if not entries:
        entries = root.findall(".//{http://www.w3.org/2005/Atom}entry")

    items = []
    for entry in entries[:MAX_ITEMS_PER_SOURCE]:
        title = first_xml_text(entry, ["title", "{http://www.w3.org/2005/Atom}title"])
        link = first_xml_text(entry, ["link", "guid"])
        atom_link = entry.find("{http://www.w3.org/2005/Atom}link")
        if atom_link is not None:
            link = atom_link.attrib.get("href") or link
        summary = first_xml_text(
            entry,
            ["description", "summary", "{http://www.w3.org/2005/Atom}summary", "{http://www.w3.org/2005/Atom}content"],
        )
        published_at = first_xml_text(
            entry,
            ["pubDate", "published", "updated", "{http://www.w3.org/2005/Atom}published", "{http://www.w3.org/2005/Atom}updated"],
        )
        items.append(
            {
                "title": safe_text(title, 300) or "未命名采集条目",
                "url": urljoin(base_url, safe_text(link, 1000)) if link else base_url,
                "summary": strip_html(summary),
                "published_at": safe_text(published_at, 100),
                "raw_text": safe_text(ET.tostring(entry, encoding="unicode"), 4000),
            }
        )
    return items


def first_xml_text(entry: ET.Element, names: List[str]) -> str:
    for name in names:
        found = entry.find(name)
        if found is not None and found.text:
            return found.text.strip()
    return ""


def strip_html(text: Any) -> str:
    raw = safe_text(text, 4000)
    if not raw:
        return ""
    return BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)[:1000]


def response_charset_from_header(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "")
    match = re.search(r"charset=['\"]?([^;'\"]+)", content_type, flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def response_charset_from_xml(content: bytes) -> str:
    head = content[:300].decode("ascii", errors="ignore")
    match = re.search(r"<\?xml[^>]+encoding=['\"]([^'\"]+)['\"]", head, flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def decode_response_text(response: requests.Response) -> str:
    content = response.content or b""
    if not content:
        return ""

    candidates = [
        response_charset_from_header(response),
        response_charset_from_xml(content),
        response.apparent_encoding or "",
        "utf-8",
        "gb18030",
        "gbk",
        "gb2312",
    ]

    tried = set()
    for encoding in candidates:
        normalized = (encoding or "").strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in tried:
            continue
        tried.add(key)
        try:
            decoded = content.decode(normalized)
            if looks_garbled(decoded[:500]):
                continue
            return decoded
        except (LookupError, UnicodeDecodeError):
            continue

    return content.decode("utf-8", errors="replace")


def strip_xml_declaration(text: str) -> str:
    return re.sub(r"^\s*<\?xml[^>]*\?>", "", text or "", count=1, flags=re.IGNORECASE)


def looks_garbled(text: str) -> bool:
    value = safe_text(text, 300)
    if not value:
        return False

    suspicious_tokens = ["�", "□", "æ", "é", "å", "ä", "ç", "ï¿½", "\ufffd"]
    suspicious_count = sum(value.count(token) for token in suspicious_tokens)
    if suspicious_count >= 2:
        return True
    if suspicious_count and suspicious_count / max(len(value), 1) > 0.03:
        return True
    return False


def clean_detected_title(title: str, fallback: str) -> str:
    value = safe_text(title, 120)
    if not value or looks_garbled(value):
        return fallback
    return value


def infer_platform_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if "@" in host:
        host = host.rsplit("@", 1)[-1]
    host = host.split(":", 1)[0].strip()
    return host or "public-source"


def title_from_rss_or_atom(root: ET.Element) -> str:
    channel = root.find("channel")
    if channel is not None:
        title = first_xml_text(channel, ["title"])
        if title:
            return safe_text(title, 120)

    title = first_xml_text(root, ["title", "{http://www.w3.org/2005/Atom}title"])
    if title:
        return safe_text(title, 120)
    return ""


def looks_like_rss_or_atom(text: str) -> Optional[str]:
    try:
        root = ET.fromstring(strip_xml_declaration(text))
    except (ET.ParseError, ValueError):
        return None

    tag = root.tag.lower().split("}", 1)[-1]
    has_channel = root.find("channel") is not None
    if tag in {"rss", "feed"} or has_channel:
        return title_from_rss_or_atom(root)
    return None


def title_from_html(text: str) -> str:
    soup = BeautifulSoup(text, "html.parser")
    if soup.title and soup.title.string:
        return safe_text(soup.title.string, 120)
    h1 = soup.find("h1")
    if h1:
        return safe_text(h1.get_text(" ", strip=True), 120)
    return ""


def name_from_url(url: str, platform: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("-", " ").replace("_", " ")
    if path:
        return safe_text(f"{platform} {path.split('/')[-1]}", 120)
    return platform


def detect_source(url: str) -> Dict[str, Any]:
    target_url = (url or "").strip()
    if not target_url:
        return {"ok": False, "message": "请填写需要识别的公开 URL"}

    parsed = urlparse(target_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {"ok": False, "message": "URL 必须是 http 或 https 公开地址"}

    platform = infer_platform_from_url(target_url)

    try:
        response = request_source(target_url)
    except requests.exceptions.Timeout:
        return {"ok": False, "message": "识别请求超时，请确认该公开 URL 可以访问"}
    except requests.exceptions.RequestException as exc:
        return {"ok": False, "message": f"无法访问该公开 URL：{safe_text(exc, 180)}"}

    content_type = response.headers.get("content-type", "").lower()
    text = decode_response_text(response)
    fallback_name = name_from_url(target_url, platform)
    rss_fallback_name = f"{platform} 公开 RSS"
    html_fallback_name = f"{platform} 公开页面"

    try:
        if "xml" in content_type or "rss" in content_type or "atom" in content_type:
            title = looks_like_rss_or_atom(text)
            if title is not None:
                safe_title = clean_detected_title(title, rss_fallback_name)
                return {
                    "ok": True,
                    "source_type": "rss",
                    "platform": platform,
                    "name": safe_title,
                    "title": safe_title,
                    "keyword_suggestion": DETECT_KEYWORD_SUGGESTION,
                    "message": "识别成功",
                }

        title = looks_like_rss_or_atom(text)
        if title is not None:
            safe_title = clean_detected_title(title, rss_fallback_name)
            return {
                "ok": True,
                "source_type": "rss",
                "platform": platform,
                "name": safe_title,
                "title": safe_title,
                "keyword_suggestion": DETECT_KEYWORD_SUGGESTION,
                "message": "识别成功",
            }

        if "json" in content_type:
            json.loads(text)
            return {
                "ok": True,
                "source_type": "api",
                "platform": platform,
                "name": fallback_name,
                "title": fallback_name,
                "keyword_suggestion": DETECT_KEYWORD_SUGGESTION,
                "message": "识别成功",
            }

        try:
            json.loads(text)
            return {
                "ok": True,
                "source_type": "api",
                "platform": platform,
                "name": fallback_name,
                "title": fallback_name,
                "keyword_suggestion": DETECT_KEYWORD_SUGGESTION,
                "message": "识别成功",
            }
        except json.JSONDecodeError:
            pass

        if "html" in content_type or "<html" in text[:1000].lower() or "<title" in text[:2000].lower():
            title = title_from_html(text)
            safe_title = clean_detected_title(title, html_fallback_name)
            return {
                "ok": True,
                "source_type": "public_html",
                "platform": platform,
                "name": safe_title,
                "title": safe_title,
                "keyword_suggestion": DETECT_KEYWORD_SUGGESTION,
                "message": "识别成功",
            }
    except Exception as exc:
        return {"ok": False, "message": f"识别失败：{safe_text(exc, 180)}"}

    return {"ok": False, "message": "无法识别该公开 URL，或请求超时"}


def parse_json_api(text: str, base_url: str) -> List[Dict[str, Any]]:
    payload = json.loads(text)
    records = extract_json_records(payload)
    items = []

    for record in records[:MAX_ITEMS_PER_SOURCE]:
        if not isinstance(record, dict):
            continue
        title = first_present(record, ["title", "name", "headline"])
        link = first_present(record, ["url", "link", "permalink"])
        summary = first_present(record, ["summary", "description", "content", "text"])
        published_at = first_present(record, ["published_at", "published", "pubDate", "created_at", "date"])
        items.append(
            {
                "title": safe_text(title, 300) or "未命名采集条目",
                "url": urljoin(base_url, safe_text(link, 1000)) if link else base_url,
                "summary": strip_html(summary),
                "published_at": safe_text(published_at, 100),
                "raw_json": json.dumps(record, ensure_ascii=False)[:5000],
            }
        )
    return items


def extract_json_records(payload: Any) -> List[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ["items", "data", "results", "entries", "posts", "list"]:
            value = payload.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = extract_json_records(value)
                if nested:
                    return nested
    return []


def first_present(record: Dict[str, Any], keys: List[str]) -> Any:
    for key in keys:
        if key in record and record[key]:
            return record[key]
    return ""


def parse_public_html(text: str, base_url: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.extract()

    items = []
    seen_urls = set()
    for anchor in soup.find_all("a", href=True):
        title = anchor.get_text(" ", strip=True)
        if not title or len(title) < 2:
            continue
        link = urljoin(base_url, anchor["href"])
        if link in seen_urls:
            continue
        seen_urls.add(link)
        parent_text = anchor.parent.get_text(" ", strip=True) if anchor.parent else title
        items.append(
            {
                "title": safe_text(title, 300),
                "url": safe_text(link, 1000),
                "summary": safe_text(parent_text, 1000),
                "published_at": "",
                "raw_text": safe_text(parent_text, 4000),
            }
        )
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break
    return items


def fetch_source_items(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    response = request_source(source["url"])
    source_type = source["source_type"]
    if source_type == "rss":
        return parse_rss_or_atom(response.text, source["url"])
    if source_type == "api":
        return parse_json_api(response.text, source["url"])
    if source_type == "public_html":
        return parse_public_html(response.text, source["url"])
    raise ValueError("unsupported source_type")


def save_items(source: Dict[str, Any], items: List[Dict[str, Any]]) -> int:
    source_keywords = keyword_list(source.get("keyword"))
    fetched_at = now_text()
    inserted = 0

    with get_connection() as conn:
        for item in items:
            if not item_matches_keywords(item, source_keywords):
                continue
            item["raw_hash"] = raw_hash_for(item)
            try:
                conn.execute(
                    """
                    INSERT INTO collector_items
                    (source_id, platform, title, url, summary, published_at, fetched_at, raw_hash, raw_json, raw_text, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
                    """,
                    (
                        source["id"],
                        source.get("platform") or "",
                        safe_text(item.get("title"), 300),
                        safe_text(item.get("url"), 1000),
                        safe_text(item.get("summary"), 1000),
                        safe_text(item.get("published_at"), 100),
                        fetched_at,
                        item["raw_hash"],
                        item.get("raw_json"),
                        item.get("raw_text"),
                    ),
                )
                inserted += 1
            except sqlite3.IntegrityError:
                continue
        conn.commit()
    return inserted


def record_run(source_id: Optional[int], status: str, started_at: str, item_count: int, error_message: str = "") -> Dict[str, Any]:
    finished_at = now_text()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO collector_runs
            (source_id, status, started_at, finished_at, item_count, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (source_id, status, started_at, finished_at, item_count, safe_text(error_message, 1000)),
        )
        if source_id:
            conn.execute(
                "UPDATE collector_sources SET last_run_at = ?, updated_at = ? WHERE id = ?",
                (finished_at, finished_at, source_id),
            )
        conn.commit()
        run_id = cursor.lastrowid

    return {
        "id": run_id,
        "source_id": source_id,
        "status": status,
        "started_at": started_at,
        "finished_at": finished_at,
        "item_count": item_count,
        "error_message": error_message,
    }


def run_source(source_id: int) -> Dict[str, Any]:
    init_collector_db()
    source = get_source(source_id)
    if not source:
        raise ValueError("collector source not found")

    started_at = now_text()
    try:
        items = fetch_source_items(source)
        inserted = save_items(source, items)
        status = "success"
        error = ""
    except Exception as exc:
        inserted = 0
        status = "failed"
        error = str(exc)

    run = record_run(source_id, status, started_at, inserted, error)
    return {"source": source, "run": run}


def enabled_sources() -> List[Dict[str, Any]]:
    init_collector_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM collector_sources WHERE enabled = 1 ORDER BY id ASC"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def run_all_enabled_sources() -> Dict[str, Any]:
    init_collector_db()
    sources = enabled_sources()
    if not sources:
        skipped_run = record_run(
            None,
            "skipped",
            now_text(),
            0,
            "没有启用的采集源，已安全跳过",
        )
        return {
            "message": "没有启用的采集源，已安全跳过",
            "total_sources": 0,
            "success_count": 0,
            "failed_count": 0,
            "item_count": 0,
            "results": [{"source": None, "run": skipped_run}],
        }

    results = []
    for source in sources:
        results.append(run_source(source["id"]))

    success_count = sum(1 for result in results if result["run"]["status"] == "success")
    failed_count = sum(1 for result in results if result["run"]["status"] == "failed")
    item_count = sum(result["run"]["item_count"] for result in results)

    return {
        "message": "外部平台采集任务执行完成",
        "total_sources": len(sources),
        "success_count": success_count,
        "failed_count": failed_count,
        "item_count": item_count,
        "results": results,
    }


def list_items(
    platform: str = "",
    source_id: Optional[int] = None,
    status: str = "",
    keyword: str = "",
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    init_collector_db()
    clauses = []
    values: List[Any] = []

    if platform:
        clauses.append("platform LIKE ?")
        values.append(f"%{platform}%")
    if source_id:
        clauses.append("source_id = ?")
        values.append(source_id)
    if status:
        if status not in ALLOWED_ITEM_STATUSES:
            raise ValueError("status must be new, reviewed, or ignored")
        clauses.append("status = ?")
        values.append(status)
    if keyword:
        clauses.append("(title LIKE ? OR summary LIKE ? OR url LIKE ?)")
        like = f"%{keyword}%"
        values.extend([like, like, like])

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    safe_limit = max(1, min(int(limit or 50), 100))
    safe_offset = max(0, int(offset or 0))

    with get_connection() as conn:
        total = conn.execute(f"SELECT COUNT(*) AS count FROM collector_items {where}", values).fetchone()["count"]
        rows = conn.execute(
            f"""
            SELECT collector_items.*, collector_sources.name AS source_name
            FROM collector_items
            LEFT JOIN collector_sources ON collector_items.source_id = collector_sources.id
            {where}
            ORDER BY collector_items.id DESC
            LIMIT ? OFFSET ?
            """,
            values + [safe_limit, safe_offset],
        ).fetchall()

    return {
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
        "data": [row_to_dict(row) for row in rows],
    }


def list_runs(source_id: Optional[int] = None, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    init_collector_db()
    clauses = []
    values: List[Any] = []
    if source_id:
        clauses.append("collector_runs.source_id = ?")
        values.append(source_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    safe_limit = max(1, min(int(limit or 50), 100))
    safe_offset = max(0, int(offset or 0))

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) AS count FROM collector_runs {where}",
            values,
        ).fetchone()["count"]
        rows = conn.execute(
            f"""
            SELECT collector_runs.*, collector_sources.name AS source_name
            FROM collector_runs
            LEFT JOIN collector_sources ON collector_runs.source_id = collector_sources.id
            {where}
            ORDER BY collector_runs.id DESC
            LIMIT ? OFFSET ?
            """,
            values + [safe_limit, safe_offset],
        ).fetchall()

    return {
        "total": total,
        "limit": safe_limit,
        "offset": safe_offset,
        "data": [row_to_dict(row) for row in rows],
    }
