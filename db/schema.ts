import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const myediState = sqliteTable('myedi_state', {
  ownerId: text('owner_id').primaryKey(),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
