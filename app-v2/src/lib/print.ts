/**
 * چاپ تمیز سند: فقط محتوای #print-root در یک پنجره مستقل چاپ می‌شود.
 * این کار از چاپ شدن رابط برنامه (منو، کارت‌ها و دکمه‌ها) جلوگیری می‌کند
 * و خروجی چندصفحه‌ای ناخواسته را از بین می‌برد.
 */
export function printDocumentSheet(title: string): boolean {
  const root = document.getElementById("print-root");
  if (!root) {
    window.print();
    return false;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");

  const sheet = root.innerHTML;
  const printWindow = window.open("", "_blank", "width=920,height=1200");
  if (!printWindow) {
    // مرورگر پنجره جدید را بست؛ چاپ در همین صفحه به‌عنوان جایگزین انجام می‌شود.
    window.print();
    return false;
  }

  printWindow.document.write(`<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/[<>&"]/g, "")}</title>
${styles}
<style>
  @page { size: A4; margin: 10mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  body { padding: 0 !important; }
  .print-sheet {
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .print-sheet table { page-break-inside: auto; }
  .print-sheet tr { page-break-inside: avoid; }
  .print-sheet section { page-break-inside: avoid; }
  .no-print { display: none !important; }
</style>
</head>
<body>${sheet}</body>
</html>`);
  printWindow.document.close();

  const trigger = () => {
    printWindow.focus();
    printWindow.print();
  };

  // صبر کوتاه برای بارگذاری فونت و تصویر QR
  window.setTimeout(trigger, 700);
  return true;
}
