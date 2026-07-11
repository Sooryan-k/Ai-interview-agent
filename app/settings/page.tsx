import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { DisplayNameForm } from "@/components/settings/DisplayNameForm";
import { ResumeUpload } from "@/components/settings/ResumeUpload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResumeStructSchema } from "@/lib/schemas";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, resume_struct, resume_text")
    .eq("id", user.id)
    .maybeSingle();

  const parsedStruct = ResumeStructSchema.safeParse(profile?.resume_struct);

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize your prep and export a study plan.
          </p>
        </div>

        <DisplayNameForm initial={profile?.display_name ?? ""} />

        <ResumeUpload
          initialStruct={parsedStruct.success ? parsedStruct.data : null}
          hasResume={Boolean(profile?.resume_text)}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Study plan</CardTitle>
            <CardDescription>
              Download a calendar (.ics) with daily study blocks for your
              unfinished topics — import it into Google/Apple Calendar and let
              it remind you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              render={
                <a href="/api/study-plan?days=14" download>
                  📅 Download 2-week study plan
                </a>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice</CardTitle>
            <CardDescription>
              The interviewer voice (male/female) is chosen from the toggle
              inside the interview room and remembered on this device. Best
              voices are in Chrome/Edge.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </>
  );
}
