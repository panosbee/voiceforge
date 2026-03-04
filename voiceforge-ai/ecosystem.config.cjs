// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — PM2 Ecosystem Configuration
// Process manager for API server + background workers
// Usage: pm2 start ecosystem.config.cjs
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    // ── API Server ───────────────────────────────────────────────
    {
      name: 'voiceforge-api',
      script: 'apps/api/dist/index.js',
      cwd: '/app',
      instances: 2,         // 2 instances for 2 vCPU droplet
      exec_mode: 'cluster', // Cluster mode for multi-core utilization
      max_memory_restart: '400M',

      // Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: '/var/log/voiceforge/api-error.log',
      out_file: '/var/log/voiceforge/api-out.log',
      merge_logs: true,
      log_type: 'json',

      // Auto-restart
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },

    // ── Background Worker ────────────────────────────────────────
    {
      name: 'voiceforge-worker',
      script: 'apps/api/dist/worker.js',
      cwd: '/app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',

      env_production: {
        NODE_ENV: 'production',
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: '/var/log/voiceforge/worker-error.log',
      out_file: '/var/log/voiceforge/worker-out.log',
      merge_logs: true,
      log_type: 'json',

      // Worker-specific restart policy
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      cron_restart: '0 3 * * *', // Restart daily at 3 AM for cleanup
    },
  ],
};
