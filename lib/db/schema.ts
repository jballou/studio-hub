import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Anchor } from "@/lib/types";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["creative", "requester"] }).notNull().default("requester"),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  jiraKey: text("jira_key").notNull().unique(),
  requesterId: text("requester_id").notNull().references(() => users.id),
  status: text("status").notNull(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["image", "video", "pdf"] }).notNull(),
});

export const assetVersions = pgTable("asset_versions", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id),
  number: integer("number").notNull(),
  blobUrl: text("blob_url").notNull(),
});

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull().references(() => assetVersions.id),
    number: integer("number").notNull(),
    anchor: jsonb("anchor").$type<Anchor | null>(),
    timeMs: integer("time_ms"),
    endMs: integer("end_ms"),
    page: integer("page"),
    status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
    authorId: text("author_id").notNull().references(() => users.id),
    jiraCommentId: text("jira_comment_id"),
    pushedAt: timestamp("pushed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("threads_version_number").on(t.versionId, t.number), index("threads_version").on(t.versionId)],
);

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => threads.id),
  authorId: text("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tokens are stored encrypted (AES-GCM) and never logged.
export const jiraTokens = pgTable("jira_tokens", {
  userId: text("user_id").primaryKey().references(() => users.id),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
