import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { PageShell } from "@/components/PageShell";
import { DisplayNameForm } from "@/components/settings/DisplayNameForm";
import { ResumeUpload } from "@/components/settings/ResumeUpload";
import { NotificationToggle } from "@/components/settings/NotificationToggle";
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
      <PageShell
        maxWidth="narrow"
        className="space-y-6"
        title="Settings"
        description="Personalize your prep and export a study plan."
      >

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
                  <CalendarDays data-icon="inline-start" /> Download 2-week study
                  plan
                </a>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily reminders</CardTitle>
            <CardDescription>
              A once-a-day browser nudge to keep your streak alive. Fires only
              when you open the app — no background tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationToggle />
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
      </PageShell>
    </>
  );
}
