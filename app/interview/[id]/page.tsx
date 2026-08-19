import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { InterviewRoom } from "@/components/interview/InterviewRoom";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, status, role_track, round_type, difficulty, persona")
    .eq("id", id)
    .maybeSingle();
  if (!interview) redirect("/dashboard");

  // A finished interview goes straight to its report.
  const { data: report } = await supabase
    .from("reports")
    .select("interview_id")
    .eq("interview_id", id)
    .maybeSingle();
  if (report) redirect(`/report/${id}`);

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text")
    .eq("interview_id", id)
    .order("idx", { ascending: true });

  const persona = (interview.persona ?? {}) as {
    interviewer_name?: string;
    question_count?: number;
    currency?: string;
  };

  return (
    <>
      <AppNav />
      <InterviewRoom
        interviewId={interview.id}
        initialTurns={(turns ?? []) as { speaker: "ai" | "user"; text: string }[]}
        initialStatus={interview.status}
        roleTrack={interview.role_track}
        roundType={interview.round_type}
        difficulty={interview.difficulty}
        questionCount={persona.question_count ?? 6}
        currency={persona.currency}
      />
    </>
  );
}
