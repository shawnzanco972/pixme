/**
 * Admin dashboard shell — wraps every /admin route in the persistent sidebar.
 *
 * When there's no session (e.g. the /admin/login page) it renders children bare
 * so the login screen isn't framed by the dashboard chrome. Each page still
 * guards itself (redirect to /admin/login), so this layout only decides whether
 * to show the shell — it never grants access.
 */
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
      <AdminSidebar email={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
