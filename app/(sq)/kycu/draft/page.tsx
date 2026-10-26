import { redirect } from "next/navigation";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import DraftsPage from "./DraftsPage";

export default async function KflDraftsPage() {
  if (!(await isKflAuthenticated())) redirect("/kycu");
  return <DraftsPage />;
}
