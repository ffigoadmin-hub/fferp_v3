// ─────────────────────────────────────────────────────────────
//  Shared mock customer/sales orders
//  Used by SalesDashboard and AutoPOPage
// ─────────────────────────────────────────────────────────────

export interface SalesOrderProduct {
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export interface MockSalesOrder {
  id: string;
  shopName: string;
  customerName: string;
  address: string;
  phone: string;
  products: SalesOrderProduct[];
  orderDate: string;
  deliveryDate: string;
  status: string;
  createdBy: string;
}

export const MOCK_SALES_ORDERS: MockSalesOrder[] = [
  {
    id: 'ORD001', shopName: 'Fresh Mart', customerName: 'Suresh Kumar',
    address: '45, Anna Nagar, Chennai', phone: '9444123456', createdBy: 'Arjun (Sales)',
    products: [{ name: 'Onion', qty: 5, unit: 'kg', price: 25 }, { name: 'Tomato', qty: 3, unit: 'kg', price: 40 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-19', status: 'confirmed',
  },
  {
    id: 'ORD002', shopName: 'Daily Needs', customerName: 'Priya S',
    address: '12, T Nagar, Chennai', phone: '9555234567', createdBy: 'Meena (Sales)',
    products: [{ name: 'Onion', qty: 8, unit: 'kg', price: 26 }, { name: 'Potato', qty: 5, unit: 'kg', price: 30 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-19', status: 'confirmed',
  },
  {
    id: 'ORD003', shopName: 'Green Grocers', customerName: 'Rajan M',
    address: '78, Velachery, Chennai', phone: '9666345678', createdBy: 'Arjun (Sales)',
    products: [{ name: 'Onion', qty: 10, unit: 'kg', price: 25 }, { name: 'Carrot', qty: 4, unit: 'kg', price: 35 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-20', status: 'confirmed',
  },
  {
    id: 'ORD004', shopName: 'Star Veggie', customerName: 'Kalpana R',
    address: '23, Adyar, Chennai', phone: '9777456789', createdBy: 'Raj (Sales)',
    products: [{ name: 'Tomato', qty: 6, unit: 'kg', price: 40 }, { name: 'Onion', qty: 4, unit: 'kg', price: 25 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-19', status: 'confirmed',
  },
  {
    id: 'ORD005', shopName: 'Healthy Hub', customerName: 'Vikram B',
    address: '56, Porur, Chennai', phone: '9888567890', createdBy: 'Meena (Sales)',
    products: [{ name: 'Potato', qty: 8, unit: 'kg', price: 30 }, { name: 'Onion', qty: 5, unit: 'kg', price: 26 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-20', status: 'pending',
  },
  {
    id: 'ORD006', shopName: 'Farm Fresh', customerName: 'Deepa L',
    address: '89, Tambaram, Chennai', phone: '9999678901', createdBy: 'Raj (Sales)',
    products: [{ name: 'Carrot', qty: 6, unit: 'kg', price: 35 }, { name: 'Tomato', qty: 5, unit: 'kg', price: 42 }],
    orderDate: '2026-05-18', deliveryDate: '2026-05-19', status: 'confirmed',
  },
  {
    id: 'ORD007', shopName: "Nature's Best", customerName: 'Arun K',
    address: '34, Kodambakkam, Chennai', phone: '9111789012', createdBy: 'Arjun (Sales)',
    products: [{ name: 'Onion', qty: 12, unit: 'kg', price: 24 }, { name: 'Potato', qty: 6, unit: 'kg', price: 31 }],
    orderDate: '2026-05-17', deliveryDate: '2026-05-18', status: 'dispatched',
  },
  {
    id: 'ORD008', shopName: 'Quick Shop', customerName: 'Meena T',
    address: '67, Guindy, Chennai', phone: '9222890123', createdBy: 'Meena (Sales)',
    products: [{ name: 'Tomato', qty: 4, unit: 'kg', price: 41 }, { name: 'Carrot', qty: 3, unit: 'kg', price: 36 }],
    orderDate: '2026-05-17', deliveryDate: '2026-05-18', status: 'delivered',
  },
  {
    id: 'ORD009', shopName: 'Veg Palace', customerName: 'Senthil V',
    address: '90, Sholinganallur, Chennai', phone: '9333901234', createdBy: 'Raj (Sales)',
    products: [{ name: 'Cabbage', qty: 10, unit: 'kg', price: 20 }, { name: 'Onion', qty: 6, unit: 'kg', price: 25 }],
    orderDate: '2026-05-17', deliveryDate: '2026-05-19', status: 'confirmed',
  },
  {
    id: 'ORD010', shopName: 'Green Basket', customerName: 'Kavitha M',
    address: '45, Perambur, Chennai', phone: '9444012345', createdBy: 'Arjun (Sales)',
    products: [{ name: 'Beetroot', qty: 4, unit: 'kg', price: 28 }, { name: 'Carrot', qty: 5, unit: 'kg', price: 34 }],
    orderDate: '2026-05-17', deliveryDate: '2026-05-18', status: 'confirmed',
  },
];

// ─── Aggregation helper ───────────────────────────────────────
export interface AggregatedItem {
  productName: string;
  totalQty: number;
  unit: string;
  avgPrice: number;
  totalValue: number;
  orderCount: number;
}

export function aggregateSalesOrders(orders: MockSalesOrder[]): AggregatedItem[] {
  const map = new Map<string, { qty: number; prices: number[]; orderIds: Set<string>; unit: string }>();

  for (const order of orders) {
    for (const p of order.products) {
      const existing = map.get(p.name);
      if (existing) {
        existing.qty += p.qty;
        existing.prices.push(p.price);
        existing.orderIds.add(order.id);
      } else {
        map.set(p.name, { qty: p.qty, prices: [p.price], orderIds: new Set([order.id]), unit: p.unit });
      }
    }
  }

  return Array.from(map.entries()).map(([name, data]) => {
    const avgPrice = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
    return {
      productName: name,
      totalQty: data.qty,
      unit: data.unit,
      avgPrice: Math.round(avgPrice * 10) / 10,
      totalValue: Math.round(data.qty * avgPrice),
      orderCount: data.orderIds.size,
    };
  });
}
