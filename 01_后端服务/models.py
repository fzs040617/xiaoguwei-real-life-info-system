from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from database import Base


class Clue(Base):
    """
    线索库：来自外部平台、爬虫、用户提交，尚未完全核验的信息
    """
    __tablename__ = "clues"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True)
    source_platform = Column(String(100), nullable=True)
    source_url = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(String(50), default="待核验")
    created_at = Column(DateTime, default=datetime.now)


class VerifiedItem(Base):
    """
    真实库：经过审核、可追溯、可以正式展示的信息
    """
    __tablename__ = "verified_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True)
    location = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    trust_level = Column(String(50), default="已审核")
    created_at = Column(DateTime, default=datetime.now)


class CrawlTarget(Base):
    """
    自动采集目标表：记录每天9点要自动采集哪些公开网页
    """
    __tablename__ = "crawl_targets"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(Text, nullable=False)
    category = Column(String(50), default="外部线索")
    source_platform = Column(String(100), default="公开网页自动采集")
    enabled = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class Feedback(Base):
    """
    用户反馈表：用于记录用户对线索或真实库信息的补充、纠错、过期提醒等
    """
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String(30), nullable=False)  # clue 或 verified
    target_id = Column(Integer, nullable=False)
    feedback_type = Column(String(50), default="补充信息")
    content = Column(Text, nullable=True)
    user_name = Column(String(100), default="匿名用户")
    created_at = Column(DateTime, default=datetime.now)

class MapPoint(Base):
    """
    地图点表：用于记录美食、租房、游玩、路线、生活服务等地点信息
    """
    __tablename__ = "map_points"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)
    address = Column(String(300), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    map_type = Column(String(50), default="生活地点")
    target_type = Column(String(30), nullable=True)  # clue 或 verified
    target_id = Column(Integer, nullable=True)
    source = Column(String(100), default="手动添加")
    status = Column(String(50), default="正常")  # 正常 / 已归档
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class RoutePlan(Base):
    """
    路线表：用于记录 citywalk、美食路线、租房看房路线、生活服务路线等
    point_ids 使用逗号分隔保存地图点 ID，例如：1,2,3
    """
    __tablename__ = "route_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    route_type = Column(String(100), default="citywalk路线")
    category = Column(String(100), nullable=True)
    start_area = Column(String(200), nullable=True)
    point_ids = Column(Text, nullable=True)
    source = Column(String(100), default="手动添加")
    status = Column(String(50), default="正常")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class UpdateHistory(Base):
    """
    更新历史表：记录线索、真实库、地图点、路线、反馈、采集目标的创建、编辑、归档、恢复、删除等操作
    """
    __tablename__ = "update_histories"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=False)
    action = Column(String(100), nullable=False)
    title = Column(String(300), nullable=True)
    detail = Column(Text, nullable=True)
    operator = Column(String(100), default="系统")
    created_at = Column(DateTime, default=datetime.now)

class AuthUser(Base):
    """
    用户表：
    第一个注册用户自动成为管理员 admin
    后续注册用户默认为普通用户 user
    """
    __tablename__ = "auth_users"

    id = Column(Integer, primary_key=True, index=True)
    account = Column(String(100), unique=True, index=True, nullable=False)
    nickname = Column(String(100), nullable=False)
    password_salt = Column(String(100), nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(50), default="user")
    avatar_base64 = Column(Text, nullable=True)
    session_token = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    last_login_at = Column(DateTime, nullable=True)