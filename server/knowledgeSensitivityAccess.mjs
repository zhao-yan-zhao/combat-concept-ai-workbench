export function canReviewSensitiveKnowledge(actor) {
  return Boolean(actor?.id && Array.isArray(actor.roles) && actor.roles.includes("lead"));
}

export function requireSensitiveKnowledgeReview(actor) {
  if (canReviewSensitiveKnowledge(actor)) return;
  const error = new Error("Sensitive knowledge review requires an authenticated lead");
  error.statusCode = 403;
  throw error;
}
