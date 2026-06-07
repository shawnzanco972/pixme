import { B2bPurchase } from "@/components/b2b/B2bPurchase";

export const metadata = {
  title: "פסיפסים לעסקים — Pixme",
};

export default function B2bPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-12">
      <B2bPurchase />
    </main>
  );
}
