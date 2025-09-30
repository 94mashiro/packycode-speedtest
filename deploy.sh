#!/bin/bash

# PackyCode 速度测试应用 - VPS 部署脚本
# 作者: Claude Code
# 用途: 简化 PM2 部署流程

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印彩色消息
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

# 安装 PM2（如果未安装）
install_pm2() {
    if ! check_command pm2; then
        print_status "PM2 未安装，正在安装..."
        npm install -g pm2
        print_success "PM2 安装完成"
    else
        print_status "PM2 已安装: $(pm2 --version)"
    fi
}

# 安装 pnpm（如果未安装）
install_pnpm() {
    if ! check_command pnpm; then
        print_status "pnpm 未安装，正在安装..."
        npm install -g pnpm
        print_success "pnpm 安装完成"
    else
        print_status "pnpm 已安装: $(pnpm --version)"
    fi
}

# 主部署函数
deploy() {
    print_status "开始部署 PackyCode 速度测试应用..."

    # 检查 Node.js
    if ! check_command node; then
        print_error "Node.js 未安装，请先安装 Node.js (版本 >= 18)"
        exit 1
    fi
    print_status "Node.js 版本: $(node --version)"

    # 检查并安装依赖工具
    install_pnpm
    install_pm2

    # 停止现有的应用（如果存在）
    print_status "停止现有应用..."
    pm2 stop packy-speedtest 2>/dev/null || print_warning "应用未在运行"
    pm2 delete packy-speedtest 2>/dev/null || print_warning "应用不存在"

    # 安装依赖
    print_status "安装项目依赖..."
    pnpm install

    # 构建项目
    print_status "构建项目..."
    export NEXT_PUBLIC_DOMAINS='share-api.packycode.com,share-api-optimize.packycode.com,share-api-hk-cn2.packycode.com,share-api-hk-g.packycode.com,share-api-us-cn2.packycode.com,share-api-cf-pro.packycode.com,api.packycode.com,api-optimize.packycode.com,api-hk-cn2.packycode.com,api-hk-g.packycode.com,api-us-cn2.packycode.com,codex-api.packycode.com,codex-api-hk-cn2.packycode.com,codex-api-hk-cdn.packycode.com,codex-api-cf-pro.packycode.com'
    export PORT=4433
    pnpm run build

    # 创建日志目录
    print_status "创建日志目录..."
    mkdir -p logs

    # 启动应用
    print_status "启动应用..."
    pm2 start ecosystem.config.js

    # 保存 PM2 配置并启用开机自启
    print_status "保存 PM2 配置..."
    pm2 save
    pm2 startup | grep -E "^sudo" | sh || print_warning "请手动运行上述 sudo 命令以启用开机自启"

    print_success "部署完成！"

    # 显示状态
    echo
    print_status "应用状态:"
    pm2 status

    echo
    print_status "应用访问地址:"
    echo "  本地: http://localhost:4433"

    # 获取服务器 IP
    if command -v curl &> /dev/null; then
        IP=$(curl -s ifconfig.me 2>/dev/null || echo "获取失败")
        if [ "$IP" != "获取失败" ]; then
            echo "  外网: http://$IP:4433"
        fi
    fi

    echo
    print_status "常用命令:"
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs packy-speedtest"
    echo "  重启应用: pm2 restart packy-speedtest"
    echo "  停止应用: pm2 stop packy-speedtest"
    echo "  删除应用: pm2 delete packy-speedtest"
}

# 显示帮助信息
show_help() {
    echo "PackyCode 速度测试应用部署脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  deploy, -d    执行部署"
    echo "  status, -s    查看应用状态"
    echo "  logs, -l      查看应用日志"
    echo "  restart, -r   重启应用"
    echo "  stop          停止应用"
    echo "  help, -h      显示帮助信息"
    echo
    echo "示例:"
    echo "  $0 deploy     # 部署应用"
    echo "  $0 status     # 查看状态"
    echo "  $0 logs       # 查看日志"
}

# 处理命令行参数
case "${1:-deploy}" in
    deploy|-d)
        deploy
        ;;
    status|-s)
        pm2 status
        ;;
    logs|-l)
        pm2 logs packy-speedtest
        ;;
    restart|-r)
        pm2 restart packy-speedtest
        print_success "应用已重启"
        ;;
    stop)
        pm2 stop packy-speedtest
        print_success "应用已停止"
        ;;
    help|-h)
        show_help
        ;;
    *)
        print_error "未知参数: $1"
        show_help
        exit 1
        ;;
esac