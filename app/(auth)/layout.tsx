import { Marca } from "@/app/components/Marca";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Sin esto, quien entra a /login desde un enlace directo queda
          encerrado: no hay forma de llegar a la portada ni a los precios. */}
      <header className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
        <Marca />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
