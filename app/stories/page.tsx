import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
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
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Story bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your real experiences, polished into STAR answers. In behavioral
            interviews the agent references these and probes them — so practice
            feels like the real thing.
          </p>
        </div>
        <StoryManager initial={stories ?? []} />
      </main>
    </>
  );
}
