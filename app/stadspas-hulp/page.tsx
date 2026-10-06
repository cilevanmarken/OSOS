import Link from "next/link";

export const metadata = { title: "Spiekbriefje · Scant de stadspas niet?" };

export default function StadspasHulpPage() {
  return (
    <main className="flex-1 flex flex-col px-5 pt-6 pb-10">
      <header className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="text-brand-blue font-semibold py-2 -ml-2 pl-2"
        >
          ← Terug
        </Link>
        <h1 className="font-bold text-lg">Spiekbriefje</h1>
        <span className="w-12" />
      </header>

      <p className="text-gray-500 text-sm mb-5">
        Scant de stadspas niet? Loop deze stappen even langs.
      </p>

      <div className="space-y-4">
        <section className="card">
          <p className="text-sm uppercase tracking-wide text-brand-blue font-semibold">
            Stap 1
          </p>
          <h2 className="font-bold text-lg mb-1">Zoek op naam</h2>
          <p className="text-gray-900">
            Tik de naam in via &ldquo;Zoek op naam&rdquo;. Soms staat de klant
            er wel in en wil de pas alleen niet scannen.
          </p>
        </section>

        <section className="card">
          <p className="text-sm uppercase tracking-wide text-brand-blue font-semibold">
            Stap 2
          </p>
          <h2 className="font-bold text-lg mb-1">Vraag het even</h2>
          <p className="text-gray-900 italic">
            &ldquo;Kom je hier vaker, of is het de eerste keer?&rdquo;
          </p>
          <p className="text-gray-900 mt-1">
            Herken je iemand? Vraag het dan toch, en kijk eerst in de Excel.
          </p>
        </section>

        <section className="card">
          <p className="text-sm uppercase tracking-wide text-brand-blue font-semibold">
            Stap 3
          </p>
          <h2 className="font-bold text-lg mb-1">Check de Excel</h2>
          <p className="text-gray-900">
            <span className="font-semibold">Staat de klant erin?</span> Dan is
            er waarschijnlijk per ongeluk een naam of cijfer gewijzigd of
            verwijderd. Kijk welke gegevens ontbreken en waarom de pas niet werd
            herkend.
          </p>
          <p className="text-gray-900 mt-2">
            <span className="font-semibold">Staat de klant er niet in?</span>{" "}
            Dan is het een nieuwe klant.
          </p>
        </section>

        <section className="card">
          <h2 className="font-bold text-lg mb-1">Eerste keer hier?</h2>
          <p className="text-gray-900">
            Neem de tijd om de winkel uit te leggen en geef een welkomstbrief
            mee.
          </p>
        </section>

        <section className="card">
          <h2 className="font-bold text-lg mb-1">Niet gelukt of twijfel?</h2>
          <p className="text-gray-900">
            Vraag de coördinator om even in de Excel te kijken.
          </p>
        </section>

        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
          <p className="text-sm uppercase tracking-wide text-amber-700 font-semibold">
            Let op
          </p>
          <p className="text-gray-900 mt-1">
            Zo voorkomen we dat iemand dubbel in het systeem komt.
          </p>
        </div>
      </div>

      <Link href="/search" className="btn-ghost w-full mt-6">
        Zoek op naam
      </Link>
    </main>
  );
}
