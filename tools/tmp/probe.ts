import { formatAmount, formatAmountInput, formatTomanAmount } from "../../app-v2/src/lib/money-format";
import { PRODUCTS, searchProducts, productsByCategory, findProductName } from "../../app-v2/src/lib/products";
import { computeQuickSale, quickSaleSummary } from "../../app-v2/src/lib/quick-sale";
import { parseNumericInput } from "../../app-v2/src/lib/units";

console.log("== formatAmountInput ==");
for (const v of ["100000000", "۱۰۰۰۰۰۰۰۰", "١٠٠٠٠٠٠٠٠", "100,000,000", "۱۰۰٬۰۰۰٬۰۰۰", "45,000", "1000", "0", "", "abc", "-2500", "12x3"]) {
  console.log(JSON.stringify(v), "=>", JSON.stringify(formatAmountInput(v)));
}
console.log("== formatAmount ==", [100000000, 45_000, 1_500_000.5, -2500].map((n) => `${n}→${formatAmount(n)}`).join(" | "));
console.log("== toman ==", formatTomanAmount(100000000), "|", formatTomanAmount(45000), "|", formatTomanAmount(1_234_567_890));
console.log("== roundtrip ==", formatAmountInput("۱۰۰٬۰۰۰٬۰۰۰"), "→ parse", parseNumericInput(formatAmountInput("۱۰۰٬۰۰۰٬۰۰۰")));
console.log("== products ==", PRODUCTS.length, "in", productsByCategory().length, "categories:", productsByCategory().map((g) => `${g.category}:${g.items.length}`).join(" "));
console.log("== search ==");
for (const q of ["آفتابگردان", "افتوگردان", "sunflower", "گندم", "گندن", "خیار", "زعفران", "پسته", "برنج", "شالی", "سیب زمینی"]) {
  console.log(JSON.stringify(q), "→", searchProducts(q, 3).map((p) => p.name).join(", ") || "(خالی)");
}
console.log("== findProductName ==", findProductName("تخم آفتابگردان"), "|", findProductName("برنج"));
const r = computeQuickSale({ product: "تخم آفتابگردان", buyer: "شرکت دانه طلایی", unit: "ton", quantity: 2.5, pricePerKg: parseNumericInput(formatAmountInput("45,000")), priceUnit: "kg" });
if (r.ok) { console.log(quickSaleSummary(r).split("\n").slice(0, 6).join("\n")); console.log("payable", formatTomanAmount(r.payableToman)); }
