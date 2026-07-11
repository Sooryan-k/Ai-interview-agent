import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { CodingRoom } from "@/components/interview/CodingRoom";
import { getProblem } from "@/lib/coding";

export default async function CodingPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const problem = getProblem(p);

  return (
    <>
      <AppNav />
      <CodingRoom problem={problem} />
    </>
  );
}
