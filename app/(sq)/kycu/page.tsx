import { redirect } from "next/navigation";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import KflLoginForm from "@/components/kfl/KflLoginForm";

export const metadata = { title: "Kyçu në KFL | Momenti" };

export default async function KflLoginPage() {
  if (await isKflAuthenticated()) redirect("/kycu/artikuj");
  return <KflLoginForm />;
}
