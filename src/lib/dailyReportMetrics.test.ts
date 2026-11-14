import { describe, expect, it } from 'vitest';
import { getReportCourierCommission, getReportShipping, isReminderDue } from './dailyReportMetrics';

describe('daily report shipping and courier amounts', () => {
  it('uses the office shipping price when the order has no recorded shipping price', () => {
    const order = { delivery_price: 0, office_id: 'office-1', governorate: 'Cairo' };
    const rates = [
      { office_id: 'office-1', governorate: 'Cairo', price: 65 },
      { office_id: null, governorate: 'Cairo', price: 80 },
    ];
    expect(getReportShipping(order, rates)).toBe(65);
  });

  it('falls back to the general shipping price when no office price exists', () => {
    const order = { delivery_price: 0, office_id: 'office-2', governorate: 'Cairo' };
    expect(getReportShipping(order, [{ office_id: null, governorate: 'Cairo', price: 80 }])).toBe(80);
  });

  it('deducts the fixed 40-pound commission when a commissionable order has no courier', () => {
    const order = { status_id: 'delivered', courier_id: null };
    expect(getReportCourierCommission(order, 25, ['delivered'])).toBe(40);
  });

  it('only reminds once 48 hours have elapsed from the registered order date', () => {
    const now = new Date('2026-11-16T01:00:00').getTime();
    expect(isReminderDue('2026-11-14', now, 48)).toBe(true);
    expect(isReminderDue('2026-11-15', now, 48)).toBe(false);
  });
});