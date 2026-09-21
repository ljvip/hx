# My DApp

一个基于 React + Vite 的区块链钱包和投注 DApp，支持 TRON / BSC 链钱包连接、WebSocket 实时更新、历史记录展示等功能。

## 快速开始

1. 安装依赖
   ```bash
   npm install
   ```

2. 复制环境变量模板
   ```bash
   copy .env.example .env
   ```

3. 根据你的环境修改 `.env` 中的配置：
   ```env
   VITE_API_BASE_URL=http://localhost:8088
   VITE_WS_URL=ws://localhost:8088/wss
   ```

4. 启动开发环境
   ```bash
   npm run dev
   ```

## 环境变量说明

项目中的网络地址、WebSocket 地址和链配置都已抽离到 `.env`，具体配置项如下：

```env
VITE_API_BASE_URL=http://localhost:8088
VITE_WS_URL=ws://localhost:8088/wss

VITE_TRON_USDT_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
VITE_BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955
VITE_BSC_API_URL=https://api.bscscan.com/api
VITE_BSC_CHAIN_ID=0x38
VITE_BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

说明：
- 若不需要 WebSocket，可将 `VITE_WS_URL` 设为空字符串
- 生产环境建议使用真实域名和安全协议（例如 `wss://`）

## 生产构建

```bash
npm run build
```

## 常用脚本

```bash
npm run dev      # 启动本地开发服务器
npm run build    # 构建生产包
npm run preview  # 预览生产构建
npm run lint     # 代码检查（若配置已启用）
```

## 项目结构

```text
src/
  components/
  contexts/
  hooks/
  pages/
  services/
  utils/
  App.jsx
  main.jsx
.env
.env.example
vite.config.js
package.json
README.md
```

## 备注

- 本项目目前以本地开发环境默认配置为主。
- 若部署到真实服务器，请修改 `.env` 中的 API / WS 地址，避免直接写死 `localhost`。
- 若需要切换到 BSC 或 TRON 生产环境，优先更新 `.env` 中对应参数，而不是修改源码常量。




 更新并安装 Nginx
sudo apt update
sudo apt install -y nginx

启动并设置为开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

使用 Certbot 自动获取 SSL
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

使用 Vim 编辑器（推荐）
bash
sudo vim /etc/nginx/sites-available/app.a1cc.site
然后按 i 进入编辑模式，粘贴以下内容：

nginx
server {
    listen 80;
    server_name app.a1cc.site;
    root /var/www/app.a1cc.site;
    index index.html;
}
粘贴完成后：

按 Esc 键退出编辑模式

输入 :wq 然后按回车（保存并退出）

# 1. 创建网站目录
sudo mkdir -p /var/www/app.a1cc.site
sudo mkdir -p /var/www/app.admin.a1cc.site

# 2. 创建临时首页
echo "<h1>App Site</h1>" | sudo tee /var/www/app.a1cc.site/index.html
echo "<h1>Admin Site</h1>" | sudo tee /var/www/app.admin.a1cc.site/index.html

# 3. 创建 app.a1cc.site 配置文件
sudo tee /etc/nginx/sites-available/app.a1cc.site > /dev/null << 'EOF'
server {
    listen 80;
    server_name app.a1cc.site;
    root /var/www/app.a1cc.site;
    index index.html;
}
EOF

# 4. 创建 app.admin.a1cc.site 配置文件
sudo tee /etc/nginx/sites-available/app.admin.a1cc.site > /dev/null << 'EOF'
server {
    listen 80;
    server_name app.admin.a1cc.site;
    root /var/www/app.admin.a1cc.site;
    index index.html;
}
EOF

# 5. 启用站点（创建软链接）
sudo ln -s /etc/nginx/sites-available/app.a1cc.site /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/app.admin.a1cc.site /etc/nginx/sites-enabled/

# 6. 测试配置
sudo nginx -t

# 7. 重载 Nginx
sudo systemctl reload nginx


开始配置 HTTPS
第一步：禁用默认站点（避免冲突）
bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx


🚀 开始配置 HTTPS
第一步：禁用默认站点（避免冲突）
bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
第二步：安装 Certbot
bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
第三步：获取 SSL 证书
bash
sudo certbot --nginx -d app.a1cc.site -d app.admin.a1cc.site
执行后会提示：



# 定义后端服务器
upstream hx_backend {
    zone hx_backend 64K;
    server 127.0.0.1:9088;
    keepalive 32;
}

# HTTP 服务器 - 自动跳转 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name hx.a1cc.site;

    access_log /var/log/nginx/hx_access_80.log;
    error_log /var/log/nginx/hx_error_80.log;

    return 301 https://$server_name$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hx.a1cc.site;

    underscores_in_headers on;

    access_log /var/log/nginx/hx_access_443.log;
    error_log /var/log/nginx/hx_error_443.log;

    # React 前端静态文件路径
    root /www/wwwroot/trxhx;
    index index.html;

    # 处理 React 路由
    location / {
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ===== WebSocket 专用路径（放在 /backend 之前）=====
    location /wss {
        proxy_pass http://hx_backend/wss;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 超时设置
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        
        # 禁用缓冲
        proxy_buffering off;
    }

    # 反向代理 /backend 路径到 8088 端口
    location /backend/ {
        proxy_pass http://hx_backend/;
        proxy_redirect off;

        proxy_pass_header Authorization;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Ssl on;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        client_max_body_size 0;
        proxy_read_timeout 36000s;
    }

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/hx.a1cc.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hx.a1cc.site/privkey.pem;
}





