import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyJwtToken } from "@/lib/auth";
import { getSyncCacheStats } from "@/lib/syncCache";

/**
 * API endpoint để lấy thông tin phân tích hiệu suất đồng bộ
 */
export async function GET(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { message: "Không được phép truy cập" },
        { status: 401 }
      );
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success || !verifyResult.payload) {
      return NextResponse.json(
        { message: "Token không hợp lệ" },
        { status: 401 }
      );
    }

    // Lấy khoảng thời gian từ query params (mặc định là 7 ngày qua)
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);

    // Tính thời gian giới hạn
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Lấy thống kê từ database
    const syncLogs = await prisma.syncLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Lấy thống kê cache
    const cacheStats = await getSyncCacheStats();

    // Xử lý dữ liệu theo ngày
    const dailyStats: Record<string, any> = {};
    const syncTypeStats: Record<string, any> = {
      inventory: { total: 0, success: 0, error: 0, skipped: 0 },
      price: { total: 0, success: 0, error: 0, skipped: 0 },
      all: { total: 0, success: 0, error: 0, skipped: 0 },
      webhook: { total: 0, success: 0, error: 0, skipped: 0 },
    };

    // Định nghĩa interfaces
    interface SyncLog {
      id: number;
      productMappingId: number | null;
      action: string;
      status: string;
      message: string | null;
      details: string | null;
      createdAt: Date;
      createdBy: string | null;
    }

    // Kiểu dữ liệu cho thông tin lỗi
    interface ErrorData {
      message: string;
      _count: {
        message: number;
      };
    }

    syncLogs.forEach((log: SyncLog) => {
      const date = log.createdAt.toISOString().split("T")[0]; // Format: YYYY-MM-DD

      // Khởi tạo thống kê cho ngày nếu chưa có
      if (!dailyStats[date]) {
        dailyStats[date] = {
          syncCount: 0,
          successCount: 0,
          errorCount: 0,
          skippedCount: 0,
          syncTypes: {
            inventory: 0,
            price: 0,
            all: 0,
            webhook: 0,
          },
        };
      }

      // Cập nhật thống kê chung
      dailyStats[date].syncCount++;

      // Phân loại theo trạng thái
      if (log.status === "success" || log.status === "completed") {
        dailyStats[date].successCount++;
      } else if (log.status === "error") {
        dailyStats[date].errorCount++;
      } else if (log.status === "skipped") {
        dailyStats[date].skippedCount++;
      }

      // Phân loại theo loại đồng bộ
      let syncType = "all";
      if (log.action.includes("inventory")) {
        syncType = "inventory";
      } else if (log.action.includes("price")) {
        syncType = "price";
      } else if (log.action.includes("webhook")) {
        syncType = "webhook";
      }

      dailyStats[date].syncTypes[syncType]++;

      // Cập nhật thống kê theo loại đồng bộ
      syncTypeStats[syncType].total++;

      if (log.status === "success" || log.status === "completed") {
        syncTypeStats[syncType].success++;
      } else if (log.status === "error") {
        syncTypeStats[syncType].error++;
      } else if (log.status === "skipped") {
        syncTypeStats[syncType].skipped++;
      }

      // Phân tích chi tiết nếu có
      try {
        if (log.details) {
          const details = JSON.parse(log.details);

          // Có thể phân tích thêm chi tiết ở đây nếu cần
        }
      } catch (e) {
        // Bỏ qua lỗi parse JSON
      }
    });

    // Tính toán hiệu suất đồng bộ trung bình
    let totalSuccess = 0;
    let totalError = 0;
    let totalSkipped = 0;
    let totalSync = 0;

    Object.values(dailyStats).forEach((day: any) => {
      totalSuccess += day.successCount;
      totalError += day.errorCount;
      totalSkipped += day.skippedCount;
      totalSync += day.syncCount;
    });

    // Lấy tổng số sản phẩm
    const totalProducts = await prisma.productMapping.count();

    // Tìm lỗi đồng bộ phổ biến
    const commonErrors = await prisma.syncLog.groupBy({
      by: ["message"],
      where: {
        status: "error",
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        message: true,
      },
      orderBy: {
        _count: {
          message: "desc",
        },
      },
      take: 5,
    });

    // Thêm header để không cache kết quả
    const headers = new Headers();
    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return NextResponse.json(
      {
        success: true,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        overview: {
          totalProducts,
          totalSyncs: totalSync,
          successRate: totalSync > 0 ? (totalSuccess / totalSync) * 100 : 0,
          errorRate: totalSync > 0 ? (totalError / totalSync) * 100 : 0,
          skippedRate: totalSync > 0 ? (totalSkipped / totalSync) * 100 : 0,
        },
        cacheStats,
        syncTypeStats,
        dailyStats,
        commonErrors: commonErrors.map((error: ErrorData) => ({
          message: error.message,
          count: error._count.message,
        })),
      },
      { headers }
    );
  } catch (error: any) {
    console.error("Error fetching sync analytics:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Lỗi: ${error.message || "Không xác định"}`,
      },
      { status: 500 }
    );
  }
}
