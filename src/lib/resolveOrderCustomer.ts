// Website-sourced orders never get a `customers` row linked (no customer_id),
// and the order's own `customer_name`/`customer_phone` columns are left as a
// generic placeholder ("Website Customer") / null by that integration. The
// real name and phone the shopper entered at checkout do exist, but only as
// the first two lines of the free-text `delivery_address` field:
//   "S.senthilkumar\n9087425937\n43/1 Dr.karunanithi street... - 600082"
// This recovers them for display. It never touches the database — it's a
// read-side fallback for pages that show sales_orders without a linked
// customer.
const PLACEHOLDER_NAMES = new Set(['website customer', 'app customer']);
const PHONE_LIKE = /^[\d+\-\s()]{7,}$/;

export interface OrderCustomerFallback {
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
}

export interface ResolvedOrderCustomer {
  name: string;
  phone: string | null;
  address: string | null;
}

export function resolveOrderCustomer(order: OrderCustomerFallback): ResolvedOrderCustomer {
  const rawName = order.customer_name?.trim();
  const isPlaceholder = !rawName || PLACEHOLDER_NAMES.has(rawName.toLowerCase());

  if (!isPlaceholder) {
    return { name: rawName!, phone: order.customer_phone || null, address: order.delivery_address || null };
  }

  const lines = (order.delivery_address || '').split('\n').map(l => l.trim()).filter(Boolean);
  const name = lines[0] || rawName || 'Website Customer';
  const phone = lines[1] && PHONE_LIKE.test(lines[1]) ? lines[1] : (order.customer_phone || null);
  const addressLines = phone && lines[1] === phone ? lines.slice(2) : lines.slice(1);

  return { name, phone, address: addressLines.join(', ') || order.delivery_address || null };
}
