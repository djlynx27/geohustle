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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this is a partial (single-zone) analysis
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body for cron */ }
    const singleZoneId = body?.zone_id as string | undefined;

    // Fetch zones (all or single)
    let zonesQuery = supabase.from("zones").select("*").order("city_id");
    if (singleZoneId) zonesQuery = zonesQuery.eq("id", singleZoneId);
    const { data: zones, error: zErr } = await zonesQuery;
    if (zErr) throw zErr;

    // Fetch last 30 days of scores
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    let scoresQuery = supabase
      .from("scores")
      .select("zone_id, score, weather_boost, event_boost, final_score, calculated_at")
      .gte("calculated_at", thirtyDaysAgo)
      .order("calculated_at", { ascending: false });
    if (singleZoneId) scoresQuery = scoresQuery.eq("zone_id", singleZoneId);
    const { data: scores, error: sErr } = await scoresQuery.limit(500);
    if (sErr) throw sErr;

    // Fetch last 30 days of trips
    let tripsQuery = supabase
      .from("trips")
      .select("zone_id, started_at, ended_at, earnings, tips, distance_km")
      .gte("started_at", thirtyDaysAgo);
    if (singleZoneId) tripsQuery = tripsQuery.eq("zone_id", singleZoneId);
    const { data: trips, error: tErr } = await tripsQuery.limit(500);
    if (tErr) throw tErr;

    // Build zone summary
    const zoneSummary = zones?.map(z => ({
      zone_id: z.id,
      zone_name: z.name,
      type: z.type,
      territory: z.territory,
      base_score: z.base_score,
      current_score: z.current_score,
    }));

    const historicalData = JSON.stringify({
      zones: zoneSummary,
      recent_scores: scores?.slice(0, 200),
      recent_trips: trips?.slice(0, 200),
    });

    const prompt = `You are a rideshare demand optimization expert for Montreal, Laval, and Longueuil. Based on the following historical trip and score data, recalculate the demand score (0-100) for each zone.

CRITICAL WEIGHTING RULE: Zones with more logged trips should rely MORE on real trip data (earnings, frequency, tips, distance patterns) and LESS on base_score. Use this formula:
- 0 trips: score = base_score (100% base)
- 1-5 trips: 70% base_score + 30% real data insights
- 6-15 trips: 40% base_score + 60% real data insights
- 16+ trips: 15% base_score + 85% real data insights

"Real data insights" means: trip frequency in zone, average earnings per trip, tip ratio, average distance, time-of-day patterns, and day-of-week patterns from the trips.

Consider zone type, location patterns, trip frequency, earnings per zone, and time patterns. Return ONLY a valid JSON array with format: [{"zone_id":"uuid","zone_name":"name","new_score":number,"peak_hours":"e.g. 7h-9h, 17h-19h","best_days":"e.g. lundi, vendredi","trend":"up|down|stable","tip":"actionable advice in French","trip_count":number,"data_weight":"base|mixed|real"}]. Data: ${historicalData}`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a data analyst. Return only valid JSON, no markdown, no explanation." },
          { role: "user", content: prompt },
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
    const raw = aiData.choices?.[0]?.message?.content || "[]";
    
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    
    let recommendations;
    try {
      recommendations = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", jsonStr.slice(0, 500));
      throw new Error("AI returned invalid JSON");
    }

    if (!Array.isArray(recommendations)) throw new Error("AI response is not an array");

    // Update zones and save to score_history
    for (const rec of recommendations) {
      if (!rec.zone_id || typeof rec.new_score !== "number") continue;
      const score = Math.max(0, Math.min(100, Math.round(rec.new_score)));

      await supabase.from("zones").update({ current_score: score }).eq("id", rec.zone_id);

      await supabase.from("score_history").insert({
        zone_id: rec.zone_id,
        score: score,
        reason: `AI analysis: ${rec.trend || ""}. ${rec.tip || ""}`.trim(),
      });
    }

    return new Response(JSON.stringify({ success: true, recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-score-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
