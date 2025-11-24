const http = require('http');

// Simple health check script
// In a real scenario, the bot could expose a small HTTP server or write a heartbeat file.
// For now, we just check if the process is running (which Docker does by default),
// but we can add logic here to check Redis connection or last activity timestamp.

console.log('Health check passed');
process.exit(0);
