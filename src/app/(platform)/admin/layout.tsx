import { requirePlatformAdmin } from "@/lib/auth/session";

import { PlatformAdminSidebar } from "./platform-admin-sidebar";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <PlatformAdminSidebar />
      <main className="flex-1 overflow-y-auto bg-neutral-50">
        <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
