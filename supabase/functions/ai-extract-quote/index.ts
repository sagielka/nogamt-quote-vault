// AI Quote Extraction
// Takes raw email text + optional file content, returns structured quote data
// using Lovable AI Gateway with tool-calling for reliable JSON.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CatalogHint {
  sku: string;
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const emailText: string = (body.emailText ?? "").toString().slice(0, 50000);
    const attachmentText: string = (body.attachmentText ?? "").toString().slice(0, 50000);
    const catalog: CatalogHint[] = Array.isArray(body.catalog) ? body.catalog.slice(0, 600) : [];

    if (!emailText.trim() && !attachmentText.trim()) {
      return new Response(
        JSON.stringify({ error: "No content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Compact catalog reference for the model
    const catalogList = catalog
      .map((c) => `${c.sku} | ${c.description}`)
      .join("\n");

    const systemPrompt = `You are a quotation extraction assistant for Noga Engineering, a precision tooling company.
You receive an email (and optionally an attachment) from a customer requesting a price quote.
Extract the customer details and the requested items.

For each item, do your best to match against the provided catalog SKU list. If a customer reference doesn't exactly match a SKU, suggest the closest catalog SKU as 'suggestedSku' and put your matched value in 'sku' only when you are confident. Otherwise leave 'sku' empty and include the raw text in 'rawText'.

Currency: detect from symbols/words in the email (USD/EUR/GBP/ILS/JPY/CNY). Default USD.
Quantities: parse numbers; default 1 if a quantity word is missing.

CATALOG (SKU | description):
${catalogList || "(no catalog provided)"}`;

    const userContent = [
      "===== EMAIL =====",
      emailText || "(no email body)",
      attachmentText ? "\n===== ATTACHMENT =====\n" + attachmentText : "",
    ].join("\n");

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_quote_request",
          description: "Return structured quote request data extracted from the email.",
          parameters: {
            type: "object",
            properties: {
              customer: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  company: { type: "string" },
                  address: { type: "string" },
                },
                required: ["name", "email"],
                additionalProperties: false,
              },
              currency: {
                type: "string",
                enum: ["USD", "EUR", "GBP", "ILS", "JPY", "CNY"],
              },
              leadTime: { type: "string" },
              notes: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sku: { type: "string", description: "Confidently matched catalog SKU, or empty" },
                    suggestedSku: { type: "string", description: "Closest catalog SKU if uncertain" },
                    description: { type: "string" },
                    rawText: { type: "string", description: "Original text the customer used" },
                    quantity: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["description", "quantity"],
                  additionalProperties: false,
                },
              },
            },
            required: ["customer", "currency", "items"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_quote_request" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: "AI extraction failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "AI did not return structured data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-extract-quote error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
