import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

// Input validation
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token - authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with user's auth context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // Parse and validate request body
    const requestData = await req.json();
    const validation = validateRequest(requestData);
    if (!validation.valid) {
      console.error('Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, clientName, quoteNumber, total, validUntil, pdfBase64 }: SendQuotationRequest = requestData;

    // Verify user owns this quotation
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .select('id')
      .eq('quote_number', quoteNumber)
      .eq('user_id', user.id)
      .single();

    if (quotationError || !quotation) {
      console.error('Quotation not found or unauthorized:', quotationError?.message);
      return new Response(
        JSON.stringify({ error: 'Quotation not found or unauthorized' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending quotation ${quoteNumber} to ${to}`);

    // Convert base64 to buffer for attachment
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    const emailResponse = await resend.emails.send({
      from: "Noga Engineering & Technology Ltd. <onboarding@resend.dev>",
      to: [to],
      subject: `Quotation ${quoteNumber} from Noga Engineering & Technology Ltd.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0891b2;">Quotation ${quoteNumber}</h2>
          <p>Dear ${clientName},</p>
          <p>Please find attached our quotation <strong>${quoteNumber}</strong> for your review.</p>
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
        </div>
      `,
      attachments: [
        {
          filename: `Quotation_${quoteNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending quotation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
