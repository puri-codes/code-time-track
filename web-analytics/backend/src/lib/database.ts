import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config/env.js';

type DbProject = {
  extension_project_id: string;
  user_id: string;
  workspace_name: string;
  workspace_root_label?: string;
  repository_name?: string;
  default_branch?: string;
  is_active: number;
  last_seen_at: string;
  metadata: string;
};

let db: Database.Database | null = null;

const normalizeRepository = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Supports owner/repo, URL, or .git suffix and normalizes to owner/repo when possible.
  const sshMatch = trimmed.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`.toLowerCase();
  }

  const directMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (directMatch) {
    return `${directMatch[1]}/${directMatch[2]}`.toLowerCase();
  }

  return trimmed.toLowerCase();
};

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const applySchema = (database: Database.Database) => {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      extension_project_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_name TEXT,
      workspace_root_label TEXT,
      repository_name TEXT,
      repository_normalized TEXT,
      default_branch TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(project_id) REFERENCES projects(extension_project_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extension_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      repository TEXT,
      repository_normalized TEXT,
      folder TEXT,
      file TEXT,
      language TEXT,
      event_type TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      duration INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      branch TEXT,
      commit_hash TEXT,
      files_changed INTEGER,
      lines_added INTEGER,
      lines_removed INTEGER,
      session_id TEXT,
      active_duration INTEGER,
      idle INTEGER,
      idle_duration INTEGER,
      FOREIGN KEY(project_id) REFERENCES projects(extension_project_id) ON DELETE CASCADE,
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_extension_events_user ON extension_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_extension_events_project ON extension_events(project_id);
    CREATE INDEX IF NOT EXISTS idx_extension_events_time ON extension_events(timestamp_ms DESC);

    CREATE TABLE IF NOT EXISTS github_repositories (
      full_name TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_analyzed_at TEXT NOT NULL,
      raw_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS github_branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_full_name TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL,
      is_protected INTEGER NOT NULL,
      last_commit_at TEXT,
      UNIQUE(repository_full_name, name),
      FOREIGN KEY(repository_full_name) REFERENCES github_repositories(full_name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS github_timeline_events (
      id TEXT PRIMARY KEY,
      repository_full_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      author TEXT,
      branch TEXT,
      message TEXT,
      title TEXT,
      action TEXT,
      count INTEGER,
      raw_payload TEXT NOT NULL,
      FOREIGN KEY(repository_full_name) REFERENCES github_repositories(full_name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS github_daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_full_name TEXT NOT NULL,
      metric_kind TEXT NOT NULL,
      date TEXT NOT NULL,
      value_a INTEGER NOT NULL,
      value_b INTEGER,
      value_c INTEGER,
      source TEXT,
      UNIQUE(repository_full_name, metric_kind, date),
      FOREIGN KEY(repository_full_name) REFERENCES github_repositories(full_name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_repository_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_project_id TEXT NOT NULL,
      repository_full_name TEXT NOT NULL,
      match_source TEXT NOT NULL,
      matched_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(extension_project_id, repository_full_name),
      FOREIGN KEY(extension_project_id) REFERENCES projects(extension_project_id) ON DELETE CASCADE,
      FOREIGN KEY(repository_full_name) REFERENCES github_repositories(full_name) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_repo_norm ON projects(repository_normalized);
    CREATE INDEX IF NOT EXISTS idx_github_repo_owner ON github_repositories(owner);
    CREATE INDEX IF NOT EXISTS idx_github_timeline_repo_time ON github_timeline_events(repository_full_name, timestamp DESC);
  `);
};

export const getDatabase = (): Database.Database => {
  if (db) {
    return db;
  }

  const dbPath = env.databasePath;
  ensureDir(dbPath);
  db = new Database(dbPath);
  applySchema(db);
  return db;
};

export const upsertProject = (project: DbProject): void => {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO projects (
      extension_project_id,
      user_id,
      workspace_name,
      workspace_root_label,
      repository_name,
      repository_normalized,
      default_branch,
      is_active,
      last_seen_at,
      metadata
    ) VALUES (
      @extension_project_id,
      @user_id,
      @workspace_name,
      @workspace_root_label,
      @repository_name,
      @repository_normalized,
      @default_branch,
      @is_active,
      @last_seen_at,
      @metadata
    )
    ON CONFLICT(extension_project_id) DO UPDATE SET
      user_id = excluded.user_id,
      workspace_name = COALESCE(projects.workspace_name, excluded.workspace_name),
      workspace_root_label = COALESCE(projects.workspace_root_label, excluded.workspace_root_label),
      repository_name = COALESCE(excluded.repository_name, projects.repository_name),
      repository_normalized = COALESCE(excluded.repository_normalized, projects.repository_normalized),
      default_branch = COALESCE(excluded.default_branch, projects.default_branch),
      is_active = excluded.is_active,
      last_seen_at = CASE
        WHEN projects.last_seen_at > excluded.last_seen_at THEN projects.last_seen_at
        ELSE excluded.last_seen_at
      END,
      metadata = excluded.metadata
  `);

  stmt.run({
    ...project,
    repository_normalized: normalizeRepository(project.repository_name)
  });
};

export const upsertSession = (session: {
  session_id: string;
  user_id: string;
  project_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  is_active: number;
  metadata: string;
}) => {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO sessions (
      session_id,
      user_id,
      project_id,
      started_at,
      ended_at,
      duration_ms,
      is_active,
      metadata
    ) VALUES (
      @session_id,
      @user_id,
      @project_id,
      @started_at,
      @ended_at,
      @duration_ms,
      @is_active,
      @metadata
    )
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = excluded.user_id,
      project_id = excluded.project_id,
      started_at = sessions.started_at,
      ended_at = COALESCE(excluded.ended_at, sessions.ended_at),
      duration_ms = COALESCE(excluded.duration_ms, sessions.duration_ms),
      is_active = excluded.is_active,
      metadata = excluded.metadata
  `);
  stmt.run(session);
};

export const upsertExtensionEvent = (event: {
  event_id: string;
  user_id: string;
  project_id: string;
  repository?: string;
  folder?: string;
  file?: string;
  language?: string;
  event_type: string;
  timestamp_ms: number;
  occurred_at: string;
  duration?: number;
  metadata: string;
  branch?: string;
  commit_hash?: string;
  files_changed?: number;
  lines_added?: number;
  lines_removed?: number;
  session_id?: string;
  active_duration?: number;
  idle?: boolean;
  idle_duration?: number;
}) => {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO extension_events (
      event_id,
      user_id,
      project_id,
      repository,
      repository_normalized,
      folder,
      file,
      language,
      event_type,
      timestamp_ms,
      occurred_at,
      duration,
      metadata,
      branch,
      commit_hash,
      files_changed,
      lines_added,
      lines_removed,
      session_id,
      active_duration,
      idle,
      idle_duration
    ) VALUES (
      @event_id,
      @user_id,
      @project_id,
      @repository,
      @repository_normalized,
      @folder,
      @file,
      @language,
      @event_type,
      @timestamp_ms,
      @occurred_at,
      @duration,
      @metadata,
      @branch,
      @commit_hash,
      @files_changed,
      @lines_added,
      @lines_removed,
      @session_id,
      @active_duration,
      @idle,
      @idle_duration
    )
    ON CONFLICT(event_id) DO UPDATE SET
      metadata = excluded.metadata,
      repository = COALESCE(excluded.repository, extension_events.repository),
      repository_normalized = COALESCE(excluded.repository_normalized, extension_events.repository_normalized),
      branch = COALESCE(excluded.branch, extension_events.branch)
  `);

  const idleValue =
    typeof event.idle === 'boolean'
      ? (event.idle ? 1 : 0)
      : event.idle === undefined
        ? null
        : Number(event.idle);

  stmt.run({
    ...event,
    repository_normalized: normalizeRepository(event.repository),
    idle: Number.isFinite(idleValue) ? idleValue : null
  });
};

export const saveGithubAnalytics = (input: {
  fullName: string;
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  createdAt: string;
  rawPayload: string;
  branches: Array<{ name: string; isDefault: boolean; isProtected: boolean; lastCommitAt?: string }>;
  timeline: Array<{
    id: string;
    type: string;
    timestamp: string;
    author?: string;
    branch?: string;
    message?: string;
    title?: string;
    action?: string;
    count?: number;
  }>;
  commitFrequency: Array<{ date: string; count: number }>;
  pushActivity: Array<{ date: string; pushes: number; commitCount: number; source: string }>;
  pullLifecycle: Array<{ date: string; created: number; merged: number; closed: number }>;
}) => {
  const database = getDatabase();
  const tx = database.transaction(() => {
    database
      .prepare(`
        INSERT INTO github_repositories (
          full_name,
          owner,
          name,
          url,
          default_branch,
          created_at,
          last_analyzed_at,
          raw_payload
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
        ON CONFLICT(full_name) DO UPDATE SET
          owner = excluded.owner,
          name = excluded.name,
          url = excluded.url,
          default_branch = excluded.default_branch,
          created_at = excluded.created_at,
          last_analyzed_at = datetime('now'),
          raw_payload = excluded.raw_payload
      `)
      .run(
        input.fullName,
        input.owner,
        input.name,
        input.url,
        input.defaultBranch,
        input.createdAt,
        input.rawPayload
      );

    database.prepare('DELETE FROM github_branches WHERE repository_full_name = ?').run(input.fullName);
    database.prepare('DELETE FROM github_timeline_events WHERE repository_full_name = ?').run(input.fullName);
    database.prepare('DELETE FROM github_daily_metrics WHERE repository_full_name = ?').run(input.fullName);

    const branchStmt = database.prepare(`
      INSERT INTO github_branches (repository_full_name, name, is_default, is_protected, last_commit_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(repository_full_name, name) DO UPDATE SET
        is_default = excluded.is_default,
        is_protected = excluded.is_protected,
        last_commit_at = excluded.last_commit_at
    `);

    input.branches.forEach((branch) => {
      branchStmt.run(
        input.fullName,
        branch.name,
        branch.isDefault ? 1 : 0,
        branch.isProtected ? 1 : 0,
        branch.lastCommitAt ?? null
      );
    });

    const timelineStmt = database.prepare(`
      INSERT INTO github_timeline_events (
        id,
        repository_full_name,
        event_type,
        timestamp,
        author,
        branch,
        message,
        title,
        action,
        count,
        raw_payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        timestamp = excluded.timestamp,
        author = excluded.author,
        branch = excluded.branch,
        message = excluded.message,
        title = excluded.title,
        action = excluded.action,
        count = excluded.count,
        raw_payload = excluded.raw_payload
    `);

    input.timeline.forEach((event) => {
      timelineStmt.run(
        event.id,
        input.fullName,
        event.type,
        event.timestamp,
        event.author ?? null,
        event.branch ?? null,
        event.message ?? null,
        event.title ?? null,
        event.action ?? null,
        event.count ?? null,
        JSON.stringify(event)
      );
    });

    const metricStmt = database.prepare(`
      INSERT INTO github_daily_metrics (
        repository_full_name,
        metric_kind,
        date,
        value_a,
        value_b,
        value_c,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repository_full_name, metric_kind, date) DO UPDATE SET
        value_a = excluded.value_a,
        value_b = excluded.value_b,
        value_c = excluded.value_c,
        source = excluded.source
    `);

    input.commitFrequency.forEach((row) => {
      metricStmt.run(input.fullName, 'commit_frequency', row.date, row.count, null, null, null);
    });

    input.pushActivity.forEach((row) => {
      metricStmt.run(input.fullName, 'push_activity', row.date, row.pushes, row.commitCount, null, row.source);
    });

    input.pullLifecycle.forEach((row) => {
      metricStmt.run(input.fullName, 'pull_lifecycle', row.date, row.created, row.merged, row.closed, null);
    });

    database
      .prepare(`
        INSERT INTO project_repository_matches (
          extension_project_id,
          repository_full_name,
          match_source,
          matched_at
        )
        SELECT p.extension_project_id, ?, 'repository_name', datetime('now')
        FROM projects p
        WHERE p.repository_normalized = ?
        ON CONFLICT(extension_project_id, repository_full_name) DO UPDATE SET
          match_source = excluded.match_source,
          matched_at = excluded.matched_at
      `)
      .run(input.fullName, normalizeRepository(input.fullName));
  });

  tx();
};

export const refreshProjectRepositoryMatches = (projectId: string, repository?: string) => {
  const normalized = normalizeRepository(repository);
  if (!normalized) {
    return;
  }

  const database = getDatabase();
  database
    .prepare(`
      INSERT INTO project_repository_matches (
        extension_project_id,
        repository_full_name,
        match_source,
        matched_at
      )
      SELECT ?, gr.full_name, 'repository_name', datetime('now')
      FROM github_repositories gr
      WHERE lower(gr.full_name) = ?
      ON CONFLICT(extension_project_id, repository_full_name) DO UPDATE SET
        match_source = excluded.match_source,
        matched_at = excluded.matched_at
    `)
    .run(projectId, normalized);
};

export const getExtensionEvents = (userId: string, projectId?: string) => {
  const database = getDatabase();
  if (projectId) {
    return database
      .prepare('SELECT * FROM extension_events WHERE user_id = ? AND project_id = ? ORDER BY timestamp_ms ASC LIMIT 10000')
      .all(userId, projectId);
  }

  return database
    .prepare('SELECT * FROM extension_events WHERE user_id = ? ORDER BY timestamp_ms ASC LIMIT 10000')
    .all(userId);
};

export const getLatestProjectForUser = (userId: string) => {
  const database = getDatabase();
  return database
    .prepare(`
      SELECT
        p.extension_project_id,
        p.workspace_name,
        p.repository_name,
        MAX(e.timestamp_ms) AS latest_event_ms
      FROM projects p
      LEFT JOIN extension_events e ON e.project_id = p.extension_project_id
      WHERE p.user_id = ?
      GROUP BY p.extension_project_id, p.workspace_name, p.repository_name
      ORDER BY latest_event_ms DESC, p.last_seen_at DESC
      LIMIT 1
    `)
    .get(userId) as
    | {
        extension_project_id: string;
        workspace_name?: string;
        repository_name?: string;
        latest_event_ms?: number;
      }
    | undefined;
};

export const getRepositoryComparison = (userId: string, repositoryFullName: string) => {
  const database = getDatabase();
  const normalized = normalizeRepository(repositoryFullName);

  const repository = database
    .prepare('SELECT * FROM github_repositories WHERE lower(full_name) = ? LIMIT 1')
    .get(normalized);

  const projects = database
    .prepare(`
      SELECT p.extension_project_id, p.workspace_name, p.repository_name, p.last_seen_at,
             COUNT(e.event_id) AS event_count,
             SUM(CASE WHEN e.event_type = 'session_end' THEN COALESCE(e.active_duration, 0) ELSE 0 END) AS active_duration_ms,
             MAX(e.timestamp_ms) AS latest_event_ms
      FROM projects p
      LEFT JOIN extension_events e ON e.project_id = p.extension_project_id
      LEFT JOIN project_repository_matches m
        ON m.extension_project_id = p.extension_project_id
      WHERE p.user_id = ?
        AND (
          lower(COALESCE(p.repository_normalized, '')) = ?
          OR lower(COALESCE(m.repository_full_name, '')) = ?
        )
      GROUP BY p.extension_project_id, p.workspace_name, p.repository_name, p.last_seen_at
      ORDER BY latest_event_ms DESC
    `)
    .all(userId, normalized, normalized);

  const githubTotals = database
    .prepare(`
      SELECT
        SUM(CASE WHEN metric_kind = 'commit_frequency' THEN value_a ELSE 0 END) AS commits,
        SUM(CASE WHEN metric_kind = 'push_activity' THEN value_a ELSE 0 END) AS pushes,
        SUM(CASE WHEN metric_kind = 'pull_lifecycle' THEN value_a ELSE 0 END) AS prs_created
      FROM github_daily_metrics
      WHERE lower(repository_full_name) = ?
    `)
    .get(normalized) as { commits?: number; pushes?: number; prs_created?: number } | undefined;

  return {
    repository,
    projects,
    githubTotals: {
      commits: githubTotals?.commits ?? 0,
      pushes: githubTotals?.pushes ?? 0,
      prsCreated: githubTotals?.prs_created ?? 0
    }
  };
};

export const closeDatabase = () => {
  if (!db) {
    return;
  }
  db.close();
  db = null;
};
