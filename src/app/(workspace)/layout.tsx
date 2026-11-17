import { Sidebar } from "@/components/layout/sidebar";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
