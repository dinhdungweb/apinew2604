'use client';

import { useMemo } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Đăng ký các component cần thiết cho Chart.js
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
);

interface SyncPerformanceChartProps {
  dailyStats: Record<string, any>;
  loading?: boolean;
}

const SyncPerformanceChart: React.FC<SyncPerformanceChartProps> = ({ 
  dailyStats,
  loading = false
}) => {
  // Xử lý dữ liệu cho biểu đồ
  const chartData = useMemo(() => {
    // Nếu không có dữ liệu hoặc đang loading, trả về dữ liệu trống
    if (!dailyStats || loading || Object.keys(dailyStats).length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Sắp xếp các ngày theo thứ tự tăng dần
    const sortedDates = Object.keys(dailyStats).sort();
    
    // Lấy dữ liệu cho từng loại trạng thái
    const successData = sortedDates.map(date => dailyStats[date].successCount || 0);
    const errorData = sortedDates.map(date => dailyStats[date].errorCount || 0);
    const skippedData = sortedDates.map(date => dailyStats[date].skippedCount || 0);

    // Format lại nhãn ngày tháng để hiển thị thân thiện hơn
    const formattedLabels = sortedDates.map(date => {
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    return {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Thành công',
          data: successData,
          borderColor: '#10B981', // green-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Lỗi',
          data: errorData,
          borderColor: '#EF4444', // red-500
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Bỏ qua',
          data: skippedData,
          borderColor: '#F59E0B', // amber-500
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, [dailyStats, loading]);

  // Cấu hình cho biểu đồ
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0 // Chỉ hiển thị số nguyên
        }
      }
    }
  };

  // Hiển thị skeleton loader khi đang loading
  if (loading) {
    return (
      <div className="h-64 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md"></div>
    );
  }

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default SyncPerformanceChart; 