// ============================================================================
// PM2 Ecosystem Configuration for Data-Collection Backend
// Optimized for AWS Free Tier t2.micro (1 vCPU, 1GB RAM)
//
// Usage: pm2 start deploy/ecosystem.config.js
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'data-collection-api',
      script: './backend/server.js',
      cwd: '/home/ubuntu/data-collection',

      // --- Process Settings ---
      instances: 1,                    // t2.micro has 1 vCPU, no clustering
      exec_mode: 'fork',              // fork mode for single instance
      autorestart: true,              // restart on crash
      watch: false,                   // don't watch files in production

      // --- Memory Management (CRITICAL for t2.micro 1GB RAM) ---
      // Node.js gets 512MB max heap; OS+Nginx need ~250MB; swap handles spikes
      max_memory_restart: '750M',     // restart if total RSS exceeds 750MB
      node_args: '--max-old-space-size=512',  // limit V8 heap to 512MB

      // --- Environment Variables ---
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_POOL_SIZE: 5,              // small pool for free-tier RDS
      },

      // --- Logging ---
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ubuntu/data-collection/logs/pm2-error.log',
      out_file: '/home/ubuntu/data-collection/logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // --- Restart Policy ---
      exp_backoff_restart_delay: 100,  // exponential backoff on crash
      max_restarts: 10,                // max 10 restarts before stopping
      min_uptime: '10s',               // must run for 10s to be considered started

      // --- Graceful shutdown ---
      kill_timeout: 5000,              // 5 seconds to gracefully shutdown
      listen_timeout: 10000,           // 10 seconds to wait for app to be ready
    },
  ],
};
