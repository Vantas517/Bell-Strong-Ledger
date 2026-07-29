"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function TrainerDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [clients, setClients] = useState([]);
  const [invites, setInvites] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    verifyAndLoad();
  }, []);

  async function verifyAndLoad() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/");

    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!trainerRow) return router.push("/"); // not the trainer, bounce home

    await loadData(user.id);
    setChecking(false);
  }

  async function loadData(trainerId) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });
    setClients(clientRows || []);

    const { data: inviteRows } = await supabase
      .from("client_invites")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });
    setInvites(inviteRows || []);
  }

  async function sendInvite() {
    setMessage("");
    if (!name.trim() || !email.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_invites").insert({
      trainer_id: user.id,
      name: name.trim(),
      email: email.trim(),
    });
    if (error) {
      setMessage(error.message);
    } else {
      setName(""); setEmail(""); setAdding(false);
      await loadData(user.id);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (checking) return <div className="container muted">Loading...</div>;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Your clients</div>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </div>

      {clients.length === 0 && invites.length === 0 && (
        <div className="muted" style={{ marginBottom: 16 }}>No clients yet — invite your first one below.</div>
      )}

      {clients.map((c) => (
        <div
          key={c.id}
          className="card"
          style={{ marginBottom: 10, cursor: "pointer" }}
          onClick={() => router.push(`/trainer/client/${c.id}`)}
        >
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div className="muted">{c.email}</div>
        </div>
      ))}

      {invites.length > 0 && (
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <div className="muted" style={{ marginBottom: 6 }}>PENDING INVITES</div>
          {invites.map((i) => (
            <div key={i.id} className="card" style={{ marginBottom: 8, opacity: 0.7 }}>
              <div style={{ fontWeight: 600 }}>{i.name}</div>
              <div className="muted">{i.email} — waiting for them to sign in</div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="card" style={{ marginTop: 12 }}>
          <input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} />
          <input placeholder="Client email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={sendInvite}>Send invite</button>
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
          {message && <div className="muted" style={{ marginTop: 8, color: "#E8604C" }}>{message}</div>}
        </div>
      ) : (
        <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setAdding(true)}>
          + Invite a client
        </button>
      )}
    </div>
  );
}
