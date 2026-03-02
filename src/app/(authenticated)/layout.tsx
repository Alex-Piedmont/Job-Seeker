import { Providers } from "@/components/providers";
import { NavBar } from "@/components/nav-bar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </Providers>
  );
}
