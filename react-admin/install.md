更新并安装 Nginx
sudo apt update
sudo apt install -y nginx

启动并设置为开机自启
sudo systemctl start nginx
sudo systemctl enable nginx




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


使用 Certbot 自动获取 SSL
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

第三步：获取 SSL 证书

sudo certbot --nginx -d app.admin.a1cc.site


# 2. 让 www-data 能穿过 /home/ubuntu
sudo chmod o+x /home/ubuntu

# 3. www 及站点目录设为 755，文件设为 644
sudo chmod -R 755 /home/ubuntu/www



