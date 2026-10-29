import { sql } from 'drizzle-orm';
import {
  bigint, boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, smallint, text,
  timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

/*
 * Media library data model (PROMPT §4, design doc §5). The library has its own Postgres; the only
 * link to the parent site is a user's identity carried in a signed token (auth_provider/external_id).
 * Nothing is deleted automatically: expiry hides, deletion is a manual, confirmed action.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const created = () => ts('created_at').notNull().defaultNow();

/** admin = full access; the three others are "team" roles: member projects only, permissions per role in settings */
export const roleEnum = pgEnum('role', ['admin', 'photographer', 'editor', 'contributor']);
export const authProviderEnum = pgEnum('auth_provider', ['local', 'emdatra']);
export const clientKindEnum = pgEnum('client_kind', ['partner', 'beneficiary']);
export const localeEnum = pgEnum('locale', ['ar', 'tr']);
export const projectStatusEnum = pgEnum('project_status', ['draft', 'uploading', 'review', 'published', 'expired']);
export const sectionEnum = pgEnum('asset_section', ['photos', 'videos']);
export const groupEnum = pgEnum('asset_group', ['final', 'raw', 'footage']);
export const captureSourceEnum = pgEnum('capture_source', ['phone', 'camera']);
export const assetStatusEnum = pgEnum('asset_status', ['uploading', 'processing', 'ready', 'failed']);
export const linkKindEnum = pgEnum('link_kind', ['client', 'guest']);
export const commentAnchorEnum = pgEnum('comment_anchor', ['pin', 'time']);
export const commentStatusEnum = pgEnum('comment_status', ['open', 'in_progress', 'resolved']);
export const uploadStatusEnum = pgEnum('upload_status', ['active', 'completed', 'aborted']);
export const importStatusEnum = pgEnum('import_status', ['queued', 'running', 'done', 'failed']);

// ── people ─────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'),
  role: roleEnum('role').notNull(),
  locale: localeEnum('locale').notNull().default('ar'),
  authProvider: authProviderEnum('auth_provider').notNull().default('local'),
  /** user id on the parent site (phase 2 SSO). Present from day one so phase 2 is an addition, not a migration. */
  externalId: text('external_id'),
  /** free text shown under the name, e.g. «مصوّر رئيسي» */
  title: text('title'),
  passwordHash: text('password_hash'),
  disabledAt: ts('disabled_at'),
  lastLoginAt: ts('last_login_at'),
  createdAt: created(),
}, (t) => [
  uniqueIndex('users_email_uq').on(sql`lower(${t.email})`),
  uniqueIndex('users_external_uq').on(t.authProvider, t.externalId),
]);

/** Staff sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  csrfToken: text('csrf_token').notNull(),
  createdAt: created(),
  expiresAt: ts('expires_at').notNull(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const magicLinks = pgTable('magic_links', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  /** login = 15 min sign-in link; invite = 7-day first sign-in for a new team member */
  purpose: text('purpose').notNull().default('login'),
  createdAt: created(),
});

/** Throttle for staff password / magic-link requests, keyed by email+ip. */
export const loginThrottle = pgTable('login_throttle', {
  key: text('key').primaryKey(),
  failures: smallint('failures').notNull().default(0),
  lockedUntil: ts('locked_until'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** Phase 2: one-time nonces of parent-site SSO tokens (replay protection). */
export const ssoNonces = pgTable('sso_nonces', {
  nonce: text('nonce').primaryKey(),
  expiresAt: ts('expires_at').notNull(),
});

// ── clients & projects ─────────────────────────────────────────────
export const clients = pgTable('clients', {
  id: id(),
  nameAr: text('name_ar').notNull(),
  nameTr: text('name_tr'),
  kind: clientKindEnum('kind').notNull().default('beneficiary'),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  locale: localeEnum('locale').notNull().default('ar'),
  defaultLinkDays: smallint('default_link_days').notNull().default(90),
  allowRaw: boolean('allow_raw').notNull().default(false),
  /** e-mail the client 7 days before a link expires */
  expiryReminder: boolean('expiry_reminder').notNull().default(true),
  /** archiving hides the client's links; media stays */
  archivedAt: ts('archived_at'),
  createdAt: created(),
});

export const projects = pgTable('projects', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  type: text('type'),
  team: text('team'),
  shotDate: date('shot_date'),
  place: text('place'),
  status: projectStatusEnum('status').notNull().default('draft'),
  /** hidden (not deleted) at 23:59 Asia/Hebron of this day */
  expiresAt: ts('expires_at'),
  coverAssetId: uuid('cover_asset_id'),
  publishedAt: ts('published_at'),
  /** archived = hidden from the archive view and from clients; never deleted automatically */
  archivedAt: ts('archived_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('projects_client_idx').on(t.clientId),
  index('projects_status_idx').on(t.status),
  index('projects_shot_idx').on(t.shotDate),
]);

export const projectMembers = pgTable('project_members', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })]);

// ── media ──────────────────────────────────────────────────────────
export type Renditions = {
  /** image variants: width → object key per format */
  images?: { w: number; avif?: string; webp?: string; jpeg?: string }[];
  /** web download (2048px JPEG) */
  web?: string;
  /** embedded RAW preview */
  rawPreview?: string;
  /** HLS master playlist key and the lowest-rung-first status */
  hls?: { master: string; rungs: number[] };
  /** scrub-preview sprite + WebVTT */
  sprite?: { vtt: string; image: string };
  poster?: string;
  /** 1080p MP4 download */
  mp4_1080?: string;
};

export const assets = pgTable('assets', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  section: sectionEnum('section').notNull(),
  group: groupEnum('group').notNull(),
  r2Key: text('r2_key').notNull(),
  originalName: text('original_name').notNull(),
  mime: text('mime').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  duration: doublePrecision('duration'),
  captureSource: captureSourceEnum('capture_source'),
  takenAt: ts('taken_at'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  status: assetStatusEnum('status').notNull().default('uploading'),
  error: text('error'),
  thumbhash: text('thumbhash'),
  renditions: jsonb('renditions').$type<Renditions>().notNull().default({}),
  sortOrder: real('sort_order').notNull().default(0),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  downloads: integer('downloads').notNull().default(0),
  /** v2 "upload revised version": the old asset points to its replacement and leaves the client view */
  replacedBy: uuid('replaced_by'),
  createdAt: created(),
}, (t) => [
  index('assets_project_idx').on(t.projectId, t.section, t.group),
  uniqueIndex('assets_key_uq').on(t.r2Key),
]);

/** Browser→R2 multipart sessions. Resume = same fingerprint → ListParts on the same uploadId. */
export const uploads = pgTable('uploads', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  s3UploadId: text('s3_upload_id').notNull(),
  key: text('key').notNull(),
  filename: text('filename').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  mime: text('mime').notNull(),
  fingerprint: text('fingerprint').notNull(),
  section: sectionEnum('section').notNull(),
  group: groupEnum('group').notNull(),
  status: uploadStatusEnum('status').notNull().default('active'),
  /** fixed part size chosen by the server; the client must use the same split to resume */
  partSize: integer('part_size').notNull().default(16 * 1024 * 1024),
  error: text('error'),
  assetId: uuid('asset_id'),
  createdAt: created(),
  completedAt: ts('completed_at'),
}, (t) => [index('uploads_fp_idx').on(t.userId, t.projectId, t.fingerprint, t.status)]);

// ── delivery ───────────────────────────────────────────────────────
export const links = pgTable('links', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  /** null = the client's whole library; set = opens on that project (or the single project of a guest link) */
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  kind: linkKindEnum('kind').notNull().default('client'),
  jti: text('jti').notNull(),
  /** short public code: /c/<code> redirects to the signed /l/<jwt> URL */
  code: text('code'),
  allowDownload: boolean('allow_download').notNull().default(true),
  notifyFirstDownload: boolean('notify_first_download').notNull().default(false),
  pinHash: text('pin_hash'),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
  failedAttempts: smallint('failed_attempts').notNull().default(0),
  lockedUntil: ts('locked_until'),
  opens: integer('opens').notNull().default(0),
  lastOpenedAt: ts('last_opened_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
}, (t) => [uniqueIndex('links_jti_uq').on(t.jti), uniqueIndex('links_code_uq').on(t.code), index('links_client_idx').on(t.clientId)]);

/** A client/guest browser that passed the PIN gate. Cookie holds a random token; only its hash is stored. */
export const viewerSessions = pgTable('viewer_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  /** per-session CSRF token for viewer writes (renewal request, favourites, comments) */
  csrfToken: text('csrf_token').notNull(),
  createdAt: created(),
  expiresAt: ts('expires_at').notNull(),
}, (t) => [index('viewer_sessions_link_idx').on(t.linkId)]);

export const renewalRequests = pgTable('renewal_requests', {
  id: id(),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  createdAt: created(),
  handledAt: ts('handled_at'),
});

export const publishNotifications = pgTable('publish_notifications', {
  id: id(),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  contact: text('contact'),
  createdAt: created(),
  sentAt: ts('sent_at'),
});

export const downloads = pgTable('downloads', {
  id: id(),
  linkId: uuid('link_id').references(() => links.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  bytes: bigint('bytes', { mode: 'number' }),
  at: ts('at').notNull().defaultNow(),
});

// ── v2 ─────────────────────────────────────────────────────────────
export const favourites = pgTable('favourites', {
  id: id(),
  linkId: uuid('link_id').references(() => links.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  createdAt: created(),
}, (t) => [uniqueIndex('fav_uq').on(t.assetId, sql`coalesce(${t.linkId}::text, ${t.userId}::text)`)]);

export const comments = pgTable('comments', {
  id: id(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').references(() => links.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  anchorType: commentAnchorEnum('anchor_type'),
  /** relative 0..1 so a pin survives any display size */
  x: real('x'),
  y: real('y'),
  tSeconds: doublePrecision('t_seconds'),
  status: commentStatusEnum('status').notNull().default('open'),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  parentId: uuid('parent_id'),
  createdAt: created(),
}, (t) => [index('comments_asset_idx').on(t.assetId), index('comments_status_idx').on(t.status)]);

// ── operations ─────────────────────────────────────────────────────
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  data: jsonb('data'),
  at: ts('at').notNull().defaultNow(),
}, (t) => [index('audit_target_idx').on(t.targetType, t.targetId)]);

export const driveImports = pgTable('drive_imports', {
  id: id(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  folderId: text('folder_id').notNull(),
  folderName: text('folder_name').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  status: importStatusEnum('status').notNull().default('queued'),
  total: integer('total').notNull().default(0),
  done: integer('done').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  report: jsonb('report').$type<{ file: string; ok: boolean; error?: string }[]>().notNull().default([]),
  createdAt: created(),
  finishedAt: ts('finished_at'),
});

export const googleTokens = pgTable('google_tokens', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** encrypted with SESSION_SECRET-derived key (AES-256-GCM) — never stored in clear */
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  email: text('email'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
