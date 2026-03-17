import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_url, file_content, file_name, zone_id, zone_name } = await req.json();
    if (!zone_id) throw new Error("zone_id is required");
    if (!image_url && !file_content) throw new Error("image_url or file_content is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build AI messages based on input type
    const isImage = !!image_url;
    const systemPrompt = isImage
      ? "You are a rideshare demand analyst. Analyze screenshots from rideshare driver apps (Lyft, Uber, Maxymo, Gridwise, QuickBooks, Everlance) and extract ALL relevant data. Return ONLY valid JSON, no markdown."
      : "You are a rideshare data analyst. Extract rideshare-relevant data from uploaded files (earnings, zones, demand patterns, trip history, expenses). Return ONLY valid JSON, no markdown.";

    const userContent = isImage
      ? [
          {
            type: "text",
            text: `Analyze this rideshare driver app screenshot from ${file_name || 'unknown app'}. Extract:
1. Surge/demand zones visible (areas with high demand shown by colors/heat)
2. Demand level for each zone (low/medium/high/very_high)
3. Any surge multipliers visible
4. Earnings data if visible
5. Trip details if visible
6. Time of day if shown

Return JSON: {"zones_detected":[{"area":"name","demand":"low|medium|high|very_high","surge_multiplier":number|null,"color_intensity":"description"}],"overall_demand":"low|medium|high|very_high","time_context":"description","notes":"any additional observations in French","extracted_data":{"earnings":number|null,"trips_count":number|null,"distance_km":number|null}}`
          },
          { type: "image_url", image_url: { url: image_url } }
        ]
      : `Analyze this rideshare-related file content (${file_name || 'unknown'}). Extract ALL rideshare-relevant data: earnings, zones, demand patterns, trip history, expenses, distances, times.

File content:
${file_content.slice(0, 30000)}

Return JSON: {"zones_detected":[{"area":"name","demand":"low|medium|high|very_high","surge_multiplier":null,"color_intensity":"from data"}],"overall_demand":"low|medium|high|very_high","time_context":"description","notes":"observations in French","extracted_data":{"earnings":number|null,"trips_count":number|null,"distance_km":number|null,"tips":number|null}}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", jsonStr.slice(0, 500));
      analysis = { zones_detected: [], overall_demand: "unknown", notes: jsonStr.slice(0, 300) };
    }

    // Build a readable note from the analysis
    const zonesText = (analysis.zones_detected || [])
      .map((z: any) => `• ${z.area}: ${z.demand}${z.surge_multiplier ? ` (×${z.surge_multiplier})` : ''} — ${z.color_intensity || ''}`)
      .join('\n');

    const extractedInfo = analysis.extracted_data
      ? Object.entries(analysis.extracted_data).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${v}`).join(', ')
      : '';

    const noteText = [
      `📸 Analyse ${isImage ? 'screenshot' : 'fichier'} (${file_name || 'N/A'}) — Demande globale: ${analysis.overall_demand || 'N/A'}`,
      analysis.time_context ? `⏰ ${analysis.time_context}` : '',
      zonesText ? `\n🔥 Zones détectées:\n${zonesText}` : '',
      extractedInfo ? `\n📊 Données extraites: ${extractedInfo}` : '',
      analysis.notes ? `\n💡 ${analysis.notes}` : '',
    ].filter(Boolean).join('\n');

    // Save to driver_notes
    await supabase.from("driver_notes").insert({
      zone_id,
      note: noteText,
      trip_date: new Date().toISOString().split('T')[0],
    });

    // If trip data was extracted, save to trips table
    const ed = analysis.extracted_data;
    if (ed?.earnings && ed.earnings > 0) {
      await supabase.from("trips").insert({
        zone_id,
        started_at: new Date().toISOString(),
        earnings: ed.earnings,
        tips: ed.tips || 0,
        distance_km: ed.distance_km || 0,
        notes: `Auto-extrait de ${file_name || 'fichier'}`,
      });
    }

    // Adjust zone's current_score based on detected demand
    const demandMap: Record<string, number> = { very_high: 10, high: 5, medium: 0, low: -5 };
    const adjustment = demandMap[analysis.overall_demand] ?? 0;
    if (adjustment !== 0) {
      const { data: zoneData } = await supabase.from("zones").select("current_score").eq("id", zone_id).single();
      if (zoneData) {
        const newScore = Math.max(0, Math.min(100, (zoneData.current_score ?? 50) + adjustment));
        await supabase.from("zones").update({ current_score: newScore }).eq("id", zone_id);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis, note: noteText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-screenshot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
