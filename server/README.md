# 宝宝成长相册 — 后端服务

> Python FastAPI + PostgreSQL + MinIO + Celery

## 文档

详细的后端设计文档请参阅 [`docs/03-architecture/backend/README.md`](../docs/03-architecture/backend/README.md)。

## 快速开始

### 本地开发

```bash
# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate  # Windows

# 安装依赖
pip install -e ".[dev]"

# 复制环境变量模板
cp .env.example .env
# 编辑 .env 配置数据库连接等

# 启动服务
docker-compose up -d  # 启动 PostgreSQL + Redis + MinIO
alembic upgrade head  # 运行数据库迁移
uvicorn app.main:app --reload  # 启动 API 服务
```

### 测试

```bash
pytest
```

## 目录结构

```
server/
├── app/                 # FastAPI 应用
│   ├── api/             # API 路由
│   ├── models/          # SQLAlchemy 模型
│   ├── schemas/         # Pydantic 模式
│   ├── services/        # 业务逻辑
│   └── main.py          # 应用入口
├── migrations/          # Alembic 迁移
├── tests/               # 测试文件
├── docker-compose.yml   # Docker 编排
└── Dockerfile           # 容器构建
```

## API 文档

服务启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
