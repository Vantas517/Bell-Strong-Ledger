"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// This page figures out: is nobody logged in? Is this the trainer?
// Is this a client? And sends each person to the right place.

async function resolveRole(user) {
  // Are they the trainer?
  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (trainerRow) return { role: "trainer" };

  // Are they an already-set-up client?
  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (clientRow) return { role: "client" };

  // Were they invited by email, but this is their first time logging in?
  const { data: invite } = await supabase
    .from("client_invites")
    .select("*")
    .eq("email", user.email)
    .maybeSingle();

  if (invite) {
    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        id: user.id,
        trainer_id: invite.trainer_id,
        name: invite.name,
        email: user.email,
      })
      .select()
      .maybeSingle();

    if (!error && newClient) {
      await supabase.from("client_invites").delete().eq("id", invite.id);
      return { role: "client" };
    }
  }

  return { role: "unregistered" };
}

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading | signed-out | link-sent | resolving | unregistered
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleUser(session.user);
      } else {
        setStatus("signed-out");
      }
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleUser(session.user);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleUser(user) {
    setStatus("resolving");
    const { role } = await resolveRole(user);
    if (role === "trainer") router.push("/trainer");
    else if (role === "client") router.push("/client");
    else setStatus("unregistered");
  }

  async function sendLink() {
    if (!email.trim()) return;
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) setMessage(error.message);
    else setStatus("link-sent");
  }

  async function becomeTrainer() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("trainers").insert({ id: user.id, name: "Trainer" });
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/trainer");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("signed-out");
  }

  return (
    <div className="container">
      <div style={{ textAlign: "center", margin: "40px 0" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Vantas Ledger</div>
        <div className="muted" style={{ marginTop: 4 }}>Client tracking for Vantas Group</div>
      </div>

      {status === "loading" && <div className="muted" style={{ textAlign: "center" }}>Loading...</div>}

      {status === "signed-out" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Sign in</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Enter your email — no password needed. We'll send you a one-time link.
          </div>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <button className="btn-primary" style={{ width: "100%" }} onClick={sendLink}>
            Send login link
          </button>
          {message && <div className="muted" style={{ marginTop: 10, color: "#E8604C" }}>{message}</div>}
        </div>
      )}

      {status === "link-sent" && (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your email</div>
          <div className="muted">
            We sent a link to {email}. Open it on this device and you'll be signed in automatically.
          </div>
        </div>
      )}

      {status === "resolving" && (
        <div className="muted" style={{ textAlign: "center" }}>Signing you in...</div>
      )}

      {status === "unregistered" && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>No account found for this email yet</div>
          <div className="muted" style={{ marginBottom: 16 }}>
            If this is your first time setting this up, you can register as the trainer.
            If you're a client, ask your trainer to invite you first.
          </div>
          <button className="btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={becomeTrainer}>
            Set me up as the trainer
          </button>
          <button className="btn-ghost" style={{ width: "100%" }} onClick={signOut}>
            Sign out
          </button>
          {message && <div className="muted" style={{ marginTop: 10, color: "#E8604C" }}>{message}</div>}
        </div>
      )}
    </div>
  );
}
