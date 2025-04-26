import { PrismaClient } from '@prisma/client';
// Replace the import with local implementation
// import { sleep } from './syncService';

// Initialize Prisma Client
const prisma = new PrismaClient();

/**
 * Helper function to sleep/wait for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Interface for Shopify API settings
 */
export interface ShopifyApiSettings {
  shopify_shop_domain: string;
  shopify_access_token: string;
  [key: string]: string;
}

/**
 * Call the Shopify API with rate limiting
 */
export async function callShopifyAPI(endpoint: string, method: string = 'GET', data: any = null, settings: ShopifyApiSettings): Promise<any> {
  const SHOPIFY_DOMAIN = settings.shopify_shop_domain;
  const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN || ''
    }
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    // Check for rate limiting and wait if needed
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      console.log(`[Shopify API] Rate limited. Waiting for ${retryAfter} seconds.`);
      await sleep(retryAfter * 1000);
      return callShopifyAPI(endpoint, method, data, settings);
    }

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    // Some endpoints return empty response for successful operations
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { success: true };
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[Shopify API] Error calling ${method} ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Get a product from Shopify by ID
 */
export async function getShopifyProduct(productId: string, settings: ShopifyApiSettings): Promise<any> {
  try {
    const result = await callShopifyAPI(`products/${productId}.json`, 'GET', null, settings);
    return result.product;
  } catch (error) {
    console.error(`[Shopify API] Error fetching product ${productId}:`, error);
    return null;
  }
}

/**
 * Get product variants from Shopify
 */
export async function getShopifyVariants(productId: string, settings: ShopifyApiSettings): Promise<any[]> {
  try {
    const result = await callShopifyAPI(`products/${productId}/variants.json`, 'GET', null, settings);
    return result.variants || [];
  } catch (error) {
    console.error(`[Shopify API] Error fetching variants for product ${productId}:`, error);
    return [];
  }
}

/**
 * Update inventory level in Shopify
 */
export async function updateInventoryLevel(
  inventoryItemId: string, 
  locationId: string, 
  quantity: number,
  settings: ShopifyApiSettings
): Promise<any> {
  try {
    const data = {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity
    };
    
    const result = await callShopifyAPI('inventory_levels/set.json', 'POST', data, settings);
    return result.inventory_level;
  } catch (error) {
    console.error(`[Shopify API] Error updating inventory level for item ${inventoryItemId}:`, error);
    return null;
  }
}

/**
 * Update product variant in Shopify
 */
export async function updateVariant(
  variantId: string, 
  updateData: any,
  settings: ShopifyApiSettings
): Promise<any> {
  try {
    const data = {
      variant: updateData
    };
    
    const result = await callShopifyAPI(`variants/${variantId}.json`, 'PUT', data, settings);
    return result.variant;
  } catch (error) {
    console.error(`[Shopify API] Error updating variant ${variantId}:`, error);
    return null;
  }
}

/**
 * Get Shopify locations
 */
export async function getShopifyLocations(settings: ShopifyApiSettings): Promise<any[]> {
  try {
    const result = await callShopifyAPI('locations.json', 'GET', null, settings);
    return result.locations || [];
  } catch (error) {
    console.error(`[Shopify API] Error fetching locations:`, error);
    return [];
  }
}

/**
 * Get Shopify API settings from database
 */
export async function getShopifyApiSettings(): Promise<ShopifyApiSettings> {
  try {
    const settings = await prisma.setting.findMany();
    
    // Convert array of settings to object
    const settingsObj = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    
    // Check for required settings
    if (!settingsObj.shopify_access_token || !settingsObj.shopify_shop_domain) {
      console.error(`[Shopify API] Missing required settings for Shopify API`);
    }
    
    return settingsObj as ShopifyApiSettings;
  } catch (error: any) {
    console.error(`[Shopify API] Error fetching settings:`, error.message);
    return {
      shopify_shop_domain: '',
      shopify_access_token: ''
    };
  }
} 