import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center"
    >
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/applications" className="mt-4">
        <Button>Go to Board</Button>
      </Link>
    </div>
  );
}
