const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

// Create Express app
const app = express();
app.use(bodyParser.json());

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3333;
const WEBHOOK_SECRET = process.env.NHANH_WEBHOOK_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Stats for monitoring
const stats = {
  startTime: new Date(),
  webhooksReceived: 0,
  webhooksProcessed: 0,
  errors: 0
};

// Get settings from database
async function getSettings() {
  try {
    const settings = await prisma.setting.findMany();
    return settings.reduce((acc, setting) => {
      try {
        acc[setting.key] = JSON.parse(setting.value);
      } catch (e) {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {};
  }
}

// Verify webhook signature
function verifyWebhookSignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured, skipping signature verification');
    return NODE_ENV === 'production' ? false : true;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

// Create sync log entry
async function createSyncLog(action, status, message, details = null) {
  try {
    return await prisma.syncLog.create({
      data: {
        action,
        status,
        message,
        details: details ? JSON.stringify(details) : null,
        creator: 'webhook-receiver'
      }
    });
  } catch (error) {
    console.error('Error creating sync log:', error);
  }
}

// Import syncInventory function from syncService
const { syncInventory } = require('../../src/lib/syncService');

// Webhook endpoint
app.post('/webhook/inventory', async (req, res) => {
  stats.webhooksReceived++;
  
  // Get signature from headers
  const signature = req.headers['x-nhanh-signature'] || req.headers['x-signature'];
  
  // Verify signature in production
  if (NODE_ENV === 'production' && (!signature || !verifyWebhookSignature(req.body, signature))) {
    stats.errors++;
    console.error('Invalid webhook signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }
  
  try {
    console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Validate webhook data
    if (!req.body.data || !req.body.data.products || !Array.isArray(req.body.data.products)) {
      throw new Error('Invalid webhook payload structure');
    }
    
    const { products } = req.body.data;
    console.log(`Processing ${products.length} products from webhook`);
    
    // Create sync log for this webhook
    const syncLog = await createSyncLog(
      'sync_inventory_webhook', 
      'processing', 
      `Processing inventory webhook with ${products.length} products`,
      { 
        totalProducts: products.length,
        event: req.body.event || 'unknown',
        timestamp: new Date().toISOString()
      }
    );
    
    // Process each product
    const results = {
      totalProducts: products.length,
      processed: 0,
      updated: 0,
      errors: 0,
      details: []
    };
    
    const settings = await getSettings();
    
    for (const product of products) {
      if (!product.idNhanh) {
        results.errors++;
        results.details.push({
          product: product.name || 'Unknown',
          error: 'Missing idNhanh'
        });
        continue;
      }
      
      try {
        // Find product in database
        const dbProduct = await prisma.product.findFirst({
          where: {
            idNhanh: product.idNhanh.toString()
          }
        });
        
        if (!dbProduct) {
          results.errors++;
          results.details.push({
            product: product.name || product.idNhanh,
            error: 'Product not found in database'
          });
          continue;
        }
        
        // Sync inventory using existing syncInventory function
        const syncResult = await syncInventory(
          dbProduct,
          { inventory: product.inventory },
          settings
        );
        
        results.processed++;
        if (syncResult.updated) {
          results.updated++;
        }
        
        results.details.push({
          product: dbProduct.name || dbProduct.idNhanh,
          idNhanh: dbProduct.idNhanh,
          oldInventory: syncResult.oldInventory,
          newInventory: syncResult.newInventory,
          updated: syncResult.updated,
          shopifyProductId: dbProduct.shopifyId
        });
        
      } catch (error) {
        console.error(`Error processing product ${product.idNhanh}:`, error);
        results.errors++;
        results.details.push({
          product: product.name || product.idNhanh,
          error: error.message
        });
      }
    }
    
    // Update sync log with results
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: results.errors === results.totalProducts ? 'failed' : 'completed',
        message: `Processed ${results.processed} products, updated ${results.updated} products, ${results.errors} errors`,
        details: JSON.stringify(results)
      }
    });
    
    stats.webhooksProcessed++;
    
    // Send response
    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} products, updated ${results.updated} products`,
      errors: results.errors
    });
    
  } catch (error) {
    stats.errors++;
    console.error('Error processing webhook:', error);
    
    // Create error log
    await createSyncLog(
      'sync_inventory_webhook',
      'failed',
      `Error processing webhook: ${error.message}`,
      { error: error.message, stack: error.stack }
    );
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  const uptime = Math.floor((new Date() - stats.startTime) / 1000);
  
  res.status(200).json({
    status: 'running',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    webhooksReceived: stats.webhooksReceived,
    webhooksProcessed: stats.webhooksProcessed,
    errors: stats.errors,
    startedAt: stats.startTime
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Nhanh.vn webhook receiver listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/inventory`);
  console.log(`Status URL: http://localhost:${PORT}/status`);
});

// Handle graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Shutting down webhook receiver...');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    console.log('Database connection closed');
    process.exit(0);
  });
} 