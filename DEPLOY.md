# PackyCode 速度测试应用 - VPS 部署指南

基于 PM2 的一键部署解决方案，让维护者能够低成本快速部署 PackyCode 速度测试应用到 VPS。

## 🚀 快速开始

### 一键部署

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd packycode-speedtest

# 2. 执行部署
./deploy.sh
```

就这么简单！脚本会自动处理所有依赖安装、构建和 PM2 配置。

## 📋 系统要求

- **操作系统**: Linux/macOS
- **Node.js**: >= 18.0.0
- **内存**: >= 512MB
- **磁盘**: >= 1GB 可用空间
- **网络**: 能够访问外网（用于测试目标域名）

## 🛠️ 详细部署步骤

### 1. 服务器准备

```bash
# Ubuntu/Debian 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL 安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### 2. 下载项目

```bash
git clone <your-repo-url>
cd packycode-speedtest
```

### 3. 环境配置（可选）

```bash
# 复制环境配置模板
cp .env.example .env.local

# 编辑配置文件
nano .env.local
```

### 4. 执行部署

```bash
# 给脚本执行权限
chmod +x deploy.sh

# 开始部署
./deploy.sh deploy
```

## ⚙️ 配置选项

### 环境变量

主要配置项在 `.env.local` 文件中：

```bash
# 监控的域名列表（必填）
NEXT_PUBLIC_DOMAINS=claude.ai,anthropic.com,google.com

# 应用端口（可选，默认 3000）
PORT=3000

# 运行环境
NODE_ENV=production
```

### PM2 配置

主要配置在 `ecosystem.config.js` 文件中：

- **应用名称**: `packy-speedtest`
- **实例数**: 1（单实例运行）
- **内存限制**: 500MB
- **自动重启**: 启用
- **日志管理**: 自动轮转

## 🎮 管理命令

### 使用部署脚本

```bash
# 查看应用状态
./deploy.sh status

# 查看实时日志
./deploy.sh logs

# 重启应用
./deploy.sh restart

# 停止应用
./deploy.sh stop

# 重新部署
./deploy.sh deploy
```

### 直接使用 PM2

```bash
# 查看所有应用状态
pm2 status

# 查看特定应用日志
pm2 logs packy-speedtest

# 重启应用
pm2 restart packy-speedtest

# 停止应用
pm2 stop packy-speedtest

# 删除应用
pm2 delete packy-speedtest

# 监控面板
pm2 monit
```

## 🔧 高级配置

### 反向代理设置

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 防火墙配置

```bash
# 开放 3000 端口（如果直接访问）
sudo ufw allow 3000

# 或者只开放 80/443 端口（使用反向代理）
sudo ufw allow 80
sudo ufw allow 443
```

## 📊 监控和维护

### 日志查看

```bash
# 实时日志
pm2 logs packy-speedtest --lines 100

# 错误日志
tail -f logs/err.log

# 输出日志
tail -f logs/out.log

# 合并日志
tail -f logs/combined.log
```

### 性能监控

```bash
# PM2 监控面板
pm2 monit

# 系统资源使用
pm2 status
```

### 自动备份日志

```bash
# 添加到 crontab
0 2 * * * cd /path/to/packycode-speedtest && pm2 flush
```

## 🚨 故障排除

### 常见问题

#### 1. 端口被占用

```bash
# 查看端口占用
sudo netstat -tlnp | grep :3000

# 或使用 lsof
sudo lsof -i :3000
```

#### 2. PM2 进程异常

```bash
# 重置 PM2
pm2 kill
pm2 start ecosystem.config.js
```

#### 3. 内存不足

```bash
# 调整内存限制
# 编辑 ecosystem.config.js 中的 max_memory_restart
```

#### 4. 构建失败

```bash
# 清理依赖重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

### 日志分析

```bash
# 查看最近的错误
pm2 logs packy-speedtest --err --lines 50

# 查看应用重启记录
pm2 prettylist
```

## 🔄 更新应用

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./deploy.sh deploy
```

## 📈 性能优化

### 建议配置

1. **内存**: 推荐 1GB+ 内存
2. **CPU**: 1 核心即可满足基本需求
3. **带宽**: 1Mbps+ 用于域名测试
4. **存储**: SSD 存储以提升构建速度

### 扩容方案

如需支持更多并发，可修改 `ecosystem.config.js`:

```javascript
{
  instances: 'max', // 使用所有 CPU 核心
  exec_mode: 'cluster' // 集群模式
}
```

## 🆘 技术支持

如遇到部署问题，请检查：

1. Node.js 版本是否符合要求
2. 网络连接是否正常
3. 端口是否被占用
4. 磁盘空间是否充足
5. 权限是否正确

## 📝 部署清单

- [ ] 服务器满足系统要求
- [ ] Node.js 已安装（>= 18）
- [ ] 项目代码已下载
- [ ] 环境配置已设置
- [ ] 防火墙端口已开放
- [ ] 部署脚本已执行
- [ ] 应用状态正常
- [ ] 外网访问测试通过

---

🎉 **部署完成！**

应用将在 `http://your-server-ip:3000` 上运行，提供实时的域名延迟监控服务。