# خطة التنفيذ الشاملة

## 1) حقل "الإجمالي" في إدخال/عرض الأوردر
- في `AddOrderDialog.tsx`: إضافة خانة **الإجمالي** للقراءة فقط = `(price || 0) + (delivery_price || 0)`.
- لو `price` فارغ → الإجمالي = `delivery_price`.
- لو `delivery_price` فارغ → يعرض "شحن مجاني" والإجمالي = `price`.
- إضافة Helper `computeOrderTotal(order)` في `src/lib/utils.ts` يستخدم في كل العمليات الحسابية.

## 2) شريط أعمدة موحّد لصفحات (Orders / ClosedOrders / GeneralSheet)
الأعمدة:
الباركود — كود الراسل — اسم الراسل (المكتب) — اسم العميل — العنوان — الهاتف — السعر — الشحن — **الإجمالي** — المندوب — تاريخ استلام المندوب — الحالة — تاريخ التحصيل (مندوب) — تاريخ المرتجع (مندوب) — تاريخ التحصيل (راسل) — تاريخ المرتجع (راسل).

## 3) قسم تحصيلات التاجر (`MerchantCollections.tsx`) — أهم تعديل
استبدال منطق `computeNet` بمنطق ذكي حسب اسم الحالة:

| الحالة | المحصَّل من العميل (gross) |
|---|---|
| تم التسليم / تسليم كامل | `price + delivery_price` |
| تسليم جزئي | `partial_collected_amount` (المخزن) |
| لم يدفع شحن | `price` فقط (شحن = 0) |
| دفع مصاريف شحن / رفض دفع شحن | `delivery_price` المدفوع فقط (price=0) |
| غيرها | 0 |

ثم:
- **عمولة الشركة لكل أوردر**: من `delivery_prices` (سعر المحافظة) أو من `offices.commission` لو المكتب له سعر خاص.
- **تعويض الشحن**: من `delivery_prices.return_compensation` (جديد) للأوردرات بحالة "رفض دفع شحن/لم يدفع".
- الصافي للتاجر = Σ(gross) − Σ(commission_per_order) (مع خصم تعويض الشحن للمرفوضة بدل العمولة الكاملة).
- ملخّص يعرض: إجمالي المحصَّل، عدد الأوردرات × العمولة، تعويض الشحن، الصافي.

## 4) أمر عكسي في الشيت العمومي
في `GeneralSheet.tsx`، عند تحديد أوردر له `sender_return_received_at` → يظهر زر **"إلغاء تاريخ المرتجع للراسل"** ينظّف الحقل. نفس الشيء لـ `sender_collected_at` → **"إلغاء تاريخ التحصيل للراسل"**. الأمران يظهران معاً (لأن جزئي يأخذ الاثنين).

## 5) تعدد الاختيار في كل الفلاتر
- **التواريخ**: `MultiDateFilter` موجود — ينطبق على بقية الصفحات (Orders/ClosedOrders).
- **المناديب/المكاتب/الحالات**: مكون جديد `MultiSearchableSelect` يدعم اختيار متعدد + بحث. يُطبَّق في كل صفحات الفلاتر.

## 6) فلاتر الشيت العمومي
- إضافة `MultiDateFilter` لـ **تاريخ تحصيل التاجر** و **تاريخ مرتجع التاجر**.
- خيار **"بدون تاريخ"** داخل كل فلتر لإظهار الأوردرات الفارغة.

## 7) تعديل حالة الأوردر من الشيت العمومي
- زر تعديل في كل صف → Dialog فيه `SearchableSelect` للحالات.
- لو الحالة الجديدة = "تسليم جزئي" → سؤال عن `partial_collected_amount`.
- لو "دفع مصاريف شحن" → سؤال عن قيمة الشحن المدفوع (تحفظ في `shipping_paid` أو `partial_collected_amount`).
- تحديث `status_id` + الحقل المناسب.

## 8) قسم أسعار التوصيل (`DeliveryPrices.tsx`)
إصلاحات:
- جعل اختيار المكتب **اختياري** (null = سعر عام لكل المكاتب اللي مالهاش سعر خاص).
- إصلاح bug زر التنفيذ (التحقق من الحقول).
- منطق lookup: للأوردر بمحافظة X ومكتب Y → ابحث (governorate=X, office=Y); لو مفيش → (governorate=X, office=null).
- **إضافة حقل `return_compensation`** على `delivery_prices` (تعويض شحن المرتجع لكل محافظة).
- في `AddOrderDialog`: حقل **المحافظة** يصبح إجباري (Select من قائمة المحافظات الموجودة في `delivery_prices`).
- ربط: عند `sender_collected_at` يُحسب العمولة من delivery_prices حسب governorate+office. هذا منطق العرض في MerchantCollections (نقطة 3).

## 9) لوحة التحكم (`Dashboard.tsx`)
4 بطاقات تساوي الإجمالي الداخل:
- **منفّذ**: عدد الأوردرات بحالة "تم التسليم" أو "تسليم جزئي".
- **مرتجع**: عدد الأوردرات بحالة "مرتجع" / "رفض".
- **قيد التنفيذ**: مُعيَّن لمندوب ولسه مش متقفل.
- **لم يُعيَّن**: `courier_id IS NULL`.

---

## ترتيب التنفيذ الفني
1. **Migration**: إضافة `return_compensation NUMERIC` على `delivery_prices`، وعمود `partial_collected_amount` على `orders` لو غير موجود.
2. `src/lib/utils.ts`: helper `computeOrderTotal`, `computeCollectedFromCustomer(order, statusName)`.
3. `src/components/MultiSearchableSelect.tsx`: مكون جديد.
4. تعديل `AddOrderDialog.tsx` — حقل الإجمالي، حقل المحافظة إجباري.
5. تعديل `DeliveryPrices.tsx` — اختيار المكتب اختياري + حقل تعويض شحن + إصلاح الـbug.
6. توحيد الأعمدة في `Orders.tsx` / `ClosedOrders.tsx` / `GeneralSheet.tsx`.
7. إعادة كتابة `MerchantCollections.tsx` بالمنطق الذكي.
8. إضافة الأوامر العكسية + تعديل الحالة + الفلاتر الجديدة في `GeneralSheet.tsx`.
9. تعديل `Dashboard.tsx` ببطاقات الحالة الأربعة.

> سأبدأ بالتنفيذ بالكامل دفعة واحدة كما طلبت.
