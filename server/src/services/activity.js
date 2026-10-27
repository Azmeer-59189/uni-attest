// Actor names are snapshots so an application keeps its original audit trail.
module.exports = (actor, action, details = '') => ({
  action,
  actor: actor._id,
  actorName: actor.fullName,
  actorRole: actor.role,
  at: new Date(),
  details
});
