import { getDb } from '@/db';
import { auditLog } from '@/db/schema';

export async function audit(actorType: 'user' | 'link' | 'system', actorId: string | null, action: string,
  target?: { type: string; id: string }, data?: Record<string, unknown>) {
  await getDb().insert(auditLog).values({ actorType, actorId, action, targetType: target?.type, targetId: target?.id, data });
}
