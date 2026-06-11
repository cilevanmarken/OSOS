export default function NoteBanner({ note }: { note: string }) {
  if (!note.trim()) return null;
  return (
    <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5 mb-5">
      <p className="text-sm uppercase tracking-wide text-amber-700 font-semibold">
        Notitie
      </p>
      <p className="text-gray-900 mt-1 whitespace-pre-wrap">{note}</p>
    </div>
  );
}
