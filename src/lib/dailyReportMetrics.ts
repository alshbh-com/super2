export interface DeliveryRate {
  office_id: string | null;
  governorate: string;
  price: number | string;
}

export interface ReportOrder {
  delivery_price?: number | string | null;
  office_id?: string | null;
  governorate?: string | null;
  courier_id?: string | null;
  status_id?: string | null;
}

export function getReportShipping(order: ReportOrder, rates: DeliveryRate[]): number {
  const recorded = Number(order.delivery_price || 0);
  if (recorded > 0) return recorded;
  const governorate = (order.governorate || '').trim();
  if (!governorate) return 0;

  const officeRate = rates.find(rate =>
    rate.office_id === order.office_id && rate.governorate.trim() === governorate,
  );
  if (officeRate) return Number(officeRate.price || 0);

  const generalRate = rates.find(rate =>
    rate.office_id === null && rate.governorate.trim() === governorate,
  );
  return Number(generalRate?.price || 0);
}

export function getReportCourierCommission(
  order: ReportOrder,
  commission: number,
  commissionableStatusIds: string[],
): number {
  if (!order.status_id || !commissionableStatusIds.includes(order.status_id)) return 0;
  return order.courier_id ? commission : 40;
}

export function isReminderDue(receivedAt: string | null | undefined, now: number, hours = 48): boolean {
  if (!receivedAt) return false;
  const receivedTime = new Date(`${receivedAt.slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(receivedTime) && now - receivedTime >= hours * 60 * 60 * 1000;
}