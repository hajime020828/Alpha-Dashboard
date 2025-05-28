// pages/projects/[projectID].tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { StockRecord, ProjectWithProgress, ProjectDetailApiResponse } from '../../lib/db';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ProjectDetailPage = () => {
  const router = useRouter();
  const { projectID } = router.query;
  const [data, setData] = useState<ProjectDetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ... (既存のfetchロジックは変更なし) ...
    if (projectID && typeof projectID === 'string') {
      const fetchProjectDetails = async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/projects/${projectID}`);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            if (res.status === 404) {
              throw new Error('Project not found');
            }
            throw new Error(`API request failed with status ${res.status}: ${errorData.message || res.statusText}`);
          }
          const fetchedData: ProjectDetailApiResponse = await res.json();
          setData(fetchedData);
          setError(null);
        } catch (e: any) {
          setError(e.message || 'Failed to fetch project details');
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchProjectDetails();
    } else if (router.isReady && !projectID) {
        setLoading(false);
        setError("Project ID is missing in the URL.");
    }
  }, [projectID, router.isReady]);

  if (loading) return <p className="text-center text-gray-500">プロジェクト詳細を読み込み中...</p>;
  if (error) return <p className="text-center text-red-500">エラー: {error}</p>;
  if (!data || !data.project) return <p className="text-center text-gray-500">プロジェクトデータが見つかりません。</p>;

  const { project, stockRecords } = data;
  const displayStockRecords = [...stockRecords].reverse(); 

  const formatNumber = (value: number | null | undefined, fracDigits = 2, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    return value.toLocaleString('ja-JP', { 
      minimumFractionDigits: fracDigits, 
      maximumFractionDigits: fracDigits 
    });
  };
  
  const formatCurrency = (value: number | null | undefined, defaultVal: string = 'N/A') => {
    if (value === null || value === undefined) return defaultVal;
    return value.toLocaleString('ja-JP', { 
      style: 'currency', 
      currency: 'JPY', 
      minimumFractionDigits: 0, // PLは小数点なしで表示することが多い
      maximumFractionDigits: 0 
    });
  };
  
  const ProgressBarDetail = ({ progress, label, valueText, color = 'bg-blue-600', height = 'h-5' }: 
    { progress: number, label:string, valueText:string, color?: string, height?: string }) => (
    <div className="bg-white shadow-md rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{label}</h3>
        <div className={`w-full bg-gray-200 rounded-full ${height} dark:bg-gray-700 overflow-hidden my-1 relative`}>
            <div
                className={`${color} ${height} rounded-full text-xs font-medium text-white text-center p-0.5 leading-tight flex items-center justify-center`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            >
                {progress.toFixed(1)}%
            </div>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-right">{valueText}</p>
    </div>
  );

  const chartLabels = stockRecords.map(record => record.Date);
  const chartData = {
    // ... (chartDataの定義は変更なし) ...
    labels: chartLabels,
    datasets: [
      {
        type: 'line' as const,
        label: '約定平均価格',
        data: stockRecords.map(record => record.FilledAveragePrice),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'line' as const,
        label: '当日VWAP',
        data: stockRecords.map(record => record.ALL_DAY_VWAP),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'line' as const,
        label: 'ベンチマーク推移',
        data: stockRecords.map(record => record.cumulativeBenchmarkVWAP), 
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'yPrice',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        type: 'bar' as const,
        label: '約定数量',
        data: stockRecords.map(record => record.FilledQty),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgb(153, 102, 255)',
        yAxisID: 'yQuantity',
        order: 10 
      },
    ],
  };

  const chartOptions: any = { 
    // ... (chartOptionsの定義は変更なし) ...
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 20,
        bottom: 10,
        left: 10,
        right: 10
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '価格・VWAP・ベンチマーク推移と約定数量',
        font: { size: 16 },
        padding: {
            bottom: 20
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '日付',
        },
      },
      yPrice: { 
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: '価格',
        },
        grid: {
            drawOnChartArea: true,
        },
        ticks: {
          callback: function(value: string | number) {
            if (typeof value === 'number') {
              return formatNumber(value, 0);
            }
            return value;
          }
        },
        grace: '5%',
      },
      yQuantity: { 
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '約定数量 (株)',
        },
        grid: {
          drawOnChartArea: false, 
        },
        ticks: {
          callback: function(value: string | number) {
            if (typeof value === 'number') {
              return formatNumber(value, 0); 
            }
            return value;
          }
        },
        min: 0,
        grace: '10%',
      },
    },
    interaction: {
      mode: 'index' as const, 
      axis: 'x' as const,
      intersect: false
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">
        プロジェクト詳細: {project.Name} ({project.ProjectID || `Internal ID: ${project.internal_id}`})
      </h1>

      {/* 進捗表示セクション (変更なし) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ... ProgressBarDetail components ... */}
        <ProgressBarDetail
            label="経過日数進捗"
            progress={project.daysProgress}
            valueText={`(取引 ${project.tradedDaysCount || 0}日 / 全 ${project.Business_Days || 'N/A'}営業日)`}
            color="bg-sky-500"
        />
        <ProgressBarDetail
            label="約定進捗"
            progress={project.executionProgress}
            valueText={
                project.Side === 'SELL' ? 
                `(${formatNumber(project.totalFilledQty,0)} / ${formatNumber(project.Total_Shares,0) || 'N/A'} 株)` :
                `(${formatCurrency(project.totalFilledAmount)} / ${formatCurrency(project.Total_Amount)})`
            }
            color={project.Side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      {/* パフォーマンス指標カード (変更あり: PL追加) */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">パフォーマンス指標</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center"> {/* 4列に変更 */}
          <div>
            <p className="text-sm text-gray-500">プロジェクトPL</p> {/* 新しい項目 */}
            <p className={`text-2xl font-semibold ${project.projectPL !== null && project.projectPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(project.projectPL)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ベンチマーク VWAP</p>
            <p className="text-2xl font-semibold text-indigo-600">
              {formatNumber(project.benchmarkVWAP)} 
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">平均約定単価</p>
            <p className="text-2xl font-semibold text-teal-600">
              {formatNumber(project.averageExecutionPrice)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">平均約定株数/日</p>
            <p className="text-2xl font-semibold text-amber-600">
              {formatNumber(project.averageDailyShares, 0)} 株
            </p>
          </div>
        </div>
        {project.tradedDaysCount && project.tradedDaysCount > 0 ? (
            <p className="text-xs text-gray-500 mt-3 text-center">
                ※ 日次平均指標は取引のあった {project.tradedDaysCount} 日間の平均です。PLは総計です。
            </p>
        ) : (
            <p className="text-xs text-gray-500 mt-3 text-center">
                ※ 取引記録がないため、一部指標は計算できません。
            </p>
        )}
      </div>

      {/* 基本情報セクション (変更なし) */}
      <div className="bg-white shadow-md rounded-lg p-6">
         {/* ... Basic Info ... */}
         <h2 className="text-xl font-semibold mb-4 text-gray-700">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p><strong>銘柄コード:</strong> {project.Ticker}</p>
          <p><strong>銘柄名:</strong> {project.Name}</p>
          <p><strong>Side:</strong>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
              ${project.Side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
              {project.Side}
            </span>
          </p>
          {project.Side === 'SELL' ? (
            <p><strong>総株数:</strong> {formatNumber(project.Total_Shares, 0) ?? 'N/A'} 株</p>
          ) : (
            <p><strong>総金額:</strong> {formatCurrency(project.Total_Amount) ?? 'N/A'}</p>
          )}
          <p><strong>開始日:</strong> {project.Start_Date}</p>
          <p><strong>終了日:</strong> {project.End_Date}</p>
          <p><strong>価格制限:</strong> {formatNumber(project.Price_Limit, 0) ?? 'N/A'}</p>
          <p><strong>業績連動手数料率:</strong> {project.Performance_Based_Fee_Rate ?? 'N/A'}%</p>
          <p><strong>固定手数料率:</strong> {project.Fixed_Fee_Rate ?? 'N/A'}%</p>
          <p><strong>営業日数 (Business Days):</strong> {project.Business_Days ?? 'N/A'}</p>
          <p><strong>最短日数カウント:</strong> {project.Earliest_Day_Count ?? 'N/A'}</p>
          <p><strong>メモ:</strong> {project.Note || 'N/A'}</p>
        </div>
      </div>
      
      {/* チャート表示 (変更なし) */}
      {stockRecords && stockRecords.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-4 md:p-6">
          <div style={{ height: '400px' }}> 
            <Chart type='line' data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 取引履歴セクション (変更なし) */}
      {stockRecords && stockRecords.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg mt-6">
          {/* ... Transaction History Table ... */}
          <h2 className="text-xl font-semibold p-6 text-gray-700 border-b">取引履歴</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">日付</th>
                  <th className="py-3 px-6 text-right">約定数量</th>
                  <th className="py-3 px-6 text-right">約定平均価格</th>
                  <th className="py-3 px-6 text-right">当日VWAP</th>
                  <th className="py-3 px-6 text-right">ベンチマーク推移</th>
                  <th className="py-3 px-6 text-right">VWAP Perf. (bps)</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {displayStockRecords.map((record, index) => (
                  <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                    <td className="py-3 px-6 text-left whitespace-nowrap">{record.Date}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.FilledQty, 0)}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.FilledAveragePrice, 2)}</td>
                    <td className="py-3 px-6 text-right">{formatNumber(record.ALL_DAY_VWAP, 2)}</td>
                    <td className="py-3 px-6 text-right">
                      {formatNumber(record.cumulativeBenchmarkVWAP, 2, '-')}
                    </td>
                    <td className="py-3 px-6 text-right">
                      {formatNumber(record.vwapPerformanceBps, 1, '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-gray-500">このプロジェクトの取引履歴はありません。</p>
      )}
    </div>
  );
};

export default ProjectDetailPage;