// lib/db.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

// getDb 関数が 'export async function' となっていることを確認
export async function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'VWAP_Alpha.db');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return db;
}

// 各インターフェースも 'export interface' となっていることを確認
export interface Project {
  internal_id: number;
  ProjectID: string | null;
  Ticker: string;
  Name: string;
  Side: 'BUY' | 'SELL';
  Total_Shares: number | null;
  Total_Amount: number | null;
  Start_Date: string;
  End_Date: string;
  Price_Limit: number | null;
  Performance_Based_Fee_Rate: number | null;
  Fixed_Fee_Rate: number | null;
  Business_Days: number | null;
  Note: string | null;
  Earliest_Day_Count: number | null;
}

// lib/db.ts
// ... (getDb, Project の定義は変更なし) ...

export interface StockRecord {
  StockCycle: string;
  ProjectID: string;
  FilledQty: number;
  FilledAveragePrice: number;
  ALL_DAY_VWAP: number;
  Date: string; // YYYY/MM/DD
  cumulativeBenchmarkVWAP: number | null;

  // 新しく追加するフィールド
  vwapPerformanceBps: number | null; // VWAPパフォーマンス (bps)
}

export interface ProjectWithProgress extends Project {
  daysProgress: number;
  executionProgress: number;
  totalFilledQty?: number;
  totalFilledAmount?: number;
  tradedDaysCount?: number;
  benchmarkVWAP: number | null;
  averageExecutionPrice: number | null;
  averageDailyShares: number | null;

  // 新しく追加するフィールド
  projectPL: number | null; // プロジェクト全体のPL
}

export interface ProjectDetailApiResponse {
  project: ProjectWithProgress | undefined;
  stockRecords: StockRecord[]; // StockRecord型が更新されていることに注意
}