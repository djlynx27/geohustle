import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Check if report already exists
    const { data: existing } = await sb
      .from("daily_reports")
      .select("id")
      .eq("report_date", today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: "Report already exists for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's trips
    const { data: trips } = await sb
      .from("trips")
      .select("*, zones(name)")
      .gte("started_at", `${today}T00:00:00`)
      .lte("started_at", `${today}T23:59:59`);

    const allTrips = trips ?? [];

    let totalEarnings = 0;
    let totalDistance = 0;
    let totalHours = 0;
    const zoneEarnings: Record<string, { name: string; earnings: number }> = {};
    const hourEarnings: Record<number, number> = {};

    for (const t of allTrips) {
      const earn = Number(t.earnings || 0) + Number(t.tips || 0);
      totalEarnings += earn;
      totalDistance += Number(t.distance_km || 0);

      if (t.started_at && t.ended_at) {
        const hours = (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 3_600_000;
        totalHours += hours;
      }

      const zoneName = (t.zones as any)?.name || "Inconnu";
      if (!zoneEarnings[zoneName]) zoneEarnings[zoneName] = { name: zoneName, earnings: 0 };
      zoneEarnings[zoneName].earnings += earn;

      const hour = new Date(t.started_at).getHours();
      hourEarnings[hour] = (hourEarnings[hour] || 0) + earn;
    }

    const sortedZones = Object.values(zoneEarnings).sort((a, b) => b.earnings - a.earnings);
    const bestZone = sortedZones[0]?.name || "";
    const worstZone = sortedZones[sortedZones.length - 1]?.name || "";

    const bestHourEntry = Object.entries(hourEarnings).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const bestTimeSlot = bestHourEntry ? `${bestHourEntry[0].padStart(2, "0")}:00` : "";

    // AI recommendation
    let aiRec = "";
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && allTrips.length > 0) {
        const prompt = `Tu es un conseiller pour chauffeur de taxi/rideshare à Montréal. Voici le résumé de la journée:
- Gains: $${totalEarnings.toFixed(2)}
- Distance: ${totalDistance.toFixed(1)} km  
- Heures: ${totalHours.toFixed(1)}h
- Meilleure zone: ${bestZone}
- Pire zone: ${worstZone}
- Meilleur créneau: ${bestTimeSlot}
- Nombre de courses: ${allTrips.length}

Donne UNE recommandation courte (max 2 phrases) pour demain.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiRec = aiData.choices?.[0]?.message?.content?.trim() || "";
        }
      }
    } catch {
      // AI is non-blocking
    }

    // Insert report
    const { error } = await sb.from("daily_reports").insert({
      report_date: today,
      total_earnings: totalEarnings,
      total_distance_km: totalDistance,
      hours_worked: Math.round(totalHours * 10) / 10,
      best_zone_name: bestZone,
      worst_zone_name: worstZone,
      best_time_slot: bestTimeSlot,
      dead_time_pct: 0,
      ai_recommendation: aiRec,
      total_trips: allTrips.length,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, trips: allTrips.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
