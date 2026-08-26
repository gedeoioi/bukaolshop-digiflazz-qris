import { prisma } from '../config/database';
import { syncDigiflazzProducts } from '../integrations/digiflazz/service';
import { logger } from '../utils/logger';

export async function getProducts(options?: {
  category?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options?.category) where.category = options.category;
  if (options?.isActive !== undefined) where.isActive = options.isActive;
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search } },
      { sku: { contains: options.search } },
      { brand: { contains: options.search } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, limit };
}

export async function getProductBySku(sku: string) {
  return prisma.product.findFirst({
    where: {
      OR: [{ sku }, { digiflazzSku: sku }],
    },
  });
}

export async function updateProductMarkup(sku: string, markup: number) {
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw new Error('Product not found');

  return prisma.product.update({
    where: { sku },
    data: {
      markup,
      sellingPrice: product.supplierPrice + markup,
    },
  });
}

export async function syncProducts(): Promise<number> {
  try {
    const count = await syncDigiflazzProducts();
    logger.info({ event: 'PRODUCT_SYNC', count }, 'Product sync completed');
    return count;
  } catch (err) {
    logger.error({ err, event: 'PRODUCT_SYNC' }, 'Product sync failed');
    throw err;
  }
}
