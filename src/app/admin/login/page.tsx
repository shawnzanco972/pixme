import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "כניסת מנהל — Pixipic" };

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-16">
      <LoginForm />
    </main>
  );
}
