import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), data: text('data').notNull(), passwordHash: text('password_hash'), passwordSalt: text('password_salt'), createdAt: text('created_at').notNull(),
});
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => accounts.id, {onDelete:'cascade'}), data: text('data').notNull(), status: text('status').notNull(), nextRun: integer('next_run').notNull().default(0), leaseUntil: integer('lease_until').notNull().default(0), leaseToken: text('lease_token'),
}, t => [index('profiles_owner').on(t.ownerId), index('profiles_due').on(t.status,t.nextRun)]);
export const updates = sqliteTable('updates', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => accounts.id,{onDelete:'cascade'}), profileId: text('profile_id').notNull().references(() => profiles.id,{onDelete:'cascade'}), canonicalUrl: text('canonical_url').notNull(), data: text('data').notNull(), sourceText: text('source_text').notNull(), discoveredAt: text('discovered_at').notNull(),
}, t => [index('updates_owner').on(t.ownerId), uniqueIndex('updates_profile_url').on(t.profileId,t.canonicalUrl)]);
export const sourceChecks = sqliteTable('source_checks', {
  id: text('id').primaryKey(), profileId: text('profile_id').notNull().references(() => profiles.id,{onDelete:'cascade'}), sourceId: text('source_id').notNull(), checkedAt: text('checked_at').notNull(), status: text('status').notNull(), detail: text('detail').notNull(),
}, t=>[index('checks_profile').on(t.profileId)]);
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}), profileId: text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}), data: text('data').notNull(), status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0), nextAttempt: integer('next_attempt').notNull().default(0), providerId: text('provider_id'), error: text('error'), createdAt: text('created_at').notNull(), sentAt: text('sent_at'),
}, t=>[index('outbox_due').on(t.status,t.nextAttempt),index('outbox_owner').on(t.ownerId)]);
export const limits = sqliteTable('rate_limits', {id:text('id').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});

export const processedDocuments=sqliteTable('processed_documents', {id:text('id').primaryKey(),profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),sourceId:text('source_id').notNull(),processedAt:text('processed_at').notNull()},t=>[index('processed_profile').on(t.profileId)]);
export const emailVerifications=sqliteTable('email_verifications', {id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),email:text('email').notNull(),tokenHash:text('token_hash').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),nextAttempt:integer('next_attempt').notNull().default(0),expiresAt:integer('expires_at').notNull()},t=>[uniqueIndex('verification_token').on(t.tokenHash),index('verification_due').on(t.status,t.nextAttempt)]);
