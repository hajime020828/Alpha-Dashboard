// pages/api/projects/[projectID].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, Project, StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '@/lib/db';

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

    // Omit 型に cumulativeFilledQty も追加
    let rawStockRecords: Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty'>[] = [];
    if (projectData.ProjectID) {
      rawStockRecords = await db.all<Omit<StockRecord, 'cumulativeBenchmarkVWAP' | 'vwapPerformanceBps' | 'cumulativeFilledAmount' | 'cumulativeFilledQty'>[]>(
        'SELECT * FROM stock_records WHERE ProjectID = ? ORDER BY Date ASC', 
        projectData.ProjectID
      );
    }
    
    const distinctDailyVWAPsEncountered = new Map<string, number>();
    let sumOfDistinctVWAPsForBenchmark = 0;
    let countOfDistinctDaysForBenchmark = 0;
    let currentCumulativeFilledAmount = 0;
    let currentCumulativeFilledQty = 0; // 累積約定株数の計算用変数

    const processedStockRecords: StockRecord[] = rawStockRecords.map(rawRecord => {
      const recordFilledQty = typeof rawRecord.FilledQty === 'number' ? rawRecord.FilledQty : null;
      const recordFilledAveragePrice = typeof rawRecord.FilledAveragePrice === 'number' ? rawRecord.FilledAveragePrice : null;
      const recordAllDayVWAP = typeof rawRecord.ALL_DAY_VWAP === 'number' ? rawRecord.ALL_DAY_VWAP : null;
      const recordDate = rawRecord.Date || '';
      const recordStockCycle = rawRecord.StockCycle || '';
      const recordProjectID = rawRecord.ProjectID || '';


      if (!distinctDailyVWAPsEncountered.has(recordDate)) {
        const dailyVWAP = recordAllDayVWAP || 0;
        distinctDailyVWAPsEncountered.set(recordDate, dailyVWAP);
        sumOfDistinctVWAPsForBenchmark += dailyVWAP;
        countOfDistinctDaysForBenchmark++;
      }
      const currentCumulativeBenchmark = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

      let vwapPerfBps: number | null = null;
      if (recordFilledAveragePrice != null && recordAllDayVWAP != null && recordAllDayVWAP !== 0) {
        if (projectData.Side === 'BUY') {
          vwapPerfBps = ((recordAllDayVWAP - recordFilledAveragePrice) / recordAllDayVWAP) * 10000;
        } else if (projectData.Side === 'SELL') {
          vwapPerfBps = ((recordFilledAveragePrice - recordAllDayVWAP) / recordAllDayVWAP) * 10000;
        }
      }
      
      let dailyFilledAmount = 0;
      if (recordFilledQty != null && recordFilledAveragePrice != null) {
        dailyFilledAmount = recordFilledQty * recordFilledAveragePrice;
      }
      currentCumulativeFilledAmount += dailyFilledAmount; 

      if (recordFilledQty != null) { // 当日の約定株数を累積に加算
        currentCumulativeFilledQty += recordFilledQty;
      }

      return {
        StockCycle: recordStockCycle,
        ProjectID: recordProjectID,
        FilledQty: recordFilledQty || 0,
        FilledAveragePrice: recordFilledAveragePrice || 0,
        ALL_DAY_VWAP: recordAllDayVWAP || 0,
        Date: recordDate,
        cumulativeBenchmarkVWAP: currentCumulativeBenchmark,
        vwapPerformanceBps: vwapPerfBps,
        cumulativeFilledAmount: currentCumulativeFilledAmount,
        cumulativeFilledQty: currentCumulativeFilledQty, // 追加
      } as StockRecord;
    });

    let daysProgress = 0;
    const currentTradedDaysCount = distinctDailyVWAPsEncountered.size;
    if (projectData.Business_Days && projectData.Business_Days > 0) {
        daysProgress = (currentTradedDaysCount / projectData.Business_Days) * 100;
        daysProgress = Math.min(100, Math.max(0, daysProgress));
    }

    let executionProgress = 0;
    // プロジェクト全体の最終的な累積約定株数と金額
    const totalProjectFilledQty = currentCumulativeFilledQty; // 最後のレコードの累積約定株数がプロジェクト全体の累積
    const totalProjectFilledAmount = currentCumulativeFilledAmount; 

    if (processedStockRecords.length > 0) {
      if (projectData.Side === 'SELL' && projectData.Total_Shares && projectData.Total_Shares > 0) {
        executionProgress = (totalProjectFilledQty / projectData.Total_Shares) * 100;
      } else if (projectData.Side === 'BUY' && projectData.Total_Amount && projectData.Total_Amount > 0) {
        executionProgress = (totalProjectFilledAmount / projectData.Total_Amount) * 100;
      }
      executionProgress = Math.min(100, Math.max(0, executionProgress));
    }
    
    const overallBenchmarkVWAP = (countOfDistinctDaysForBenchmark > 0)
        ? (sumOfDistinctVWAPsForBenchmark / countOfDistinctDaysForBenchmark)
        : null;

    let averageExecutionPrice: number | null = null;
    if (totalProjectFilledQty > 0 && totalProjectFilledAmount !== null) { 
        averageExecutionPrice = totalProjectFilledAmount / totalProjectFilledQty;
    }
    let averageDailyShares: number | null = null;
    if (currentTradedDaysCount > 0 && totalProjectFilledQty !== null) {
        averageDailyShares = totalProjectFilledQty / currentTradedDaysCount;
    }

    const projectWithProgressData: ProjectWithProgress = {
      ...projectData,
      daysProgress: parseFloat(daysProgress.toFixed(2)),
      executionProgress: parseFloat(executionProgress.toFixed(2)),
      totalFilledQty: totalProjectFilledQty,
      totalFilledAmount: totalProjectFilledAmount,
      tradedDaysCount: currentTradedDaysCount,
      benchmarkVWAP: overallBenchmarkVWAP,
      averageExecutionPrice: averageExecutionPrice,
      averageDailyShares: averageDailyShares,
    };
    
    res.status(200).json({ project: projectWithProgressData, stockRecords: processedStockRecords });

  } catch (error) {
    console.error(`Error fetching project details for ${projectID}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
}