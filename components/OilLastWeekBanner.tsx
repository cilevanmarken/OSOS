import { previousIsoWeek } from "@/lib/week";

export default function OilLastWeekBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5 mb-5">
      <p className="text-sm uppercase tracking-wide text-amber-700 font-semibold">
        Let op: olie vorige week
      </p>
      <p className="text-gray-900 mt-1">
        Deze klant heeft vorige week (week {previousIsoWeek()}) olie ontvangen.
      </p>
    </div>
  );
}
