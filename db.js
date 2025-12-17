import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Ensure data directory exists
const DB_PATH = process.env.DATABASE_PATH || './data/debates.db';
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS debates (
    id TEXT PRIMARY KEY,
    dilemma_id INTEGER NOT NULL,
    dilemma_title TEXT NOT NULL,
    player_side TEXT NOT NULL,
    ai_side TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    player_argument TEXT,
    ai_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debate_id) REFERENCES debates(id)
  );

  CREATE TABLE IF NOT EXISTS verdicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id TEXT UNIQUE NOT NULL,
    winner TEXT,
    human_scores TEXT,
    ai_scores TEXT,
    human_strengths TEXT,
    human_improvements TEXT,
    concepts_to_study TEXT,
    key_takeaway TEXT,
    judge_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debate_id) REFERENCES debates(id)
  );

  CREATE INDEX IF NOT EXISTS idx_debates_created ON debates(created_at);
  CREATE INDEX IF NOT EXISTS idx_turns_debate ON turns(debate_id);
`);

// Generate a hard-to-guess ID (21 chars by default, URL-safe)
export function generateDebateId() {
  return nanoid(21);
}

// Create a new debate
export function createDebate(dilemmaId, dilemmaTitle, playerSide, aiSide) {
  const id = generateDebateId();
  const stmt = db.prepare(`
    INSERT INTO debates (id, dilemma_id, dilemma_title, player_side, ai_side)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, dilemmaId, dilemmaTitle, playerSide, aiSide);
  return id;
}

// Get debate by ID
export function getDebate(id) {
  const stmt = db.prepare(`SELECT * FROM debates WHERE id = ?`);
  return stmt.get(id);
}

// Update debate status
export function updateDebateStatus(id, status) {
  const stmt = db.prepare(`
    UPDATE debates SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, status, id);
}

// Add a turn
export function addTurn(debateId, turnNumber, playerArgument, aiResponse) {
  const stmt = db.prepare(`
    INSERT INTO turns (debate_id, turn_number, player_argument, ai_response)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(debateId, turnNumber, playerArgument, aiResponse);
}

// Get all turns for a debate
export function getTurns(debateId) {
  const stmt = db.prepare(`
    SELECT turn_number, player_argument, ai_response
    FROM turns WHERE debate_id = ? ORDER BY turn_number
  `);
  return stmt.all(debateId);
}

// Save verdict
export function saveVerdict(debateId, verdict) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO verdicts
    (debate_id, winner, human_scores, ai_scores, human_strengths, human_improvements, concepts_to_study, key_takeaway, judge_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    debateId,
    verdict.winner,
    JSON.stringify(verdict.humanScores),
    JSON.stringify(verdict.aiScores),
    JSON.stringify(verdict.humanStrengths),
    JSON.stringify(verdict.humanImprovements),
    JSON.stringify(verdict.conceptsToStudy),
    verdict.keyTakeaway,
    verdict.judgeSummary
  );
}

// Get verdict for a debate
export function getVerdict(debateId) {
  const stmt = db.prepare(`SELECT * FROM verdicts WHERE debate_id = ?`);
  const row = stmt.get(debateId);
  if (!row) return null;

  return {
    winner: row.winner,
    humanScores: JSON.parse(row.human_scores),
    aiScores: JSON.parse(row.ai_scores),
    humanStrengths: JSON.parse(row.human_strengths),
    humanImprovements: JSON.parse(row.human_improvements),
    conceptsToStudy: JSON.parse(row.concepts_to_study),
    keyTakeaway: row.key_takeaway,
    judgeSummary: row.judge_summary
  };
}

// Get full debate with turns and verdict (for replay/sharing)
export function getFullDebate(id) {
  const debate = getDebate(id);
  if (!debate) return null;

  const turns = getTurns(id);
  const verdict = getVerdict(id);

  return {
    ...debate,
    turns: turns.map(t => ({
      turn: t.turn_number,
      player: t.player_argument,
      ai: t.ai_response
    })),
    verdict
  };
}

// Get recent debates (for optional listing - limited info)
export function getRecentDebates(limit = 20) {
  const stmt = db.prepare(`
    SELECT id, dilemma_title, player_side, status, created_at
    FROM debates
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export default db;
