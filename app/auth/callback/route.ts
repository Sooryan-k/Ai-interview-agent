import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Exchanges the magic-link / OAuth code for a session and binds the resulting
 * auth cookies directly to the redirect response so they're never dropped.
 * This is what keeps the user signed in across reloads and browser restarts
 * (until they explicitly sign out): @supabase/ssr writes a long-lived
 * refresh-token cookie here, and the proxy auto-refreshes the session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Build the redirect response first, then attach session cookies to IT.
    const response = NextResponse.redirect(`${origin}${next}`);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
