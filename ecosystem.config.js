module.exports = {
  apps: [
    {
      name: 'packy-speedtest',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      node_args: '--max-old-space-size=640 --optimize-for-size',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        PORT: 4433,
        NEXT_PUBLIC_DOMAINS:
          'share-api.packycode.com,share-api-hk-cn2.packycode.com,share-api-hk-g.packycode.com,share-api-us-cn2.packycode.com,share-api-cf-pro.packycode.com,api.packycode.com,api-hk-cn2.packycode.com,api-hk-g.packycode.com,api-us-cn2.packycode.com,api-cf-pro.packycode.com,codex-api.packycode.com,codex-api-hk-cn2.packycode.com,codex-api-hk-cdn.packycode.com',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        NEXT_PUBLIC_DOMAINS: 'claude.ai,anthropic.com,google.com',
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
