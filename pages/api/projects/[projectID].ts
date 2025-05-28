// pages/api/projects/[projectID].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectDetailApiResponse | { message: string }>
) {
  const { projectID } = req.query;

  if (typeof projectID !== 'string') {
    res.status(400).json({ message: 'Invalid ProjectID' });
    return;
  }

  try {
    const db = await getDb();
    const projectData = await db.get<Project>(
      'SELECT * FROM projects WHERE ProjectID = ?',
      projectID
    );

    if (!projectData) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    let rawStockRecords: Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps'>[] = [];
    if (projectData.ProjectID) {
      rawStockRecords = await db.all<Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps'>[]>(
        'SELECT * FROM stock_records WHERE ProjectID = ? ORDER BY Date ASC',
        projectData.ProjectID
      );
    }
    
    const distinctDailyVWAPsEncountered = new Map<string, number>();
    let sumOfDistinctVWAPsForBenchmark = 0;
    let countOfDistinctDaysForBenchmark = 0;

    const processedStockRecords: StockRecord[] = rawStockRecords.map(record => {
      if (!distinctDailyVWAPsEncountered.has(record.Date)) {
        const dailyVWAP = record.ALL_DAY_VWAP || 0;
        distinctDailyVWAPsEncountered.set(record.Date, dailyVWAP);
        sumOfDistinctVWAPsForBenchmark += dailyVWAP;
        countOfDistinctDaysForBenchmark++;
      }
      const currentCumulativeBenchmark = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

      let vwapPerfBps: number | null = null;
      if (record.FilledAveragePrice != null && record.ALL_DAY_VWAP != null && record.ALL_DAY_VWAP !== 0) {
        if (projectData.Side === 'BUY') {
          vwapPerfBps = ((record.ALL_DAY_VWAP - record.FilledAveragePrice) / record.ALL_DAY_VWAP) * 10000;
        } else if (projectData.Side === 'SELL') {
          vwapPerfBps = ((record.FilledAveragePrice - record.ALL_DAY_VWAP) / record.ALL_DAY_VWAP) * 10000;
        }
      }

      return {
        ...record,
        cumulativeBenchmarkVWAP: currentCumulativeBenchmark,
        vwapPerformanceBps: vwapPerfBps,
      };
    });

    let daysProgress = 0;
    const currentTradedDaysCount = distinctDailyVWAPsEncountered.size;
    if (projectData.Business_Days && projectData.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / projectData.Business_Days) * 100;
        daysProgress = Math.min(100, Math.max(0, daysProgress)); // 0-100に収める
    }

    let executionProgress = 0;
    let totalFilledQty: number | undefined = undefined;
    let totalFilledAmount: number | undefined = undefined;

    if (processedStockRecords.length > 0) {
      totalFilledQty = processedStockRecords.reduce((sum, sr) => sum + (sr.FilledQty || 0), 0);
      totalFilledAmount = processedStockRecords.reduce((sum, sr) => sum + ((sr.FilledQty || 0) * (sr.FilledAveragePrice || 0)), 0);

      if (projectData.Side === 'SELL' && projectData.Total_Shares && projectData.Total_Shares > 0) {
        executionProgress = (totalFilledQty && projectData.Total_Shares) ? (totalFilledQty / projectData.Total_Shares) * 100 : 0;
      } else if (projectData.Side === 'BUY' && projectData.Total_Amount && projectData.Total_Amount > 0) {
        executionProgress = (totalFilledAmount && projectData.Total_Amount) ? (totalFilledAmount / projectData.Total_Amount) * 100 : 0;
      }
      executionProgress = Math.min(100, Math.max(0, executionProgress)); // 0-100に収める
    }
    
    const overallBenchmarkVWAP = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;
    let averageExecutionPrice: number | null = null;
    if (totalFilledQty && totalFilledQty > 0 && totalFilledAmount !== undefined && totalFilledAmount !== null) { // totalFilledQtyが0でないことを確認
        averageExecutionPrice = totalFilledAmount / totalFilledQty;
    }
    let averageDailyShares: number | null = null;
    if (currentTradedDaysCount > 0 && totalFilledQty !== undefined && totalFilledQty !== null) {
        averageDailyShares = totalFilledQty / currentTradedDaysCount;
    }

    // --- プロジェクトPLの計算 ---
    let projectPL: number | null = null;
    if (
      projectData.Side &&
      overallBenchmarkVWAP !== null &&
      totalFilledQty !== undefined && totalFilledQty !== null && totalFilledQty > 0 && // PL計算には約定株数が必要
      totalFilledAmount !== undefined && totalFilledAmount !== null
    ) {
      if (projectData.Side === 'BUY') {
        projectPL = (overallBenchmarkVWAP * totalFilledQty) - totalFilledAmount;
      } else if (projectData.Side === 'SELL') {
        projectPL = totalFilledAmount - (overallBenchmarkVWAP * totalFilledQty);
      }
    }

    const projectWithProgressData: ProjectWithProgress = {
      ...projectData,
      daysProgress: daysProgress, // 既に丸められているか、または丸める処理を追加
      executionProgress: executionProgress, // 同上
      totalFilledQty: totalFilledQty,
      totalFilledAmount: totalFilledAmount,
      tradedDaysCount: currentTradedDaysCount,
      benchmarkVWAP: overallBenchmarkVWAP,
      averageExecutionPrice: averageExecutionPrice,
      averageDailyShares: averageDailyShares,
      projectPL: projectPL, // 新しいPLフィールド
    };
    
    // 数値の丸め処理を一箇所で行うか、各計算時に行うか方針を統一
    // ここでは主要な計算結果はそのまま渡し、フロントエンドで表示時に丸めることを推奨
    // ただし、daysProgress と executionProgress は % なのでAPI側で丸めても良い
    projectWithProgressData.daysProgress = parseFloat(projectWithProgressData.daysProgress.toFixed(2));
    projectWithProgressData.executionProgress = parseFloat(projectWithProgressData.executionProgress.toFixed(2));
    // 他の monetary/price/quantity value はフロントで formatNumber/formatCurrency を使う

    res.status(200).json({ project: projectWithProgressData, stockRecords: processedStockRecords });

  } catch (error) {
    console.error(`Error fetching project details for ${projectID}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
}