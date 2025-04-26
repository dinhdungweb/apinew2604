'use client';

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Đăng ký các component cần thiết cho Chart.js
ChartJS.register(ArcElement, Tooltip, Legend);

interface SyncStatusChartProps {
  successCount: number;
  errorCount: number;
  skippedCount: number;
  loading?: boolean;
}

const SyncStatusChart: React.FC<SyncStatusChartProps> = ({
  successCount,
  errorCount,
  skippedCount,
  loading = false
}) => {
  // Chuẩn bị dữ liệu cho biểu đồ
  const data = {
    labels: ['Thành công', 'Lỗi', 'Bỏ qua'],
    datasets: [
      {
        data: [successCount, errorCount, skippedCount],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)', // green-500
          'rgba(239, 68, 68, 0.8)',  // red-500
          'rgba(245, 158, 11, 0.8)',  // amber-500
        ],
        borderColor: [
          '#10B981', // green-500
          '#EF4444', // red-500
          '#F59E0B', // amber-500
        ],
        borderWidth: 1,
      },
    ],
  };

  // Cấu hình cho biểu đồ
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          boxWidth: 12,
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = successCount + errorCount + skippedCount;
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '70%',
  };

  // Hiển thị skeleton loader khi đang loading
  if (loading) {
    return (
      <div className="h-64 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md"></div>
    );
  }

  // Hiển thị thông báo nếu không có dữ liệu
  if (successCount === 0 && errorCount === 0 && skippedCount === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Chưa có dữ liệu đồng bộ
      </div>
    );
  }

  return (
    <div className="h-64 relative">
      <Doughnut data={data} options={options} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-xl font-semibold">
          {successCount + errorCount + skippedCount}
        </div>
        <div className="text-sm text-gray-500">Tổng cộng</div>
      </div>
    </div>
  );
};

export default SyncStatusChart; 