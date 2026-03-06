import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    const { recipients, subject, message } = body as {
      recipients: { email: string; name: string }[];
      subject: string;
      message: string;
    };

    // Validate
    if (!subject || typeof subject !== "string" || subject.trim().length === 0 || subject.length > 200) {
      return new Response(
        JSON.stringify({ error: "Subject is required (max 200 chars)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Message is required (max 5000 chars)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 50) {
      return new Response(
        JSON.stringify({ error: "1-50 recipients required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    for (const r of recipients) {
      if (!r.email || !isValidEmail(r.email)) {
        return new Response(
          JSON.stringify({ error: `Invalid email: ${r.email}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Check unsubscribed
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const emails = recipients.map((r) => r.email.toLowerCase());
    const { data: unsubscribed } = await serviceSupabase
      .from("unsubscribed_emails")
      .select("email")
      .in("email", emails);

    const unsubSet = new Set((unsubscribed || []).map((u: any) => u.email));
    const validRecipients = recipients.filter(
      (r) => !unsubSet.has(r.email.toLowerCase())
    );

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "All recipients have unsubscribed." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build HTML
    const unsubscribeBaseUrl = "https://nogamt-quote-vault.lovable.app/#/unsubscribe";
    const messageHtml = message.replace(/\n/g, "<br>");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">${subject}</h2>
        <div style="line-height: 1.6; color: #333;">${messageHtml}</div>
        <p style="margin-top: 30px;">Best regards,<br><strong>Noga Engineering & Technology Ltd.</strong></p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">
          Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel<br>
          <a href="https://www.nogamt.com" style="color: #0891b2;">www.nogamt.com</a>
        </p>
        <p style="font-size: 11px; color: #bbb; margin-top: 20px;">
          <a href="${unsubscribeBaseUrl}" style="color: #bbb;">Unsubscribe</a> from future emails.
        </p>
      </div>
    `;

    // Send individually to respect unsubscribe links per recipient
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of validRecipients) {
      const personalHtml = htmlContent.replace(
        `${unsubscribeBaseUrl}`,
        `${unsubscribeBaseUrl}?email=${encodeURIComponent(recipient.email)}`
      );

      const brevoPayload = {
        sender: {
          name: "Noga Engineering & Technology Ltd.",
          email: "quotes@noga-mt.com",
        },
        to: [{ email: recipient.email, name: recipient.name }],
        subject,
        htmlContent: personalHtml,
      };

      try {
        const res = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": BREVO_API_KEY!,
          },
          body: JSON.stringify(brevoPayload),
        });

        if (res.ok) {
          results.push({ email: recipient.email, success: true });
        } else {
          const err = await res.json();
          results.push({ email: recipient.email, success: false, error: err.message });
        }
      } catch (e: any) {
        results.push({ email: recipient.email, success: false, error: e.message });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const skipped = recipients.length - validRecipients.length;

    console.log(`Customer email sent: ${sent}/${validRecipients.length}, skipped ${skipped} unsubscribed`);

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total: recipients.length, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending customer email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
