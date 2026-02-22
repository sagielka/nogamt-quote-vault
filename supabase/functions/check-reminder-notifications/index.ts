import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixWeeksAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find quotations that need follow-up:
    // - Created between 1 and 6 weeks ago
    // - Status is not 'accepted'
    const { data: quotations, error: fetchError } = await supabase
      .from("quotations")
      .select("*")
      .gte("created_at", sixWeeksAgo.toISOString())
      .lte("created_at", oneWeekAgo.toISOString())
      .or("status.is.null,status.neq.accepted");

    if (fetchError) {
      console.error("Error fetching quotations:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Filter eligible quotations (7-day cooldown on follow_up_notified_at)
    const eligible = (quotations || []).filter((q) => {
      const reminderEligible =
        !q.reminder_sent_at ||
        new Date(q.reminder_sent_at).getTime() <= sevenDaysAgo.getTime();
      const notificationEligible =
        !q.follow_up_notified_at ||
        new Date(q.follow_up_notified_at).getTime() <= sevenDaysAgo.getTime();
      return reminderEligible && notificationEligible;
    });

    if (eligible.length === 0) {
      console.log("No quotations need follow-up notification.");
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Group quotations by user_id
    const byUser: Record<string, typeof eligible> = {};
    for (const q of eligible) {
      if (!byUser[q.user_id]) byUser[q.user_id] = [];
      byUser[q.user_id].push(q);
    }

    // Fetch creator emails
    const creatorEmails: Record<string, string> = {};
    for (const uid of Object.keys(byUser)) {
      const { data: userData } = await supabase.auth.admin.getUserById(uid);
      if (userData?.user?.email) {
        creatorEmails[uid] = userData.user.email;
      }
    }

    let sentCount = 0;

    for (const [userId, userQuotations] of Object.entries(byUser)) {
      const creatorEmail = creatorEmails[userId];
      if (!creatorEmail) {
        console.warn(`No email found for user ${userId}, skipping ${userQuotations.length} quotes`);
        continue;
      }

      // Build quotation rows for the consolidated email
      const quotationRows = userQuotations
        .map((q) => {
          const daysSinceCreation = Math.floor(
            (now.getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          return `
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${q.quote_number}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${q.client_name}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${q.client_email}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${daysSinceCreation} days</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${new Date(q.valid_until).toLocaleDateString()}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${q.status || 'draft'}</td>
            </tr>`;
        })
        .join("");

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <h2 style="color: #0891b2;">Weekly Follow-Up Summary</h2>
          <p>Hi,</p>
          <p>You have <strong>${userQuotations.length}</strong> quotation${userQuotations.length > 1 ? "s" : ""} that may need follow-up:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Quote #</th>
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Client</th>
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Email</th>
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Age</th>
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Valid Until</th>
                <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${quotationRows}
            </tbody>
          </table>
          <p>Consider reaching out to these clients to check on their decisions.</p>
          <p style="margin-top: 30px;">Best regards,<br><strong>Noga Quote System</strong></p>
        </div>
      `;

      const brevoPayload = {
        sender: {
          name: "Noga Quote System",
          email: "quotes@noga-mt.com",
        },
        to: [{ email: creatorEmail }],
        subject: `Weekly Follow-Up: ${userQuotations.length} Quotation${userQuotations.length > 1 ? "s" : ""} Need Attention`,
        htmlContent,
      };

      const brevoResponse = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": BREVO_API_KEY!,
        },
        body: JSON.stringify(brevoPayload),
      });

      if (brevoResponse.ok) {
        // Update follow_up_notified_at for all quotations in this batch
        const ids = userQuotations.map((q) => q.id);
        for (const id of ids) {
          await supabase
            .from("quotations")
            .update({ follow_up_notified_at: now.toISOString() })
            .eq("id", id);
        }
        sentCount++;
        console.log(`Consolidated email sent to ${creatorEmail} with ${userQuotations.length} quotations`);
      } else {
        const err = await brevoResponse.json();
        console.error(`Failed to send consolidated email to ${creatorEmail}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, totalQuotations: eligible.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in check-reminder-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
