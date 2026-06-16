import Image from "next/image";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-app redirects — never an absolute/external URL.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

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

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="font-bold text-2xl mb-2">Inloggen</h1>
        <p className="text-sm text-gray-500 mb-6">
          Voer het wachtwoord in om de vrijwilligers-app te gebruiken.
        </p>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
