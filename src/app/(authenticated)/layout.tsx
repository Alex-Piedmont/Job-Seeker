import { Providers } from "@/components/providers";
import { NavBar } from "@/components/nav-bar";
import { KofiButton } from "@/components/kofi-button";
import { FeedbackButton } from "@/components/feedback-dialog";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <FeedbackButton />
      <KofiButton />
    </Providers>
  );
}
