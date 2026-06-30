from __future__ import annotations

import hashlib
import csv
import io
import json
import re
import sqlite3
import time
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
AUTHORIZED_PACKAGE_TIMEOUT_SECONDS = 8
MAX_ITEMS_PER_SOURCE = 30
MAX_HTML_SHALLOW_LINKS = 20
REQUEST_DELAY_SECONDS = 0.15
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

AUTHORIZED_SOURCE_TYPES = {"local_folder", "data_package_url", "authorized_api", "data_provider"}
ALLOWED_SOURCE_TYPES = {"rss", "api", "public_html", *AUTHORIZED_SOURCE_TYPES}
ALLOWED_ITEM_STATUSES = {"new", "reviewed", "ignored"}
BLOCKED_PATH_KEYWORDS = {
    "login",
    "passport",
    "account",
    "user",
    "cart",
    "pay",
    "order",
    "admin",
    "api",
}
BLOCKED_DOWNLOAD_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".rar",
    ".7z",
}


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
        raise ValueError("source_type must be rss, api, public_html, local_folder, data_package_url, authorized_api, or data_provider")
    return value


def is_authorized_source_type(source_type: str) -> bool:
    return (source_type or "").strip() in AUTHORIZED_SOURCE_TYPES


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
        return []
    parts = []
    normalized = re.sub(r"[\s,，;；、]+", ",", text)
    for chunk in normalized.split(","):
        item = chunk.strip()
        if item:
            parts.append(item)
    return parts


def split_source_filter_keywords(value: Optional[str]) -> List[str]:
    text = (value or "").strip()
    if not text:
        return []
    return [chunk.strip() for chunk in re.split(r"[\s,，、;；]+", text) if chunk.strip()]


def dedupe_keywords(keywords: Iterable[str]) -> List[str]:
    seen = set()
    values = []
    for keyword in keywords:
        value = str(keyword or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        values.append(value)
    return values


def parse_source_filters(notes: Optional[str]) -> Dict[str, List[str]]:
    text = safe_text(notes, 5000)
    if not text:
        return {"include": [], "exclude": []}

    include_labels = [
        "\u5173\u952e\u8bcd",
        "\u5173\u952e\u5b57",
        "include",
        "include_keywords",
    ]
    exclude_labels = [
        "\u6392\u9664\u5173\u952e\u8bcd",
        "\u6392\u9664",
        "exclude",
        "exclude_keywords",
    ]
    all_labels = sorted([*include_labels, *exclude_labels], key=len, reverse=True)
    marker = "|".join(re.escape(label) for label in all_labels)

    def collect(labels: List[str]) -> List[str]:
        label_pattern = "|".join(re.escape(label) for label in labels)
        values: List[str] = []
        pattern = re.compile(
            rf"(?:^|[\r\n;；])\s*(?:{label_pattern})\s*[:：]\s*(.+?)(?=(?:[\r\n;；]\s*(?:{marker})\s*[:：])|$)",
            re.I | re.S,
        )
        for match in pattern.finditer(text):
            values.extend(split_source_filter_keywords(match.group(1)))
        return dedupe_keywords(values)

    return {
        "include": collect(include_labels),
        "exclude": collect(exclude_labels),
    }


def source_filters_for(source: Dict[str, Any]) -> Dict[str, List[str]]:
    filters = parse_source_filters(source.get("notes"))
    filters["include"] = dedupe_keywords([*keyword_list(source.get("keyword")), *filters["include"]])
    return filters


def collector_item_search_text(item: Dict[str, Any]) -> str:
    return " ".join(
        str(item.get(key) or "")
        for key in ["title", "summary", "url", "raw_text", "platform"]
    ).lower()


def item_matches_keywords(item: Dict[str, Any], keywords: Iterable[str]) -> bool:
    keyword_values = [keyword.lower() for keyword in keywords if str(keyword or "").strip()]
    if not keyword_values:
        return True
    combined = collector_item_search_text(item)
    return any(keyword in combined for keyword in keyword_values)


def matched_keywords_for_item(item: Dict[str, Any], keywords: Iterable[str]) -> List[str]:
    keyword_values = [str(keyword or "").strip() for keyword in keywords if str(keyword or "").strip()]
    if not keyword_values:
        return []
    combined = collector_item_search_text(item)
    return [keyword for keyword in keyword_values if keyword.lower() in combined]


def passes_source_filters(item: Dict[str, Any], filters: Dict[str, List[str]]) -> bool:
    include_keywords = filters.get("include") or []
    exclude_keywords = filters.get("exclude") or []
    combined = collector_item_search_text(item)
    if exclude_keywords and any(keyword.lower() in combined for keyword in exclude_keywords):
        return False
    if include_keywords and not any(keyword.lower() in combined for keyword in include_keywords):
        return False
    return True


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


def is_meaningful_manual_value(value: Any) -> bool:
    text = safe_text(value, 300).lower()
    invalid_values = {"", "留空", "无", "暂无", "null", "undefined", "none", "nan", "n/a", "-"}
    if text in invalid_values:
        return False
    if re.fullmatch(r"\d{1,3}", safe_text(value, 300)):
        return False
    return True


def clean_manual_import_text(value: Any, limit: int = 1000) -> str:
    text = safe_text(value, limit)
    for _ in range(8):
        before = text
        text = re.sub(r"^\s*(?:来源平台)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|nan|n/a|-)?\s*", "", text, flags=re.I)
        text = re.sub(r"^\s*(?:URL|链接|来源链接|公开 URL)\s*[：:]\s*(?:留空|无|暂无|null|undefined|none|nan|n/a|-)?\s*", "", text, flags=re.I)
        text = re.sub(r"^\s*(?:粘贴公开文本|公开文本|摘要|正文|文本|内容)\s*[：:]\s*", "", text, flags=re.I)
        text = re.sub(r"^\s*(?:留空|无|暂无|null|undefined|none|nan|n/a|-)\s+", "", text, flags=re.I)
        text = re.sub(r"\s+", " ", text).strip()
        if text == before:
            break
    return text[:limit]


def normalize_manual_url(value: Any) -> str:
    text = clean_manual_import_text(value, 1000)
    if not is_meaningful_manual_value(text):
        return ""
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return parsed._replace(fragment="").geturl()
    raise ValueError("公开 URL 必须是 http/https 链接或留空")


def manual_title_from_summary(summary: str) -> str:
    text = clean_manual_import_text(summary, 300)
    if not is_meaningful_manual_value(text):
        return ""
    first_sentence = re.split(r"[。！？!?]", text, maxsplit=1)[0].strip()
    candidate = first_sentence or text
    return candidate[:30].strip()


def normalize_authorized_platform(value: Any, fallback: str = "") -> str:
    text = clean_manual_import_text(value, 120)
    fallback_text = clean_manual_import_text(fallback, 120)
    candidate = text if is_meaningful_manual_value(text) else fallback_text
    lowered = candidate.lower()
    if "小红书" in candidate or "xiaohongshu" in lowered or "xhs" in lowered:
        return "小红书授权数据"
    if "美团" in candidate or "meituan" in lowered:
        return "美团授权数据"
    if "大众点评" in candidate or "点评" in candidate or "dianping" in lowered:
        return "大众点评授权数据"
    if is_meaningful_manual_value(candidate):
        return candidate
    return "其他授权数据源"


def normalize_authorized_url(value: Any) -> str:
    text = clean_manual_import_text(value, 1000)
    if not is_meaningful_manual_value(text):
        return ""
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return parsed._replace(fragment="").geturl()
    return ""


def first_authorized_value(row: Dict[str, Any], keys: List[str]) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    normalized = {str(key).strip().lower().replace(" ", ""): value for key, value in row.items()}
    for key in keys:
        lookup = str(key).strip().lower().replace(" ", "")
        if lookup in normalized and normalized[lookup] not in (None, ""):
            return normalized[lookup]
    return ""


def authorized_title_from_summary(summary: str) -> str:
    text = clean_manual_import_text(summary, 300)
    if not is_meaningful_manual_value(text):
        return ""
    first_sentence = re.split(r"[。！？!?\n]", text, maxsplit=1)[0].strip()
    return (first_sentence or text)[:30].strip()


def normalize_authorized_platform_row(row: Dict[str, Any], source: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    platform = normalize_authorized_platform(
        first_authorized_value(row, ["platform", "source_platform", "来源平台", "平台"]),
        source.get("platform") or "",
    )
    url = normalize_authorized_url(first_authorized_value(row, ["url", "link", "公开URL", "公开 URL", "链接", "来源链接"]))
    summary = clean_manual_import_text(
        first_authorized_value(row, ["summary", "description", "content", "text", "摘要", "正文", "内容", "线索简介"]),
        1000,
    )
    title = clean_manual_import_text(first_authorized_value(row, ["title", "name", "标题", "名称"]), 300)
    if not is_meaningful_manual_value(title):
        title = authorized_title_from_summary(summary)
    if not is_meaningful_manual_value(title) and not is_meaningful_manual_value(summary):
        return None
    if not is_meaningful_manual_value(title):
        title = "未命名授权数据条目"
    if not is_meaningful_manual_value(summary):
        summary = ""

    source_note = clean_manual_import_text(
        first_authorized_value(row, ["source_note", "notes", "note", "来源说明", "说明", "备注"]),
        500,
    )

    published_at = clean_manual_import_text(
        first_authorized_value(row, ["published_at", "published", "date", "created_at", "发布时间", "发布日期"]),
        100,
    )
    if not is_meaningful_manual_value(published_at):
        published_at = ""

    raw_json = json.dumps(row, ensure_ascii=False)[:5000]
    return {
        "title": title,
        "url": url,
        "summary": summary,
        "published_at": published_at,
        "platform": platform,
        "raw_json": raw_json,
        "raw_text": compact_text([title, summary, source_note], 4000),
        "source_note": source_note,
    }


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


def item_already_exists(conn: sqlite3.Connection, item: Dict[str, Any]) -> bool:
    raw_hash = item.get("raw_hash") or raw_hash_for(item)
    url = safe_text(item.get("url"), 1000)
    if url:
        existed = conn.execute(
            "SELECT id FROM collector_items WHERE url = ? OR raw_hash = ? LIMIT 1",
            (url, raw_hash),
        ).fetchone()
    else:
        existed = conn.execute(
            "SELECT id FROM collector_items WHERE raw_hash = ? LIMIT 1",
            (raw_hash,),
        ).fetchone()
    return existed is not None


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


def compact_text(parts: Iterable[Any], limit: int = 1000) -> str:
    text = " ".join(safe_text(part, 500) for part in parts if safe_text(part, 500))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def normalize_public_url(url: str, base_url: str = "") -> str:
    value = urljoin(base_url, safe_text(url, 1000))
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return parsed._replace(fragment="").geturl()


def is_safe_public_child_url(url: str, base_url: str) -> bool:
    normalized = normalize_public_url(url, base_url)
    if not normalized:
        return False
    parsed = urlparse(normalized)
    base = urlparse(base_url)
    if parsed.netloc.lower() != base.netloc.lower():
        return False
    lowered_path = parsed.path.lower()
    if any(keyword in lowered_path for keyword in BLOCKED_PATH_KEYWORDS):
        return False
    if any(lowered_path.endswith(extension) for extension in BLOCKED_DOWNLOAD_EXTENSIONS):
        return False
    return True


def prepare_html_soup(text: str) -> BeautifulSoup:
    soup = BeautifulSoup(text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.extract()
    return soup


def html_page_item(text: str, page_url: str, fallback_title: str = "") -> Dict[str, Any]:
    soup = prepare_html_soup(text)
    title = title_from_html(text) or fallback_title or infer_platform_from_url(page_url)
    description_tag = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
    description = description_tag.get("content", "") if description_tag else ""
    headings = [tag.get_text(" ", strip=True) for tag in soup.find_all(["h1", "h2", "h3"], limit=8)]
    paragraphs = [tag.get_text(" ", strip=True) for tag in soup.find_all("p", limit=8)]
    summary = compact_text([description, *headings, *paragraphs], 1000)
    raw_text = compact_text([title, description, *headings, *paragraphs], 4000)
    return {
        "title": safe_text(title, 300) or "未命名采集条目",
        "url": safe_text(page_url, 1000),
        "summary": summary,
        "published_at": "",
        "raw_text": raw_text or summary,
    }


def html_link_candidates(text: str, base_url: str) -> List[Dict[str, str]]:
    soup = prepare_html_soup(text)
    candidates = []
    seen_urls = set()
    for anchor in soup.find_all("a", href=True):
        title = anchor.get_text(" ", strip=True)
        if not title or len(title) < 2:
            continue
        link = normalize_public_url(anchor["href"], base_url)
        if not link or link in seen_urls:
            continue
        if not is_safe_public_child_url(link, base_url):
            continue
        seen_urls.add(link)
        parent_text = anchor.parent.get_text(" ", strip=True) if anchor.parent else title
        candidates.append(
            {
                "title": safe_text(title, 300),
                "url": safe_text(link, 1000),
                "summary": safe_text(parent_text, 1000),
                "raw_text": safe_text(parent_text, 4000),
            }
        )
        if len(candidates) >= MAX_HTML_SHALLOW_LINKS:
            break
    return candidates


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


def decode_authorized_bytes(content: bytes) -> str:
    if not content:
        return ""
    for encoding in ["utf-8-sig", "utf-8", "gb18030", "gbk"]:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def parse_authorized_csv_text(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text or ""))
    rows = []
    for row in reader:
        if isinstance(row, dict):
            rows.append({safe_text(key, 120): value for key, value in row.items() if key is not None})
    return rows


def parse_authorized_json_text(text: str) -> List[Dict[str, Any]]:
    payload = json.loads(text or "[]")
    records = extract_json_records(payload)
    return [record for record in records if isinstance(record, dict)]


def load_rows_from_authorized_file(path: Path) -> List[Dict[str, Any]]:
    suffix = path.suffix.lower()
    text = decode_authorized_bytes(path.read_bytes())
    if suffix == ".csv":
        return parse_authorized_csv_text(text)
    if suffix == ".json":
        return parse_authorized_json_text(text)
    return []


def load_rows_from_local_folder(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    local_path = Path(safe_text(config.get("url"), 1000))
    if not local_path.exists() or not local_path.is_dir():
        raise ValueError("授权数据本地目录不存在或不是文件夹")

    files = sorted([*local_path.glob("*.csv"), *local_path.glob("*.json")])
    rows: List[Dict[str, Any]] = []
    for path in files:
        if not path.is_file():
            continue
        for row in load_rows_from_authorized_file(path):
            row.setdefault("source_file", str(path))
            rows.append(row)
    return rows


def request_authorized_package(url: str) -> requests.Response:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("授权数据包 URL 必须是 http/https")
    headers = {
        "User-Agent": "XiaoguweiRealLifeInfoSystem/0.1 authorized-data-package"
    }
    response = requests.get(url, headers=headers, timeout=AUTHORIZED_PACKAGE_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response


def load_rows_from_data_package_url(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    package_url = safe_text(config.get("url"), 1000)
    response = request_authorized_package(package_url)
    text = decode_authorized_bytes(response.content or b"")
    content_type = response.headers.get("content-type", "").lower()
    path_suffix = Path(urlparse(package_url).path).suffix.lower()
    if path_suffix == ".csv" or "csv" in content_type:
        return parse_authorized_csv_text(text)
    if path_suffix == ".json" or "json" in content_type:
        return parse_authorized_json_text(text)
    try:
        return parse_authorized_json_text(text)
    except json.JSONDecodeError:
        return parse_authorized_csv_text(text)


def load_rows_from_authorized_api(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    raise ValueError("授权 API / 合法数据服务商接口已预留配置入口，本轮未接入真实密钥或平台接口")


def first_present(record: Dict[str, Any], keys: List[str]) -> Any:
    for key in keys:
        if key in record and record[key]:
            return record[key]
    return ""


def parse_public_html(text: str, base_url: str, shallow_fetch: bool = True) -> List[Dict[str, Any]]:
    items = [html_page_item(text, base_url)]
    seen_urls = {base_url}
    candidates = html_link_candidates(text, base_url)

    for candidate in candidates:
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break
        link = candidate["url"]
        if link in seen_urls:
            continue
        seen_urls.add(link)

        if not shallow_fetch:
            items.append(candidate)
            continue

        try:
            time.sleep(REQUEST_DELAY_SECONDS)
            response = request_source(link)
            content_type = response.headers.get("content-type", "").lower()
            if "html" not in content_type and "<html" not in decode_response_text(response)[:1000].lower():
                continue
            detail_text = decode_response_text(response)
            items.append(html_page_item(detail_text, link, candidate.get("title", "")))
        except requests.exceptions.RequestException:
            continue

    return items[:MAX_ITEMS_PER_SOURCE]


def fetch_source_items(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    if is_authorized_source_type(source.get("source_type", "")):
        raise ValueError("授权数据源请使用授权接入运行入口")
    response = request_source(source["url"])
    source_type = source["source_type"]
    text = decode_response_text(response)
    if source_type == "rss":
        return parse_rss_or_atom(text, source["url"])
    if source_type == "api":
        return parse_json_api(text, source["url"])
    if source_type == "public_html":
        return parse_public_html(text, source["url"])
    raise ValueError("unsupported source_type")


def save_items(source: Dict[str, Any], items: List[Dict[str, Any]]) -> Dict[str, int]:
    source_filters = source_filters_for(source)
    fetched_at = now_text()
    inserted = 0
    filtered = 0

    with get_connection() as conn:
        for item in items:
            if inserted >= MAX_ITEMS_PER_SOURCE:
                break
            item.setdefault("platform", source.get("platform") or "")
            if not passes_source_filters(item, source_filters):
                filtered += 1
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
    return {"inserted": inserted, "filtered": filtered}


def title_summary_hash_for(item: Dict[str, Any]) -> str:
    raw = json.dumps(
        {
            "title": safe_text(item.get("title"), 300),
            "summary": safe_text(item.get("summary"), 1000),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def insert_collector_item_if_new(conn: sqlite3.Connection, source: Dict[str, Any], item: Dict[str, Any], fetched_at: str) -> str:
    url = safe_text(item.get("url"), 1000)
    raw_hash = item.get("raw_hash") or raw_hash_for(item)
    title_summary_hash = title_summary_hash_for(item)

    if url:
        existed = conn.execute(
            "SELECT id FROM collector_items WHERE url = ? LIMIT 1",
            (url,),
        ).fetchone()
        if existed:
            return "skipped_url"

    existed_hash = conn.execute(
        "SELECT id FROM collector_items WHERE raw_hash = ? LIMIT 1",
        (raw_hash,),
    ).fetchone()
    if existed_hash:
        return "skipped_hash"

    rows = conn.execute(
        "SELECT title, summary FROM collector_items WHERE title = ? LIMIT 50",
        (safe_text(item.get("title"), 300),),
    ).fetchall()
    for row in rows:
        existed_hash = title_summary_hash_for({"title": row["title"], "summary": row["summary"]})
        if existed_hash == title_summary_hash:
            return "skipped_title_summary"

    conn.execute(
        """
        INSERT INTO collector_items
        (source_id, platform, title, url, summary, published_at, fetched_at, raw_hash, raw_json, raw_text, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        """,
        (
            source["id"],
            item.get("platform") or source.get("platform") or "",
            safe_text(item.get("title"), 300),
            url,
            safe_text(item.get("summary"), 1000),
            safe_text(item.get("published_at"), 100),
            fetched_at,
            raw_hash,
            item.get("raw_json"),
            item.get("raw_text"),
        ),
    )
    return "inserted"


def load_authorized_source_rows(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    source_type = source.get("source_type") or ""
    if source_type == "local_folder":
        return load_rows_from_local_folder(source)
    if source_type == "data_package_url":
        return load_rows_from_data_package_url(source)
    if source_type in {"authorized_api", "data_provider"}:
        return load_rows_from_authorized_api(source)
    raise ValueError("不是合法授权数据源类型")


def run_authorized_source(source_id: int) -> Dict[str, Any]:
    init_collector_db()
    source = get_source(source_id)
    if not source:
        raise ValueError("collector source not found")
    if not is_authorized_source_type(source.get("source_type", "")):
        raise ValueError("不是合法授权数据源")

    started_at = now_text()
    inserted = 0
    skipped = 0
    failed_rows = 0
    errors: List[str] = []

    try:
        rows = load_authorized_source_rows(source)
        fetched_at = now_text()
        with get_connection() as conn:
            for row in rows:
                item = normalize_authorized_platform_row(row, source)
                if not item:
                    skipped += 1
                    continue
                item["raw_hash"] = raw_hash_for(item)
                result = insert_collector_item_if_new(conn, source, item, fetched_at)
                if result == "inserted":
                    inserted += 1
                else:
                    skipped += 1
            conn.commit()
        status = "success"
        error = ""
    except Exception as exc:
        status = "failed"
        error = safe_text(exc, 500)
        errors.append(error)

    run = record_run(source_id, status, started_at, inserted, error)
    return {
        "source": source,
        "run": run,
        "new_items": inserted,
        "skipped_items": skipped,
        "failed_rows": failed_rows,
        "errors": errors,
    }


def preview_source(source_id: int) -> Dict[str, Any]:
    init_collector_db()
    source = get_source(source_id)
    if not source:
        raise ValueError("collector source not found")

    try:
        items = fetch_source_items(source)
    except requests.exceptions.Timeout:
        return {
            "source": source,
            "candidates_count": 0,
            "matched_count": 0,
            "reason": "网络超时",
            "data": [],
        }
    except Exception as exc:
        return {
            "source": source,
            "candidates_count": 0,
            "matched_count": 0,
            "reason": preview_failure_reason(str(exc), source.get("source_type", "")),
            "data": [],
        }

    source_filters = source_filters_for(source)
    include_keywords = source_filters.get("include") or []
    preview_items = []
    matched_count = 0

    with get_connection() as conn:
        for item in items:
            item.setdefault("platform", source.get("platform") or "")
            matched_keywords = matched_keywords_for_item(item, include_keywords)
            matched = passes_source_filters(item, source_filters)
            if matched:
                matched_count += 1
            item["raw_hash"] = raw_hash_for(item)
            if len(preview_items) >= 10:
                continue
            preview_items.append(
                {
                    "title": safe_text(item.get("title"), 300),
                    "url": safe_text(item.get("url"), 1000),
                    "summary": safe_text(item.get("summary"), 1000),
                    "matched_keywords": matched_keywords,
                    "would_save": bool(matched and not item_already_exists(conn, item)),
                }
            )

    return {
        "source": source,
        "candidates_count": len(items),
        "matched_count": matched_count,
        "reason": preview_reason(len(items), matched_count, source.get("source_type", "")),
        "data": preview_items,
    }


def preview_reason(candidates_count: int, matched_count: int, source_type: str) -> str:
    if candidates_count <= 0:
        if source_type == "public_html":
            return "页面无可解析链接，或页面需要 JS 动态加载"
        return "未解析到公开结果"
    if matched_count <= 0:
        return "未命中关键词"
    return "已解析到可预览结果"


def preview_failure_reason(error_message: str, source_type: str) -> str:
    message = safe_text(error_message, 300).lower()
    if "timeout" in message or "timed out" in message:
        return "网络超时"
    if source_type not in ALLOWED_SOURCE_TYPES:
        return "源类型暂不支持预览"
    if "json" in message:
        return "公开 JSON API 内容格式不可解析"
    return "页面需要 JS 动态加载、网络不可达或内容格式暂不可解析"


def create_manual_item(data: Dict[str, Any]) -> Dict[str, Any]:
    init_collector_db()
    summary = clean_manual_import_text(data.get("summary"), 1000)
    title = clean_manual_import_text(data.get("title"), 300)
    if not is_meaningful_manual_value(title):
        title = manual_title_from_summary(summary)
    if not is_meaningful_manual_value(title):
        raise ValueError("请填写标题或摘要")

    platform = clean_manual_import_text(data.get("platform"), 120)
    if not is_meaningful_manual_value(platform):
        platform = "人工导入"
    url = normalize_manual_url(data.get("url"))
    notes = clean_manual_import_text(data.get("notes") or data.get("source_note"), 1000)
    if not is_meaningful_manual_value(summary):
        summary = ""
    if is_meaningful_manual_value(notes):
        summary = compact_text([summary, f"来源说明：{notes}"], 1000)
    raw_text = compact_text([summary, notes], 4000)
    fetched_at = now_text()
    item = {
        "title": title,
        "url": url,
        "summary": summary,
        "published_at": "",
    }
    raw_hash = raw_hash_for(item)

    with get_connection() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO collector_items
                (source_id, platform, title, url, summary, published_at, fetched_at, raw_hash, raw_json, raw_text, status)
                VALUES (NULL, ?, ?, ?, ?, '', ?, ?, NULL, ?, 'new')
                """,
                (
                    platform,
                    title,
                    url,
                    summary,
                    fetched_at,
                    raw_hash,
                    raw_text,
                ),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            existed = conn.execute(
                "SELECT * FROM collector_items WHERE raw_hash = ? OR (url = ? AND ? != '') LIMIT 1",
                (raw_hash, url, url),
            ).fetchone()
            if existed:
                return row_to_dict(existed)
            raise
        item_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM collector_items WHERE id = ?", (item_id,)).fetchone()
    return row_to_dict(row) if row else {}


def get_collector_item(item_id: int) -> Optional[Dict[str, Any]]:
    init_collector_db()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT collector_items.*, collector_sources.name AS source_name
            FROM collector_items
            LEFT JOIN collector_sources ON collector_items.source_id = collector_sources.id
            WHERE collector_items.id = ?
            """,
            (item_id,),
        ).fetchone()
    return row_to_dict(row) if row else None


def update_collector_item_status(item_id: int, status: str) -> Optional[Dict[str, Any]]:
    init_collector_db()
    if status not in ALLOWED_ITEM_STATUSES:
        raise ValueError("status must be new, reviewed, or ignored")

    with get_connection() as conn:
        row = conn.execute("SELECT id FROM collector_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE collector_items SET status = ? WHERE id = ?",
            (status, item_id),
        )
        conn.commit()

    return get_collector_item(item_id)


def mark_collector_item_reviewed(item_id: int) -> Optional[Dict[str, Any]]:
    return update_collector_item_status(item_id, "reviewed")


def mark_collector_item_ignored(item_id: int) -> Optional[Dict[str, Any]]:
    return update_collector_item_status(item_id, "ignored")


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
    if is_authorized_source_type(source.get("source_type", "")):
        return run_authorized_source(source_id)

    started_at = now_text()
    try:
        items = fetch_source_items(source)
        save_result = save_items(source, items)
        inserted = save_result["inserted"]
        filtered = save_result["filtered"]
        status = "success"
        error = f"关键词筛选跳过 {filtered} 条" if filtered else ""
    except Exception as exc:
        inserted = 0
        filtered = 0
        status = "failed"
        error = str(exc)

    run = record_run(source_id, status, started_at, inserted, error)
    return {"source": source, "run": run, "filtered_items": filtered}


def enabled_sources() -> List[Dict[str, Any]]:
    init_collector_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM collector_sources
            WHERE enabled = 1 AND source_type NOT IN ('local_folder', 'data_package_url', 'authorized_api', 'data_provider')
            ORDER BY id ASC
            """
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
    filtered_items = sum(int(result.get("filtered_items") or 0) for result in results)

    return {
        "message": "外部平台采集任务执行完成",
        "total_sources": len(sources),
        "success_count": success_count,
        "failed_count": failed_count,
        "item_count": item_count,
        "filtered_items": filtered_items,
        "results": results,
    }


def enabled_authorized_sources() -> List[Dict[str, Any]]:
    init_collector_db()
    placeholders = ",".join("?" for _ in AUTHORIZED_SOURCE_TYPES)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT * FROM collector_sources
            WHERE enabled = 1 AND source_type IN ({placeholders})
            ORDER BY id ASC
            """,
            tuple(sorted(AUTHORIZED_SOURCE_TYPES)),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def run_daily_authorized_sources() -> Dict[str, Any]:
    init_collector_db()
    sources = enabled_authorized_sources()
    result = {
        "total_sources": len(sources),
        "success": 0,
        "skipped": 0,
        "failed": 0,
        "new_items": 0,
        "skipped_items": 0,
        "errors": [],
        "results": [],
    }

    if not sources:
        result["skipped"] = 1
        result["errors"].append("没有启用的合法授权数据源，已安全跳过")
        record_run(None, "skipped", now_text(), 0, "没有启用的合法授权数据源，已安全跳过")
        return result

    for source in sources:
        if source.get("source_type") in {"authorized_api", "data_provider"}:
            run = record_run(
                source.get("id"),
                "skipped",
                now_text(),
                0,
                "授权 API / 合法数据服务商接口为预留入口，本轮未配置真实授权连接",
            )
            result["skipped"] += 1
            result["results"].append({"source": source, "run": run})
            continue

        source_result = run_authorized_source(source["id"])
        result["results"].append(source_result)
        status = source_result.get("run", {}).get("status")
        if status == "success":
            result["success"] += 1
        elif status == "skipped":
            result["skipped"] += 1
        else:
            result["failed"] += 1
        result["new_items"] += int(source_result.get("new_items") or 0)
        result["skipped_items"] += int(source_result.get("skipped_items") or 0)
        result["errors"].extend(source_result.get("errors") or [])

    return result


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
        clauses.append("collector_items.platform LIKE ?")
        values.append(f"%{platform}%")
    if source_id:
        clauses.append("collector_items.source_id = ?")
        values.append(source_id)
    if status:
        if status not in ALLOWED_ITEM_STATUSES:
            raise ValueError("status must be new, reviewed, or ignored")
        clauses.append("collector_items.status = ?")
        values.append(status)
    if keyword:
        clauses.append("(collector_items.title LIKE ? OR collector_items.summary LIKE ? OR collector_items.url LIKE ?)")
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
