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

    // Find quotations that need follow-up notification:
    // - Created between 1 and 6 weeks ago
    // - Status is not 'accepted'
    // - Either no reminder sent, or last reminder was 7+ days ago
    // - Not yet notified, or last notification was 7+ days ago
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

    // Filter eligible quotations
    const eligible = (quotations || []).filter((q) => {
      // Check reminder cooldown: either no reminder sent, or 7+ days since last
      const reminderEligible =
        !q.reminder_sent_at ||
        new Date(q.reminder_sent_at).getTime() <= sevenDaysAgo.getTime();

      // Check notification cooldown
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

    // Get unique creator user IDs
    const userIds = [...new Set(eligible.map((q) => q.user_id))];

    // Fetch creator emails from auth.users via admin API
    const creatorEmails: Record<string, string> = {};
    for (const uid of userIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(uid);
      if (userData?.user?.email) {
        creatorEmails[uid] = userData.user.email;
      }
    }

    let sentCount = 0;

    for (const q of eligible) {
      const creatorEmail = creatorEmails[q.user_id];
      if (!creatorEmail) {
        console.warn(`No email found for user ${q.user_id}, skipping quote ${q.quote_number}`);
        continue;
      }

      const daysSinceCreation = Math.floor(
        (now.getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0891b2;">Follow-Up Reminder</h2>
          <p>Hi,</p>
          <p>Quotation <strong>${q.quote_number}</strong> for <strong>${q.client_name}</strong> was sent ${daysSinceCreation} days ago and hasn't been accepted yet.</p>
          <table style="margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Client:</td>
              <td style="padding: 8px 0; font-weight: bold;">${q.client_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Client Email:</td>
              <td style="padding: 8px 0;">${q.client_email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Quote Number:</td>
              <td style="padding: 8px 0;">${q.quote_number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Valid Until:</td>
              <td style="padding: 8px 0;">${new Date(q.valid_until).toLocaleDateString()}</td>
            </tr>
          </table>
          <p>Consider following up with the client to check on their decision.</p>
          <p style="margin-top: 30px;">Best regards,<br><strong>Noga Quote System</strong></p>
        </div>
      `;

      const brevoPayload = {
        sender: {
          name: "Noga Quote System",
          email: "quotes@noga-mt.com",
        },
        to: [{ email: creatorEmail }],
        subject: `Follow-Up Needed: Quotation ${q.quote_number} for ${q.client_name}`,
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
        await supabase
          .from("quotations")
          .update({ follow_up_notified_at: now.toISOString() })
          .eq("id", q.id);
        sentCount++;
        console.log(`Notification sent to ${creatorEmail} for quote ${q.quote_number}`);
      } else {
        const err = await brevoResponse.json();
        console.error(`Failed to notify for ${q.quote_number}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
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
