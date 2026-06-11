import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col px-5 pt-10 pb-8 items-center justify-center text-center">
      <h1 className="text-2xl font-extrabold text-brand-blue mb-2">
        Niet gevonden
      </h1>
      <p className="text-gray-500 mb-6">Deze pagina bestaat niet.</p>
      <Link href="/" className="btn-primary">
        Terug naar start
      </Link>
    </main>
  );
}
