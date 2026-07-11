import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { PageShell } from "@/components/PageShell";
import { StoryManager } from "@/components/stories/StoryManager";

export default async function StoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stories } = await supabase
    .from("stories")
    .select("id, title, raw_md, polished_md, tags, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <AppNav />
      <PageShell
        maxWidth="narrow"
        title="Story bank"
        description="Your real experiences, polished into STAR answers. In behavioral interviews the agent references these and probes them — so practice feels like the real thing."
      >
        <StoryManager initial={stories ?? []} />
      </PageShell>
    </>
  );
}
