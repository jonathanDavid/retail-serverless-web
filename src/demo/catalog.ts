/**
 * Static seed data for the demo world: Barranquilla-flavored stores with map
 * coordinates (km; the customer sits at the origin), and a Colombian grocery
 * catalog with base prices in integer COP cents. The inventory generator
 * jitters prices and rolls stock per store from a seed.
 */

export interface StoreDef {
  id: string;
  name: string;
  /** Map position in km relative to the customer at (0, 0). */
  x: number;
  y: number;
  neighborhood: string;
}

export type Category =
  | 'Granos y despensa'
  | 'Lácteos y huevos'
  | 'Frutas y verduras'
  | 'Proteínas'
  | 'Bebidas';

export interface ProductDef {
  sku: string;
  name: string;
  category: Category;
  /** Reference price in COP cents; per-store prices jitter around this. */
  basePriceCents: number;
}

export const DEMO_STORES: readonly StoreDef[] = [
  { id: 'mercado-norte', name: 'Mercado Norte', x: 1.8, y: 2.4, neighborhood: 'Alto Prado' },
  { id: 'supercosta-riomar', name: 'SuperCosta Riomar', x: 4.1, y: 1.2, neighborhood: 'Riomar' },
  { id: 'tienda-el-prado', name: 'Tienda El Prado', x: -1.2, y: 1.6, neighborhood: 'El Prado' },
  { id: 'almacen-la-arenosa', name: 'Almacén La Arenosa', x: -2.9, y: -1.8, neighborhood: 'Centro' },
  { id: 'mercado-del-rio', name: 'Mercado del Río', x: 2.6, y: -2.2, neighborhood: 'Barranquillita' },
] as const;

export const DEMO_PRODUCTS: readonly ProductDef[] = [
  { sku: 'SKU-ARROZ-500', name: 'Arroz blanco 500g', category: 'Granos y despensa', basePriceCents: 380000 },
  { sku: 'SKU-CAFE-250', name: 'Café tostado 250g', category: 'Granos y despensa', basePriceCents: 1450000 },
  { sku: 'SKU-PANELA-1U', name: 'Panela redonda', category: 'Granos y despensa', basePriceCents: 420000 },
  { sku: 'SKU-AZUCAR-1K', name: 'Azúcar blanca 1kg', category: 'Granos y despensa', basePriceCents: 520000 },
  { sku: 'SKU-PASTA-500', name: 'Pasta espagueti 500g', category: 'Granos y despensa', basePriceCents: 460000 },
  { sku: 'SKU-ACEITE-900', name: 'Aceite de girasol 900ml', category: 'Granos y despensa', basePriceCents: 1580000 },
  { sku: 'SKU-CHOC-250', name: 'Chocolate de mesa 250g', category: 'Granos y despensa', basePriceCents: 890000 },
  { sku: 'SKU-LECHE-1L', name: 'Leche entera 1L', category: 'Lácteos y huevos', basePriceCents: 480000 },
  { sku: 'SKU-QUESO-400', name: 'Queso costeño 400g', category: 'Lácteos y huevos', basePriceCents: 1650000 },
  { sku: 'SKU-SUERO-200', name: 'Suero costeño 200g', category: 'Lácteos y huevos', basePriceCents: 620000 },
  { sku: 'SKU-HUEVOS-30', name: 'Huevos AA x30', category: 'Lácteos y huevos', basePriceCents: 1980000 },
  { sku: 'SKU-PLATANO-KG', name: 'Plátano verde x kg', category: 'Frutas y verduras', basePriceCents: 350000 },
  { sku: 'SKU-YUCA-KG', name: 'Yuca fresca x kg', category: 'Frutas y verduras', basePriceCents: 290000 },
  { sku: 'SKU-TOMATE-KG', name: 'Tomate chonto x kg', category: 'Frutas y verduras', basePriceCents: 540000 },
  { sku: 'SKU-ATUN-170', name: 'Atún en lata 170g', category: 'Proteínas', basePriceCents: 780000 },
  { sku: 'SKU-POLLO-KG', name: 'Pechuga de pollo x kg', category: 'Proteínas', basePriceCents: 1720000 },
  { sku: 'SKU-GASEOSA-15', name: 'Gaseosa cola 1.5L', category: 'Bebidas', basePriceCents: 650000 },
  { sku: 'SKU-JUGO-1L', name: 'Jugo de mango 1L', category: 'Bebidas', basePriceCents: 720000 },
] as const;

export const CATEGORIES: readonly Category[] = [
  'Granos y despensa',
  'Lácteos y huevos',
  'Frutas y verduras',
  'Proteínas',
  'Bebidas',
];

/** Urban travel speed used for pickup-route time estimates (km/h). */
export const URBAN_SPEED_KMH = 30;
