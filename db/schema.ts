import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const workspace = sqliteTable('workspace', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull(),
  lastHash: text('last_hash').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  sequence: integer('sequence').notNull().unique(),
  timestamp: text('timestamp').notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  objectId: text('object_id').notNull(),
  requestId: text('request_id').notNull(),
  changes: text('changes').notNull(),
  previousHash: text('previous_hash').notNull(),
  hash: text('hash').notNull().unique(),
});
