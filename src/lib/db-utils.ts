/**
 * Utility functions for database transactions
 * Triển khai các hàm tiện ích cho transaction database
 */

import { PrismaClient } from "@prisma/client";
import prisma from "./prisma";

/**
 * Cập nhật mapping và tạo log đồng bộ trong một transaction
 * @param productId ID của sản phẩm cần cập nhật
 * @param productData Dữ liệu cập nhật cho sản phẩm
 * @param syncLogData Dữ liệu log đồng bộ
 * @returns Object chứa kết quả cập nhật
 */
export async function updateMappingAndCreateLog(
  productId: number,
  productData: any,
  syncLogData: any
) {
  return await prisma.$transaction(async (tx: PrismaClient) => {
    // Cập nhật thông tin sản phẩm
    const updatedProduct = await tx.productMapping.update({
      where: { id: productId },
      data: productData,
    });

    // Tạo bản ghi đồng bộ
    const syncLog = await tx.syncLog.create({
      data: syncLogData,
    });

    return { updatedProduct, syncLog };
  });
}

/**
 * Đánh dấu sản phẩm lỗi trong một transaction
 * @param productId ID của sản phẩm cần đánh dấu lỗi
 * @param errorMessage Thông báo lỗi
 * @param username Tên người dùng thực hiện
 * @param action Hành động đang thực hiện
 * @returns Object chứa kết quả cập nhật
 */
export async function markProductError(
  productId: number,
  errorMessage: string,
  username: string = "system",
  action: string = "sync_inventory"
) {
  return await prisma.$transaction(async (tx: PrismaClient) => {
    try {
      // Cập nhật trạng thái lỗi cho sản phẩm
      const updatedProduct = await tx.productMapping.update({
        where: { id: productId },
        data: {
          status: "error",
          errorMsg: errorMessage || "Lỗi không xác định",
          updatedAt: new Date(),
        },
      });

      // Tạo bản ghi log lỗi
      const syncLog = await tx.syncLog.create({
        data: {
          productMappingId: productId,
          action: action,
          status: "error",
          message: errorMessage || "Lỗi không xác định",
          details: JSON.stringify({
            error: errorMessage,
            timestamp: new Date().toISOString(),
          }),
          createdBy: username,
        },
      });

      return { updatedProduct, syncLog };
    } catch (error: any) {
      // Rollback tự động khi có lỗi trong transaction
      console.error(`[DB] Lỗi khi đánh dấu sản phẩm lỗi: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Cập nhật trạng thái thành công cho sản phẩm và tạo log trong một transaction
 * @param productId ID của sản phẩm
 * @param details Chi tiết để lưu vào log
 * @param message Thông báo thành công
 * @param username Tên người dùng thực hiện
 * @param action Hành động đang thực hiện
 * @returns Object chứa kết quả cập nhật
 */
export async function markProductSuccess(
  productId: number,
  details: any,
  message: string = "Đồng bộ thành công",
  username: string = "system",
  action: string = "sync_inventory"
) {
  return await prisma.$transaction(async (tx: PrismaClient) => {
    try {
      // Cập nhật trạng thái thành công
      const updatedProduct = await tx.productMapping.update({
        where: { id: productId },
        data: {
          status: "success",
          errorMsg: null,
          updatedAt: new Date(),
        },
      });

      // Tạo bản ghi log thành công
      const syncLog = await tx.syncLog.create({
        data: {
          productMappingId: productId,
          action: action,
          status: "success",
          message: message,
          details: JSON.stringify(details),
          createdBy: username,
        },
      });

      return { updatedProduct, syncLog };
    } catch (error: any) {
      // Rollback tự động khi có lỗi trong transaction
      console.error(
        `[DB] Lỗi khi đánh dấu sản phẩm thành công: ${error.message}`
      );
      throw error;
    }
  });
}

/**
 * Cập nhật trạng thái bỏ qua cho sản phẩm và tạo log trong một transaction
 * @param productId ID của sản phẩm
 * @param details Chi tiết để lưu vào log
 * @param reason Lý do bỏ qua
 * @param username Tên người dùng thực hiện
 * @param action Hành động đang thực hiện
 * @returns Object chứa kết quả cập nhật
 */
export async function markProductSkipped(
  productId: number,
  details: any,
  reason: string = "Không có thay đổi",
  username: string = "system",
  action: string = "sync_inventory"
) {
  return await prisma.$transaction(async (tx: PrismaClient) => {
    try {
      // Cập nhật trạng thái thành công (vì skip vẫn là thành công)
      const updatedProduct = await tx.productMapping.update({
        where: { id: productId },
        data: {
          status: "success",
          errorMsg: null,
          updatedAt: new Date(),
        },
      });

      // Tạo bản ghi log bỏ qua
      const syncLog = await tx.syncLog.create({
        data: {
          productMappingId: productId,
          action: action,
          status: "skipped",
          message: `Bỏ qua đồng bộ: ${reason}`,
          details: JSON.stringify(details),
          createdBy: username,
        },
      });

      return { updatedProduct, syncLog };
    } catch (error: any) {
      // Rollback tự động khi có lỗi trong transaction
      console.error(`[DB] Lỗi khi đánh dấu sản phẩm bỏ qua: ${error.message}`);
      throw error;
    }
  });
}

export default {
  updateMappingAndCreateLog,
  markProductError,
  markProductSuccess,
  markProductSkipped,
};
