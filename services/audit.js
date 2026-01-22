const { run } = require('../db/db');

const logAudit = async (actorId, action, entityType, entityId) => {
  await run(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
    [actorId, action, entityType, entityId]
  );
};

module.exports = {
  logAudit
};
