import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuotationRequest {
  to: string;
  recipients?: string[];
  clientName: string;
  quoteNumber: string;
  total: string;
  validUntil: string;
  pdfBase64: string;
  isReminder?: boolean;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const validateRequest = (data: any): { valid: boolean; error?: string } => {
  if (!data.to || typeof data.to !== 'string' || !isValidEmail(data.to)) {
    return { valid: false, error: 'Invalid email address' };
  }
  if (!data.clientName || typeof data.clientName !== 'string' || data.clientName.length > 200) {
    return { valid: false, error: 'Invalid client name' };
  }
  if (!data.quoteNumber || typeof data.quoteNumber !== 'string' || data.quoteNumber.length > 50) {
    return { valid: false, error: 'Invalid quote number' };
  }
  if (!data.total || typeof data.total !== 'string' || data.total.length > 100) {
    return { valid: false, error: 'Invalid total' };
  }
  if (!data.validUntil || typeof data.validUntil !== 'string') {
    return { valid: false, error: 'Invalid valid until date' };
  }
  if (!data.pdfBase64 || typeof data.pdfBase64 !== 'string' || data.pdfBase64.length > 10485760) {
    return { valid: false, error: 'Invalid or too large PDF (max 10MB)' };
  }
  return { valid: true };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const requestData = await req.json();
    const validation = validateRequest(requestData);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, recipients, clientName, quoteNumber, total, validUntil, pdfBase64, isReminder }: SendQuotationRequest = requestData;

    // For reminders with multiple recipients, send one email with all in TO
    const toList: { email: string; name?: string }[] = [];
    if (isReminder && recipients && recipients.length > 0) {
      for (const r of recipients) {
        const trimmed = r.trim().toLowerCase();
        if (isValidEmail(trimmed)) toList.push({ email: trimmed });
      }
    }
    if (toList.length === 0) {
      toList.push({ email: to, name: clientName });
    }

    // Check if email is unsubscribed
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: unsubscribed } = await serviceSupabase
      .from('unsubscribed_emails')
      .select('id')
      .eq('email', to.toLowerCase())
      .maybeSingle();

    if (unsubscribed) {
      return new Response(
        JSON.stringify({ error: 'This email has unsubscribed from communications.', unsubscribed: true }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify quotation exists and get handler user_id + reminder/status state
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .select('id, user_id, status, reminder_sent_at')
      .eq('quote_number', quoteNumber)
      .single();

    if (quotationError || !quotation) {
      return new Response(
        JSON.stringify({ error: 'Quotation not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Server-side guards for reminders to prevent duplicates
    if (isReminder) {
      // Block if quote is no longer eligible
      if (quotation.status === 'accepted' || quotation.status === 'finished') {
        return new Response(
          JSON.stringify({ error: `Quotation is ${quotation.status} — reminders disabled.` }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Enforce 7-day cooldown server-side. Allow a small grace window (5 min)
      // so multi-recipient parallel sends in the same campaign all go through.
      if (quotation.reminder_sent_at) {
        const last = new Date(quotation.reminder_sent_at).getTime();
        const elapsed = Date.now() - last;
        const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
        const GRACE_MS = 5 * 60 * 1000; // 5 minutes for fan-out to multiple recipients
        if (elapsed >= GRACE_MS && elapsed < COOLDOWN_MS) {
          const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
          return new Response(
            JSON.stringify({ error: `Reminder cooldown active — ${daysLeft} day(s) remaining.`, cooldown: true }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // Resolve handler email for CC
    const ccList: { email: string }[] = [];
    try {
      const { data: { user: handlerUser } } = await serviceSupabase.auth.admin.getUserById(quotation.user_id);
      if (handlerUser?.email && handlerUser.email.toLowerCase() !== to.toLowerCase()) {
        ccList.push({ email: handlerUser.email });
      }
    } catch (e) {
      console.error("Failed to resolve handler email for CC:", e);
    }

    // Create email tracking record
    const { data: trackingRecord } = await serviceSupabase
      .from('email_tracking')
      .insert({
        quotation_id: quotation.id,
        recipient_email: to.toLowerCase(),
        email_type: isReminder ? 'reminder' : 'quotation',
      })
      .select('tracking_id')
      .single();

    const trackingPixelUrl = trackingRecord
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/track-email-open?t=${trackingRecord.tracking_id}`
      : '';

    // Unsubscribe link points to the frontend app
    const unsubscribeUrl = `https://nogamt-quote-vault.lovable.app/#/unsubscribe?email=${encodeURIComponent(to)}`;

    const subject = isReminder
      ? `Reminder: Quotation ${quoteNumber} from Noga Engineering & Technology Ltd.`
      : `Quotation ${quoteNumber} from Noga Engineering & Technology Ltd.`;

    const introText = isReminder
      ? `<p>This is a friendly reminder regarding our quotation <strong>${quoteNumber}</strong>. Please find the updated document attached for your review.</p>`
      : `<p>Please find attached our quotation <strong>${quoteNumber}</strong> for your review.</p>`;

    const trackingPixelHtml = trackingPixelUrl
      ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
      : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">${isReminder ? 'Reminder: ' : ''}Quotation ${quoteNumber}</h2>
        <p>Dear ${clientName},</p>
        ${introText}
        <table style="margin: 20px 0; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #666;">Total:</td>
            <td style="padding: 8px 0; font-weight: bold;">${total}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #666;">Valid Until:</td>
            <td style="padding: 8px 0;">${validUntil}</td>
          </tr>
        </table>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p style="margin-top: 30px;">Best regards,<br><strong>Noga Engineering & Technology Ltd.</strong></p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">
          Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel<br>
          <a href="https://www.nogamt.com" style="color: #0891b2;">www.nogamt.com</a>
        </p>
        <p style="font-size: 11px; color: #bbb; margin-top: 20px;">
          <a href="${unsubscribeUrl}" style="color: #bbb;">Unsubscribe</a> from future quotation emails.
        </p>
        ${trackingPixelHtml}
      </div>
    `;

    // Send via Brevo API
    const brevoPayload = {
      sender: {
        name: "Noga Engineering & Technology Ltd.",
        email: "quotes@noga-mt.com",
      },
      to: [{ email: to, name: clientName }],
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      subject,
      htmlContent,
      attachment: [
        {
          content: pdfBase64,
          name: `Quotation_${quoteNumber}.pdf`,
        },
      ],
    };

    const brevoResponse = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoResult = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error("Brevo API error:", brevoResult);
      return new Response(
        JSON.stringify({ error: brevoResult.message || 'Failed to send email via Brevo' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully via Brevo:", brevoResult);

    // Save sent email history
    try {
      await serviceSupabase
        .from('sent_emails')
        .insert({
          quotation_id: quotation.id,
          user_id: user.id,
          recipient_emails: [to],
          subject,
          body_html: htmlContent,
          email_type: isReminder ? 'reminder' : 'quotation',
          attachment_names: [`Quotation_${quoteNumber}.pdf`],
        });
    } catch (e) {
      console.error("Failed to save sent email record:", e);
    }

    if (isReminder) {
      await supabase
        .from('quotations')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', quotation.id);
    }

    return new Response(JSON.stringify({ success: true, data: brevoResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending quotation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
