"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ClientDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [clientRow, setClientRow] = useState(null);
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    verify();
  }, []);

  async function verify() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/");

    const { data: row } = await supabase
      .from("clients")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!row) return router.push("/"); // not a registered client, bounce home

    setClientRow(row);

    const { data: w } = await supabase
      .from("workouts")
      .select("*")
      .eq("client_id", user.id)
      .order("scheduled_date", { ascending: false });
    setWorkouts(w || []);

    setChecking(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (checking) return <div className="container muted">Loading...</div>;

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = workouts.find((w) => w.scheduled_date === todayStr);
  const rest = workouts.filter((w) => w.id !== today?.id);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Welcome, {clientRow.name}</div>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </div>

      {today && (
        <div
          className="card"
          style={{ marginBottom: 16, cursor: "pointer", borderColor: "#E8B94D" }}
          onClick={() => router.push(`/client/workout/${today.id}`)}
        >
          <div className="muted" style={{ color: "#E8B94D", fontWeight: 600, marginBottom: 4 }}>TODAY</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{today.title}</div>
        </div>
      )}

      {rest.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>ALL WORKOUTS</div>
          {rest.map((w) => (
            <div
              key={w.id}
              className="card"
              style={{ marginBottom: 8, cursor: "pointer" }}
              onClick={() => router.push(`/client/workout/${w.id}`)}
            >
              <div style={{ fontWeight: 600 }}>{w.title}</div>
              <div className="muted">{w.scheduled_date}</div>
            </div>
          ))}
        </>
      )}

      {workouts.length === 0 && (
        <div className="muted">Nothing programmed yet — check back once your trainer builds your first workout.</div>
      )}
    </div>
  );
}
