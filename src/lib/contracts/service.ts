/**
 * سرویس آمار قراردادهای کشاورزی برای داشبورد.
 * همه‌ی اعداد از پایگاه داده خوانده می‌شوند؛ در صورت خالی بودن جدول، صفر برمی‌گردد.
 */
import { db } from "@/db";
import { agriContractPayments, agriContracts } from "@/db/schema";

export interface ContractStats {
  total: number;
  active: number;
  asLessee: number;
  asLessor: number;
  cashIncoming: number;
  cashOutgoing: number;
  overdue: number;
  nextDue: { dueDate: string; amountToman: number } | null;
}

export async function getContractStats(): Promise<ContractStats> {
  const [contracts, payments] = await Promise.all([
    db.select().from(agriContracts),
    db.select().from(agriContractPayments),
  ]);

  const activeContracts = contracts.filter((c) => c.status === "active");
  const rentPayments = payments.filter((p) => p.kind === "rent");
  const idsOf = (perspective: string) =>
    new Set(contracts.filter((c) => c.perspective === perspective).map((c) => c.id));

  const lessorIds = idsOf("lessor");
  const lesseeIds = idsOf("lessee");

  const cashIncoming = rentPayments
    .filter((p) => lessorIds.has(p.contractId))
    .reduce((sum, p) => sum + Number(p.amountToman || 0), 0);
  const cashOutgoing = rentPayments
    .filter((p) => lesseeIds.has(p.contractId))
    .reduce((sum, p) => sum + Number(p.amountToman || 0), 0);

  // معوقه‌ی قراردادهای نقدی که ما مستأجر آن‌ها هستیم: تعهد کل منهای پرداخت‌های ثبت‌شده
  const overdue = activeContracts
    .filter((c) => c.perspective === "lessee" && (c.type === "cash" || c.type === "cash_share"))
    .reduce((sum, c) => {
      const paid = rentPayments
        .filter((p) => p.contractId === c.id)
        .reduce((s, p) => s + Number(p.amountToman || 0), 0);
      return sum + Math.max(0, Number(c.totalRentToman || 0) - paid);
    }, 0);

  return {
    total: contracts.length,
    active: activeContracts.length,
    asLessee: activeContracts.filter((c) => c.perspective === "lessee").length,
    asLessor: activeContracts.filter((c) => c.perspective === "lessor").length,
    cashIncoming,
    cashOutgoing,
    overdue,
    nextDue: null,
  };
}
