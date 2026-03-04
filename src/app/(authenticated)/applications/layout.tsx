export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-4">
      {children}
    </div>
  );
}
