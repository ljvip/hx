# 1. 安装 PostgreSQL
sudo apt update
sudo apt install postgresql -y

# 2. 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. 创建用户和数据库
sudo -u postgres psql << 'EOF'
-- 创建用户
CREATE USER game_user WITH PASSWORD 'game123456';

-- 创建数据库
CREATE DATABASE game_db OWNER game_user;

-- 授权
GRANT ALL PRIVILEGES ON DATABASE game_db TO game_user;
\c game_db
GRANT ALL ON SCHEMA public TO game_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO game_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO game_user;

-- 退出
\q
EOF

# 4. 测试连接
psql -h localhost -p 5432 -U game_user -d game_db -c 'SELECT $$连接成功!$$ as status;'




# 5. 重新运行程序
cd /home/ubuntu/game-hx



go build -o game-hx cmd/main.go

chmod +x game-hx
nohup ./game-hx > app.log 2>&1 &
tail -f app.log


