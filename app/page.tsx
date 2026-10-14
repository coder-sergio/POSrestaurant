import { redirect } from "next/navigation";
import { user } from "@/lib/auth";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await user();
  if (!actor) redirect("/login");
  return <Workspace actor={{ ...actor }} />;
}
