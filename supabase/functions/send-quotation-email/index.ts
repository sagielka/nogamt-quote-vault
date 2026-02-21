import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuotationRequest {
  to: string;
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

    const { to, clientName, quoteNumber, total, validUntil, pdfBase64, isReminder }: SendQuotationRequest = requestData;

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

    // Verify quotation exists and get creator info
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .select('id, user_id')
      .eq('quote_number', quoteNumber)
      .single();

    if (quotationError || !quotation) {
      return new Response(
        JSON.stringify({ error: 'Quotation not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Unsubscribe link points to the frontend app
    const unsubscribeUrl = `https://nogamt-quote-vault.lovable.app/#/unsubscribe?email=${encodeURIComponent(to)}`;

    const subject = isReminder
      ? `Reminder: Quotation ${quoteNumber} from Noga Engineering & Technology Ltd.`
      : `Quotation ${quoteNumber} from Noga Engineering & Technology Ltd.`;

    const introText = isReminder
      ? `<p>This is a friendly reminder regarding our quotation <strong>${quoteNumber}</strong>. Please find the updated document attached for your review.</p>`
      : `<p>Please find attached our quotation <strong>${quoteNumber}</strong> for your review.</p>`;

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
      </div>
    `;

    // Send via Brevo API
    const brevoPayload = {
      sender: {
        name: "Noga Engineering & Technology Ltd.",
        email: "quotes@noga-mt.com",
      },
      to: [{ email: to, name: clientName }],
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

    // Send follow-up notification to quote creator
    try {
      const { data: creatorData } = await serviceSupabase.auth.admin.getUserById(quotation.user_id);
      const creatorEmail = creatorData?.user?.email;

      if (creatorEmail && creatorEmail.toLowerCase() !== to.toLowerCase()) {
        const notificationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">Follow-Up Reminder</h2>
            <p>A quotation has been sent to <strong>${clientName}</strong> (${to}).</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 16px 8px 0; color: #666;">Quote:</td>
                <td style="padding: 8px 0; font-weight: bold;">${quoteNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 16px 8px 0; color: #666;">Total:</td>
                <td style="padding: 8px 0; font-weight: bold;">${total}</td>
              </tr>
              <tr>
                <td style="padding: 8px 16px 8px 0; color: #666;">Valid Until:</td>
                <td style="padding: 8px 0;">${validUntil}</td>
              </tr>
            </table>
            <p>Please remember to follow up with the client to ensure they received the quotation and address any questions.</p>
            <p style="margin-top: 30px;">— Noga Quote System</p>
          </div>
        `;

        await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": BREVO_API_KEY!,
          },
          body: JSON.stringify({
            sender: { name: "Noga Quote System", email: "quotes@noga-mt.com" },
            to: [{ email: creatorEmail }],
            subject: `Follow-up: Quotation ${quoteNumber} sent to ${clientName}`,
            htmlContent: notificationHtml,
          }),
        });
        console.log("Follow-up notification sent to creator:", creatorEmail);
      }
    } catch (notifyErr) {
      console.error("Failed to send creator notification (non-blocking):", notifyErr);
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
