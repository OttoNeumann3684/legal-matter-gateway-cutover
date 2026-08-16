export type FollowUpDecision = {
  action: "contact-now" | "queue-reminder";
  followUpAt: string;
  daysRemaining: number;
};

const DAY_MS = 86_400_000;

export function decideDeadlineFollowUp(deadline: string, now: Date): FollowUpDecision {
  const deadlineAt = new Date(`${deadline}T00:00:00.000Z`);
  const todayAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.ceil((deadlineAt.getTime() - todayAt) / DAY_MS);

  if (daysRemaining <= 2) {
    return { action: "contact-now", followUpAt: now.toISOString(), daysRemaining };
  }

  const reminderAt = new Date(deadlineAt.getTime() - 2 * DAY_MS);
  return { action: "queue-reminder", followUpAt: reminderAt.toISOString(), daysRemaining };
}
