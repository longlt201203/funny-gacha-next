import { ManageNav } from "./_components/manage-nav";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1e293b_0%,#111827_45%,#09090b_100%)] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <ManageNav />
        {children}
      </div>
    </main>
  );
}
