import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return new Response(renderPage("Missing email parameter.", false), {
        status: 400,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert to handle duplicates gracefully
    const { error } = await supabase
      .from("unsubscribed_emails")
      .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

    if (error) {
      console.error("Unsubscribe error:", error);
      return new Response(renderPage("Something went wrong. Please try again.", false), {
        status: 500,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    return new Response(renderPage(email, true), {
      status: 200,
      headers: { "Content-Type": "text/html", ...corsHeaders },
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response(renderPage("An unexpected error occurred.", false), {
      status: 500,
      headers: { "Content-Type": "text/html", ...corsHeaders },
    });
  }
});

function renderPage(detail: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? "Unsubscribed" : "Error"}</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    h1 { color: ${success ? "#059669" : "#dc2626"}; font-size: 24px; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? "✓ Unsubscribed" : "Error"}</h1>
    <p>${success
      ? `<strong>${detail}</strong> has been unsubscribed. You will no longer receive quotation emails from Noga Engineering & Technology Ltd.`
      : detail
    }</p>
  </div>
</body>
</html>`;
}
