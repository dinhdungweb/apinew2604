import { NextRequest, NextResponse } from "next/server";
import { verifyJwtToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Định nghĩa kiểu dữ liệu
interface LogData {
  id: number;
  productMappingId: number | null;
  productMapping: any;
  action: string;
  status: string;
  message: string | null;
  details: string | null;
  createdAt: Date;
  createdBy: string | null;
}

interface SourceData {
  action: string;
  _count: {
    _all: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Xác thực JWT token
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Không có token xác thực",
        },
        { status: 401 }
      );
    }

    const decodedResult = await verifyJwtToken(token);
    if (!decodedResult.success || !decodedResult.payload) {
      return NextResponse.json(
        {
          success: false,
          message: "Token không hợp lệ hoặc hết hạn",
        },
        { status: 401 }
      );
    }

    // Lấy các tham số tìm kiếm và phân trang
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";
    const source = url.searchParams.get("source") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Xây dựng các điều kiện lọc
    let whereConditions: any = {};

    // Lọc theo từ khóa tìm kiếm
    if (search) {
      whereConditions.OR = [
        { message: { contains: search } },
        { details: { contains: search } },
        {
          productMapping: {
            shopifyId: { contains: search },
          },
        },
      ];
    }

    // Lọc theo trạng thái
    if (status) {
      whereConditions.status = status;
    }

    // Lọc theo nguồn (source)
    if (source) {
      whereConditions.action = { contains: source };
    }

    // Lọc theo khoảng thời gian
    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};

      if (dateFrom) {
        whereConditions.createdAt.gte = new Date(dateFrom);
      }

      if (dateTo) {
        // Đặt thời gian đến cuối ngày
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        whereConditions.createdAt.lte = toDate;
      }
    }

    // Đếm tổng số bản ghi theo điều kiện lọc
    const totalCount = await prisma.syncLog.count({ where: whereConditions });

    // Tính toán phân trang
    const skip = (page - 1) * pageSize;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Xác định cách sắp xếp
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Lấy dữ liệu theo điều kiện và phân trang
    const logs = await prisma.syncLog.findMany({
      where: whereConditions,
      skip,
      take: pageSize,
      orderBy,
      include: {
        productMapping: true,
      },
    });

    // Đếm theo trạng thái
    const successCount = await prisma.syncLog.count({
      where: {
        ...whereConditions,
        status: "success",
      },
    });

    const errorCount = await prisma.syncLog.count({
      where: {
        ...whereConditions,
        status: "error",
      },
    });

    const warningCount = await prisma.syncLog.count({
      where: {
        ...whereConditions,
        status: "warning",
      },
    });

    // Kiểm tra xem bảng có dữ liệu không
    const tableInfo = {
      hasRecords: totalCount > 0,
      totalRecords: totalCount,
    };

    // Thống kê các nguồn (sources) để hiển thị trong bộ lọc
    const sources = await prisma.syncLog.groupBy({
      by: ["action"],
      _count: {
        _all: true,
      },
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((log: LogData) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        message: log.message,
        details: log.details,
        createdAt: log.createdAt,
        createdBy: log.createdBy,
        productMappingId: log.productMappingId,
        shopifyId: log.productMapping?.shopifyId,
      })),
      pagination: {
        totalItems: totalCount,
        totalPages,
        currentPage: page,
        pageSize,
      },
      statistics: {
        totalCount,
        statusCounts: {
          success: successCount,
          error: errorCount,
          warning: warningCount,
          pending: totalCount - (successCount + errorCount + warningCount),
        },
        sources: sources.map((src: SourceData) => ({
          name: src.action,
          count: src._count._all,
        })),
      },
      tableInfo,
    });
  } catch (error: any) {
    console.error("Error checking sync logs:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Lỗi: ${error.message || "Không thể kiểm tra Sync Logs"}`,
      },
      { status: 500 }
    );
  }
}
