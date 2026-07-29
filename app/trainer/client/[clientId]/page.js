"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function TrainerClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId;

  const [checking, setChecking] = useState(true);
  const [client, setClient] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    verifyAndLoad();
  }, []);

  async function verifyAndLoad() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/");

    const { data: trainerRow } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    if (!trainerRow) return router.push("/");

    const { data: clientRow } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!clientRow || clientRow.trainer_id !== user.id) return router.push("/trainer");
    setClient(clientRow);

    await loadWorkouts();
    setChecking(false);
  }

  async function loadWorkouts() {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: false });
    setWorkouts(data || []);
  }

  async function createWorkout() {
    if (!title.trim()) return;
    const { data, error } = await supabase
      .from("workouts")
      .insert({ client_id: clientId, title: title.trim(), scheduled_date: date })
      .select()
      .maybeSingle();
    if (!error && data) {
      router.push(`/trainer/workout/${data.id}`);
    }
  }

  if (checking) return <div className="container muted">Loading...</div>;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button className="btn-ghost" onClick={() => router.push("/trainer")}>← Clients</button>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 18px" }}>{client.name}'s workouts</div>

      {workouts.length === 0 && !creating && (
        <div className="muted" style={{ marginBottom: 14 }}>No workouts yet — build the first one below.</div>
      )}

      {workouts.map((w) => (
        <div
          key={w.id}
          className="card"
          style={{ marginBottom: 10, cursor: "pointer" }}
          onClick={() => router.push(`/trainer/workout/${w.id}`)}
        >
          <div style={{ fontWeight: 600 }}>{w.title}</div>
          <div className="muted">{w.scheduled_date}</div>
        </div>
      ))}

      {creating ? (
        <div className="card" style={{ marginTop: 12 }}>
          <input placeholder="Workout title (e.g. Week 3, Day 2)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={createWorkout}>Create & open</button>
            <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setCreating(true)}>
          + New workout
        </button>
      )}
    </div>
  );
}
