import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const games = sqliteTable('games', {
  userId: text('user_id').notNull(), id: text('id').notNull(),
  data: text('data').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] })]);
export const preferences = sqliteTable('preferences', {
  userId: text('user_id').primaryKey(), data: text('data').notNull(),
  encryptedKey: text('encrypted_key'),
});
export const practiceAttempts = sqliteTable('practice_attempts', {
  userId: text('user_id').notNull(), id: text('id').notNull(),
  puzzleId: text('puzzle_id').notNull(), data: text('data').notNull(),
  completedAt: text('completed_at').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] })]);
