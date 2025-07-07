import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 启用实验性功能以优化性能
  experimental: {
    // 启用 Turbopack (开发模式)
    turbo: {
      loaders: {
        // 配置自定义加载器
      },
    },
    // 优化包导入
    optimizePackageImports: ['react-hot-toast'],
  },

  // 编译器优化
  compiler: {
    // 生产环境移除 console.log
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error'],
          }
        : false,
  },

  // 打包分析和优化
  webpack: (config, { dev, isServer }) => {
    // 生产环境优化
    if (!dev && !isServer) {
      // 代码分割优化
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          toast: {
            name: 'toast',
            test: /[\\/]node_modules[\\/](react-hot-toast|goober)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
        },
      };
    }
    return config;
  },

  // 压缩和缓存优化
  compress: true,
  poweredByHeader: false,

  // 图片优化
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },

  // 头部优化
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source:
          '/(.*)\\.(js|css|woff|woff2|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
