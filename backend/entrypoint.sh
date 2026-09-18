#!/bin/sh
# Fix ownership of the uploads volume mount (host dir may be root-owned).
# Runs as root, then drops to `node` for the actual app.
chown -R node:node /app/uploads 2>/dev/null || true
exec su-exec node npm start
