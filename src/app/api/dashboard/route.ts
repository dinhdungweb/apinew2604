import { NextRequest, NextResponse } from "next/server";
import { verifyJwtToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Hàm chuyển đổi BigInt thành số thường
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntToNumber(item));
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntToNumber(obj[key]);
    }
    return result;
  }

  return obj;
}

// Interface cho kết quả truy vấn SQL
interface SyncCountResult {
  total: number;
  success: number;
  error: number;
}

interface SyncLogRaw {
  id: number;
  action: string;
  status: string;
  message: string | null;
  details: string | null;
  createdAt: Date;
  createdBy: string | null;
  productId: string | null;
}

// Hàm định dạng ngày tháng
function formatDate(dateInput: any): string {
  if (!dateInput) return new Date().toISOString();

  try {
    // Nếu là chuỗi ISO 8601 hợp lệ
    if (
      typeof dateInput === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateInput)
    ) {
      return dateInput;
    }

    // Nếu là đối tượng Date
    if (dateInput instanceof Date) {
      return dateInput.toISOString();
    }

    // Thử chuyển đổi thành đối tượng Date
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Trả về ngày hiện tại nếu không thể chuyển đổi
    return new Date().toISOString();
  } catch (e) {
    console.error("Lỗi khi định dạng ngày tháng:", e);
    return new Date().toISOString();
  }
}

// Tính toán thống kê từ sync logs
interface SyncLogStat {
  status: string;
  _count: {
    id: number;
  };
}

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
    if (!verifyResult || !verifyResult.success) {
      return NextResponse.json(
        { message: "Token không hợp lệ" },
        { status: 401 }
      );
    }

    // Lấy thông số thống kê
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "7days"; // 7days, 30days, all

    // Tính toán thời gian dựa trên period
    let startDate = new Date();
    if (period === "7days") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "30days") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "all") {
      startDate = new Date(0); // Từ đầu thời gian
    }

    // DEBUG: In dữ liệu các bảng
    console.log("Kiểm tra schema database:");
    const schemaInfo = {
      productMappings: await prisma.productMapping.findMany({ take: 1 }),
      syncLogs: await prisma.syncLog.findMany({ take: 1 }),
    };
    console.log(
      "Schema Info:",
      JSON.stringify(convertBigIntToNumber(schemaInfo), null, 2)
    );

    // Lấy dữ liệu sản phẩm từ Shopify cache giống như trong API products/stats
    let shopifyProducts = [];
    try {
      // Import getShopifyCache từ lib
      const { getShopifyCache } = await import("@/lib/shopifyCache");

      // Thử lấy dữ liệu từ cache với cơ chế retry
      const MAX_RETRIES = 3;
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        shopifyProducts = await getShopifyCache();
        console.log(
          `Dashboard API: Lần thử ${
            retryCount + 1
          }: Số lượng sản phẩm từ cache:`,
          shopifyProducts.length
        );

        if (shopifyProducts.length > 0) {
          // Đã có dữ liệu, thoát khỏi vòng lặp
          break;
        }

        // Chưa có dữ liệu, đợi một chút rồi thử lại
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryCount++;
      }

      console.log(
        "Dashboard API: Số lượng sản phẩm từ Shopify cache:",
        shopifyProducts.length
      );
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu từ Shopify cache:", error);
    }

    // Đếm tổng số sản phẩm đã mapping
    const mappedProductsCount = await prisma.productMapping.count();

    // Sử dụng số lượng sản phẩm từ Shopify cache nếu có, ngược lại sử dụng số lượng đã mapping
    const totalProducts =
      shopifyProducts.length > 0 ? shopifyProducts.length : mappedProductsCount;

    // Đếm số lượng đồng bộ thành công và lỗi
    const successCount = await prisma.productMapping.count({
      where: { status: "success" },
    });

    const errorCount = await prisma.productMapping.count({
      where: { status: "error" },
    });

    // Đếm số lượng sync logs trong khoảng thời gian - Sử dụng Prisma thay vì raw SQL
    const syncLogsStats = await prisma.syncLog.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Tính tổng các loại status
    let totalSyncs = 0;
    let successSyncs = 0;
    let errorSyncs = 0;

    syncLogsStats.forEach((stat: SyncLogStat) => {
      const count = stat._count.id;
      totalSyncs += count;
      if (stat.status === "success") {
        successSyncs = count;
      } else if (stat.status === "error") {
        errorSyncs = count;
      }
    });

    // Lấy lịch sử đồng bộ gần đây bằng Prisma
    const recentSyncs = await prisma.syncLog.findMany({
      select: {
        id: true,
        action: true,
        status: true,
        message: true,
        details: true,
        createdAt: true,
        createdBy: true,
        productMapping: {
          select: {
            shopifyId: true,
            nhanhData: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    // Kiểm tra xem có dữ liệu không
    console.log("Dữ liệu SyncLog:", recentSyncs?.length || 0);

    // Chuyển đổi BigInt trước khi xử lý
    const processedSyncs = convertBigIntToNumber(recentSyncs);

    // Xử lý dữ liệu để hiển thị
    const syncHistory = Array.isArray(processedSyncs)
      ? processedSyncs.map((log) => {
          // Parse JSON từ details nếu có
          let details = null;
          try {
            if (log.details) {
              details = JSON.parse(log.details);
            }
          } catch (e) {
            details = log.details;
          }

          // Parse JSON từ nhanhData nếu có
          let nhanhData = null;
          try {
            if (log.productMapping && log.productMapping.nhanhData) {
              nhanhData = JSON.parse(log.productMapping.nhanhData);
            }
          } catch (e) {
            nhanhData = null;
          }

          // Lấy thông tin sản phẩm từ nhiều nguồn
          let productName = "";
          let productId = log.productMapping
            ? log.productMapping.shopifyId
            : "N/A";

          // Ưu tiên 1: Lấy tên từ details.nhanh.title
          if (details && details.nhanh && details.nhanh.title) {
            productName = details.nhanh.title;
          }
          // Ưu tiên 2: Lấy tên từ details.shopify.title nếu không phải là "Đồng bộ mapping Shopify/Nhanh"
          else if (
            details &&
            details.shopify &&
            details.shopify.title &&
            details.shopify.title !== "Đồng bộ mapping Shopify/Nhanh"
          ) {
            productName = details.shopify.title;
          }
          // Ưu tiên 3: Lấy tên từ nhanhData
          else if (nhanhData && nhanhData.name) {
            productName = nhanhData.name;
          }
          // Cuối cùng: Sử dụng ID sản phẩm
          else {
            productName = productId || "Sản phẩm không xác định";
          }

          return {
            id: log.id,
            action: log.action,
            status: log.status,
            message: log.message || "",
            productId: productId,
            productName: productName,
            createdAt: formatDate(log.createdAt),
            createdBy: log.createdBy || "Hệ thống",
            details: details,
          };
        })
      : [];

    // Tính tỷ lệ thành công
    const successRate =
      totalSyncs > 0 ? Math.round((successSyncs / totalSyncs) * 100) : 0;

    // Lấy dữ liệu thống kê theo ngày cho biểu đồ
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Tính khoảng thời gian cho thống kê theo ngày
    let startDateForDaily = new Date();
    if (period === "7days") {
      startDateForDaily.setDate(startDateForDaily.getDate() - 7);
    } else if (period === "30days") {
      startDateForDaily.setDate(startDateForDaily.getDate() - 30);
    } else if (period === "today") {
      startDateForDaily.setHours(0, 0, 0, 0);
    } else if (period === "yesterday") {
      startDateForDaily.setDate(startDateForDaily.getDate() - 1);
      startDateForDaily.setHours(0, 0, 0, 0);
    }
    startDateForDaily.setHours(0, 0, 0, 0);

    // Lấy dữ liệu logs theo ngày
    const dailyLogs = await prisma.syncLog.findMany({
      where: {
        createdAt: {
          gte: startDateForDaily,
          lte: today,
        },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    // Xử lý dữ liệu thống kê theo ngày
    const dailyStats: Record<string, any> = {};

    // Khởi tạo dữ liệu cho tất cả các ngày trong khoảng
    let currentDate = new Date(startDateForDaily);
    while (currentDate <= today) {
      const dateKey = currentDate.toISOString().split("T")[0];
      dailyStats[dateKey] = {
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        totalCount: 0,
      };

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Điền dữ liệu vào từ logs
    dailyLogs.forEach((log: DailyLog) => {
      const dateKey = log.createdAt.toISOString().split("T")[0];

      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          successCount: 0,
          errorCount: 0,
          skippedCount: 0,
          totalCount: 0,
        };
      }

      dailyStats[dateKey].totalCount++;

      if (log.status === "success") {
        dailyStats[dateKey].successCount++;
      } else if (log.status === "error") {
        dailyStats[dateKey].errorCount++;
      } else if (log.status === "skipped") {
        dailyStats[dateKey].skippedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        mappedProductsCount,
        successCount,
        errorCount,
        totalSyncs,
        successSyncs,
        errorSyncs,
        successRate,
        skippedSyncs: totalSyncs - successSyncs - errorSyncs,
        dailyStats,
      },
      syncHistory,
    });
  } catch (error: any) {
    console.error("Dashboard API error:", error.message);
    return NextResponse.json(
      {
        success: false,
        message: `Lỗi server: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

// Định nghĩa kiểu dữ liệu cho log
interface DailyLog {
  createdAt: Date;
  status: string;
  count: number;
}
