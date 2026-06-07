import { Studio } from "@/components/b2c/Studio";

export const metadata = {
  title: "צרו פסיפס — Pixme",
};

export default function CreatePage() {
  return (
    <main className="flex flex-1 flex-col py-8">
      <Studio />
    </main>
  );
}
