# Hướng dẫn sửa lỗi truy vấn Prisma

## Vấn đề
Hệ thống hiện tại đang gặp lỗi khi tìm kiếm các bản ghi có giá trị NULL trong cơ sở dữ liệu sử dụng Prisma ORM. Cụ thể, các truy vấn sử dụng `status: { in: ['pending', null] }` hoặc cấu trúc OR tương tự không hoạt động đúng với Prisma.

## Giải pháp
Sử dụng truy vấn SQL trực tiếp thông qua `$queryRaw` thay vì sử dụng Prisma Client API. 

## Các vị trí cần sửa trong worker.js:

### 1. Truy vấn tìm kiếm tác vụ đồng bộ (dòng ~190-204)
Thay thế:
```javascript
scheduledTasks = await prisma.syncLog.findMany({
  where: {
    action: { startsWith: 'sync_' },
    status: {
      in: ['pending', null]
    }
  },
  orderBy: {
    createdAt: 'asc'  // Xử lý các tác vụ cũ trước
  },
  take: 5 // Giới hạn 5 tác vụ để tránh quá tải
});
```

Bằng:
```javascript
scheduledTasks = await prisma.$queryRaw`
  SELECT * FROM SyncLog 
  WHERE action LIKE 'sync\\_%' 
  AND (status = 'pending' OR status IS NULL)
  ORDER BY createdAt ASC
  LIMIT 5
`;
```

### 2. Truy vấn tìm kiếm sản phẩm (dòng ~400-416)
Thay thế:
```javascript
products = await prisma.productMapping.findMany({
  where: {
    OR: [
      { status: 'success' },
      { status: 'done' },
      { status: 'pending' },
      { status: null }
    ]
  }
});
```

Bằng:
```javascript
products = await prisma.$queryRaw`
  SELECT * FROM ProductMapping 
  WHERE status = 'success' OR status = 'done' OR status = 'pending' OR status IS NULL
`;
```

## Chú ý
1. Khi sử dụng `$queryRaw`, kết quả trả về có thể khác một chút so với kết quả của `findMany()`. Bạn có thể cần xử lý thêm kết quả trả về.
2. Cú pháp `LIKE 'sync\\_%'` cần escape dấu gạch chéo để khớp với chuỗi bắt đầu bằng "sync_". 