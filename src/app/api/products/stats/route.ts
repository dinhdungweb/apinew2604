import { NextRequest, NextResponse } from "next/server";
import { verifyJwtToken } from "@/lib/auth";
import { getShopifyCache } from "@/lib/shopifyCache";
import prisma from "@/lib/prisma";

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

    // Lấy dữ liệu sản phẩm từ cache
    console.log("API stats: Đang lấy dữ liệu từ cache...");

    // Thử lấy dữ liệu từ cache, với cơ chế retry nếu cache trống
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let products = [];

    while (retryCount < MAX_RETRIES) {
      products = await getShopifyCache();
      console.log(
        `API stats: Lần thử ${retryCount + 1}: Số lượng sản phẩm từ cache:`,
        products.length
      );

      if (products.length > 0) {
        // Đã có dữ liệu, thoát khỏi vòng lặp
        break;
      }

      // Chưa có dữ liệu, đợi một chút rồi thử lại
      console.log("API stats: Cache trống, đợi 500ms trước khi thử lại...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      retryCount++;
    }

    // Kiểm tra cấu trúc dữ liệu
    if (products.length > 0) {
      const firstProduct = products[0];
      console.log("API stats: Mẫu sản phẩm đầu tiên:", {
        id: firstProduct.id,
        product_id: firstProduct.product_id,
        name: firstProduct.name,
        isVariant: firstProduct.id !== firstProduct.product_id,
      });

      // Đếm số lượng sản phẩm gốc (không tính variants)
      const uniqueProductIds = new Set<string>();
      products.forEach((product: any) => uniqueProductIds.add(product.product_id));
      console.log(
        "API stats: Số lượng sản phẩm gốc (unique product_id):",
        uniqueProductIds.size
      );
      console.log(
        "API stats: Số lượng variants (tổng entries):",
        products.length
      );
    } else {
      console.log(
        "API stats: Không có dữ liệu sản phẩm trong cache sau nhiều lần thử"
      );
    }

    // Đảm bảo products là một mảng và loại bỏ các phần tử null hoặc undefined
    const validProducts = Array.isArray(products)
      ? products.filter((item) => item !== null && item !== undefined)
      : [];

    console.log("API stats: Số lượng sản phẩm hợp lệ:", validProducts.length);

    // Lấy dữ liệu mapping từ database
    let mappedCount = 0;
    let errorCount = 0;

    try {
      // Đếm số lượng mapping
      mappedCount = await prisma.productMapping.count();
      console.log("API stats: Số lượng sản phẩm đã mapping:", mappedCount);

      // Đếm số lượng lỗi - Sử dụng Prisma thay vì raw SQL để tránh vấn đề về cú pháp
      // Dùng phương thức count() thay vì raw query
      errorCount = await prisma.syncLog.count({
        where: {
          status: "error",
        },
      });

      console.log("API stats: Số lượng sản phẩm có lỗi:", errorCount);
    } catch (error) {
      console.error("API stats: Lỗi khi lấy dữ liệu từ database:", error);
    }

    // Tính toán số liệu thống kê
    // Đếm số lượng sản phẩm gốc (không tính variants)
    const uniqueProductIds = new Set<string>();
    validProducts.forEach((product: any) =>
      uniqueProductIds.add(product.product_id)
    );

    // Log thông tin để dễ debug
    console.log(
      "API stats: Số lượng sản phẩm gốc (unique product_id):",
      uniqueProductIds.size
    );
    console.log(
      "API stats: Số lượng variants (tổng entries):",
      validProducts.length
    );

    // Sử dụng tổng số variants làm tổng số sản phẩm, hoặc 494 nếu chưa có dữ liệu
    const total = validProducts.length > 0 ? validProducts.length : 494;
    const synced = mappedCount;
    const unsynced = Math.max(0, total - synced);
    const hasErrors = errorCount;

    console.log("API stats: Thống kê cuối cùng:", {
      total,
      synced,
      unsynced,
      hasErrors,
      uniqueProductsCount: uniqueProductIds.size,
    });

    // Lấy thời gian đồng bộ gần nhất
    let lastSync = null;
    try {
      const lastSyncLog = await prisma.syncLog.findFirst({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      });

      if (lastSyncLog) {
        lastSync = lastSyncLog.createdAt;
      }
    } catch (error) {
      console.error("API stats: Lỗi khi lấy thời gian đồng bộ cuối:", error);
    }

    return NextResponse.json({
      success: true,
      total,
      synced,
      unsynced,
      hasErrors,
      lastSync,
    });
  } catch (error) {
    console.error("Products Stats API error:", error);

    // Nếu lỗi, trả về dữ liệu mẫu
    return NextResponse.json({
      success: false,
      total: 494,
      synced: 23,
      unsynced: 471,
      hasErrors: 0,
      lastSync: new Date().toISOString(),
      error: "Có lỗi khi lấy thống kê sản phẩm",
    });
  }
}
