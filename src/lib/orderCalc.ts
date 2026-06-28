// Centralized order-amount calculation logic.
// Used by MerchantCollections, Dashboard, ReportButton, etc.

export type StatusName =
  | 'تم التسليم'
  | 'تسليم جزئي'
  | 'استلم ودفع نص الشحن'
  | 'رفض ودفع شحن'
  | 'رفض دفع شحن'
  | 'مرتجع'
  | 'مرتجع لم يدفع شحن'
  | 'ملغي'
  | 'مؤجل'
  | 'مؤجل لخط سير المندوب'
  | 'مؤجل من العميل'
  | 'قيد التوصيل'
  | 'جديد'
  | string;

/** Total declared on the order: price + shipping. */
export function computeOrderTotal(o: { price?: any; delivery_price?: any }): number {
  return Number(o?.price || 0) + Number(o?.delivery_price || 0);
}

/** Money actually collected from the customer for this order, by status. */
export function computeCollectedFromCustomer(
  o: { price?: any; delivery_price?: any; partial_amount?: any; shipping_paid?: any },
  statusName?: StatusName | null,
): number {
  const price = Number(o?.price || 0);
  const shipping = Number(o?.delivery_price || 0);
  const partial = Number(o?.partial_amount || 0);
  const shippingPaid = Number(o?.shipping_paid || 0);

  switch (statusName) {
    case 'تم التسليم':
      return price + shipping;
    case 'تسليم جزئي':
    case 'استلم ودفع نص الشحن':
      // collected partial includes whatever was actually paid (price portion + any shipping)
      return partial > 0 ? partial : price;
    case 'رفض ودفع شحن':
    case 'رفض دفع شحن':
      // customer didn't take the product but paid the shipping (or part of it)
      return shippingPaid > 0 ? shippingPaid : 0;
    case 'مرتجع لم يدفع شحن':
    case 'مرتجع':
    case 'ملغي':
    case 'مؤجل':
    case 'مؤجل لخط سير المندوب':
    case 'مؤجل من العميل':
    case 'قيد التوصيل':
    case 'جديد':
    default:
      return 0;
  }
}

/** Whether this status is considered "delivered" (counts towards collection commission). */
export function isDeliveredStatus(statusName?: string | null): boolean {
  return statusName === 'تم التسليم' || statusName === 'تسليم جزئي' || statusName === 'استلم ودفع نص الشحن';
}

/** Whether this status is a refusal (refund-shipping compensation rule applies). */
export function isRefusalStatus(statusName?: string | null): boolean {
  return statusName === 'رفض ودفع شحن' || statusName === 'رفض دفع شحن' || statusName === 'مرتجع لم يدفع شحن';
}

/** Whether this status is a return-to-sender / cancel / postponed (no money flows). */
export function isReturnStatus(statusName?: string | null): boolean {
  return statusName === 'مرتجع' || statusName === 'ملغي';
}
