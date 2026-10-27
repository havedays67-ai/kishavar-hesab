import { getNotes } from "@/lib/data";
import { AssistantChat } from "@/components/AssistantChat";
import { Card, Icon, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const notes = await getNotes(8);
  return (
    <div className="space-y-4">
      <PageHeader
        title="هوش مصنوعی کشاورزحساب"
        subtitle="دو حالت کاربردی: پشتیبان برای آموزش و گزارش، دستیار برای ثبت اطلاعات با گفتگو."
        icon="sparkles"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="card-pad border-farm-200 bg-farm-50/70">
          <div className="flex items-center gap-2 text-sm font-bold text-farm-900">
            <Icon name="book" className="h-4 w-4" />
            حالت پشتیبان
          </div>
          <p className="mt-1.5 text-[11px] leading-6 text-[#4a5a4c]">
            درباره هر بخش نرم‌افزار و مفاهیم حسابداری کشاورزی آموزش می‌دهد و گزارش لحظه‌ای از داده‌های شما می‌سازد. در این حالت هیچ داده‌ای تغییر نمی‌کند.
          </p>
        </Card>
        <Card className="card-pad border-[#f6e3cf] bg-[#fdf7ef]">
          <div className="flex items-center gap-2 text-sm font-bold text-clay-600">
            <Icon name="sparkles" className="h-4 w-4" />
            حالت دستیار
          </div>
          <p className="mt-1.5 text-[11px] leading-6 text-[#5b6a5e]">
            با زبان ساده بگویید چه کاری انجام دهد: هزینه، درآمد، چک، بدهی، دستمزد، انبار و یادآوری. اگر اطلاعات ناقص باشد سؤال می‌پرسد و قبل از ثبت،
            خلاصه را برای تأیید نشان می‌دهد.
          </p>
        </Card>
      </div>

      <AssistantChat
        initialNotes={notes.map((n) => ({ id: n.id, title: n.title, detail: n.detail, confidence: n.confidence, kind: n.kind }))}
      />

      <Card className="card-pad bg-sand-50">
        <p className="text-[11px] leading-6 text-[#5b6a5e]">
          نمونه دستور برای دستیار: «۲۵ میلیون تومان کود اوره برای زمین شمالی خریدم، نسیه» · «برای فروشگاه نهاده ۴۴ میلیون چک با سررسید ۱۵ آبان بنویس» ·
          «دستمزد حسن برای ۳ روز برداشت را ثبت کن» · «۵۰ کیلو کود از انبار برای کشت گندم کم کن» · «یادم باشه هفته بعد بیمه را تمدید کنم».
        </p>
      </Card>
    </div>
  );
}
