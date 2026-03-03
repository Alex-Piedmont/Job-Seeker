export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="max-w-full -mx-4 px-4">{children}</div>;
}
