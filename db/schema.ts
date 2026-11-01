import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const myediState = sqliteTable('myedi_state', {
  ownerId: text('owner_id').primaryKey(),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const myidLegacySession = sqliteTable('myid_legacy_session', {
  ownerId: text('owner_id').primaryKey(),
  sealed: text('sealed').notNull(),
  expiresAt: integer('expires_at').notNull(),
  lockedUntil: integer('locked_until').notNull().default(0),
  failures: integer('failures').notNull().default(0),
  retryAt: integer('retry_at').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
