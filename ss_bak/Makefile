.PHONY: help install run test clean deploy docs

# 默认目标
help:
	@echo "可用的命令:"
	@echo "  make install   - 安装依赖"
	@echo "  make run       - 启动服务"
	@echo "  make test      - 运行测试"
	@echo "  make client    - 运行客户端示例"
	@echo "  make clean     - 清理临时文件"
	@echo "  make docs      - 查看API文档"
	@echo "  make deploy    - 部署到生产环境"

# 安装依赖
install:
	@echo "安装依赖包..."
	python3 -m venv venv
	@echo "虚拟环境已创建: venv/"
	@echo "请运行以下命令激活虚拟环境:"
	@echo "  source venv/bin/activate  # Linux/Mac"
	@echo "  venv\\Scripts\\activate     # Windows"
	@echo "然后运行: pip install -r requirements.txt"

# 启动服务
run:
	@echo "启动API服务..."
	python3 main.py

# 使用uvicorn启动
dev:
	@echo "以开发模式启动服务..."
	uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 运行测试
test:
	@echo "运行API测试..."
	python3 test_api.py

# 运行客户端示例
client:
	@echo "运行客户端示例..."
	python3 client_example.py

# 清理临时文件
clean:
	@echo "清理临时文件..."
	rm -rf venv/
	rm -rf outputs/
	rm -rf downloads/
	rm -rf __pycache__/
	rm -rf .pytest_cache/
	rm -rf *.pyc
	rm -rf .coverage
	@echo "清理完成!"

# 查看API文档
docs:
	@echo "打开浏览器访问API文档..."
	@echo "Swagger UI: http://localhost:8000/docs"
	@echo "ReDoc: http://localhost:8000/redoc"
	@echo "请确保服务正在运行 (make run)"

# Docker构建
docker-build:
	@echo "构建Docker镜像..."
	docker build -t python-api-service .

# Docker运行
docker-run:
	@echo "运行Docker容器..."
	docker run -d -p 8000:8000 --name api-service python-api-service

# Docker停止
docker-stop:
	@echo "停止Docker容器..."
	docker stop api-service || true
	docker rm api-service || true

# Docker清理
docker-clean:
	@echo "清理Docker资源..."
	docker system prune -f

# 生产部署（简单版）
deploy:
	@echo "部署到生产环境..."
	@echo "请参考 DEPLOYMENT.md 文档"
	@echo "或使用: make docker-build && make docker-run"
