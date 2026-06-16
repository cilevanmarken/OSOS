import Image from "next/image";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col px-5 pt-10 pb-8">
      <header className="mb-10">
        <Image
          src="/logo.png"
          alt="De Omgekeerde Supermarkt"
          width={575}
          height={87}
          priority
          className="w-full h-auto"
        />
      </header>

      <div className="flex-1 flex flex-col justify-center gap-6">
        <Link href="/scan" className="btn-primary py-8 text-2xl w-full">
          Scan stadspas
        </Link>

        <Link href="/search" className="btn-ghost w-full">
          Zoek op naam
        </Link>
      </div>

      <footer className="mt-10 text-center text-xs text-gray-400">
        Vrijwilligers-app · Week {currentWeekString()} · <LogoutButton />
      </footer>
    </main>
  );
}

function currentWeekString(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return String(week);
}
