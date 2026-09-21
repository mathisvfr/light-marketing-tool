const { supabase } = require('../db/client');

// Fire-and-forget activity logging. Never throws, never blocks the response.
function logActivity(userId, userName, action, resourceType, resourceId, metadata) {
  setImmediate(async () => {
    try {
      await supabase.from('activity_log').insert({
        user_id: userId,
        user_name: userName,
        action,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        metadata: metadata || null,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[activity-log] insert failed:', err.message);
      }
    }
  });
}

module.exports = { logActivity };
