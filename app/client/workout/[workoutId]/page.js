"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { loadWorkoutData, groupExercises, upsertSet, CATEGORY_LABELS } from "../../../../lib/workouts";

export default function ClientWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.workoutId;

  const [checking, setChecking] = useState(true);
  const [workout, setWorkout] = useState(null);

  const refresh = useCallback(async () => {
    const data = await loadWorkoutData(workoutId);
    setWorkout(data);
  }, [workoutId]);

  useEffect(() => {
    verify();
  }, []);

  async function verify() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/");

    const { data: w } = await supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle();
    if (!w || w.client_id !== user.id) return router.push("/client");

    await refresh();
    setChecking(false);

    const channel = supabase
      .channel(`workout-${workoutId}-client`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_blocks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_exercises" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "logged_sets" }, refresh)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  if (checking || !workout) return <div className="container muted">Loading...</div>;

  return (
    <div className="container">
      <button className="btn-ghost" onClick={() => router.push("/client")}>← Back</button>
      <div style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 4px" }}>{workout.title}</div>
      <div className="muted" style={{ marginBottom: 18 }}>{workout.scheduled_date}</div>

      {workout.blocks.length === 0 && (
        <div className="muted">Nothing programmed for this one yet.</div>
      )}

      {workout.blocks.map((block) => {
        const groups = groupExercises(block.exercises);
        return (
          <div key={block.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {CATEGORY_LABELS[block.category]}
            </div>
            {groups.map((g, i) => (
              <div key={i} style={{ marginBottom: 10, border: g.items.length > 1 ? "1px dashed rgba(232,185,77,0.4)" : "none", borderRadius: 8, padding: g.items.length > 1 ? 8 : 0 }}>
                {g.items.length > 1 && <div className="muted" style={{ fontSize: 11, marginBottom: 6, color: "#E8B94D" }}>SUPERSET</div>}
                {g.items.map((ex) => (
                  <ClientExercise key={ex.id} exercise={ex} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ClientExercise({ exercise }) {
  const setNumbers = Array.from({ length: exercise.prescribed_sets }, (_, i) => i + 1);

  async function logSet(setNumber, patch) {
    await upsertSet(exercise.id, setNumber, patch, "client");
  }

  return (
    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(242,239,230,0.08)" }}>
      <div style={{ fontWeight: 600 }}>{exercise.name}</div>
      <div className="muted">
        {exercise.prescribed_sets} × {exercise.prescribed_reps}
        {exercise.prescribed_load ? ` · ${exercise.prescribed_load}` : ""}
        {exercise.rest_seconds ? ` · rest ${exercise.rest_seconds}s` : ""}
      </div>
      {exercise.notes && <div className="muted" style={{ fontStyle: "italic" }}>{exercise.notes}</div>}

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {setNumbers.map((num) => {
          const existing = exercise.sets.find((s) => s.set_number === num) || {};
          return (
            <div key={num} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="muted" style={{ width: 18 }}>{num}</span>
              <input
                placeholder="reps" defaultValue={existing.actual_reps || ""}
                onBlur={(e) => logSet(num, { actual_reps: e.target.value })}
                style={{ padding: "6px 8px", fontSize: 13 }}
              />
              <input
                placeholder="weight" defaultValue={existing.actual_weight || ""}
                onBlur={(e) => logSet(num, { actual_weight: e.target.value })}
                style={{ padding: "6px 8px", fontSize: 13 }}
              />
              <input
                type="checkbox" style={{ width: "auto" }} defaultChecked={!!existing.completed}
                onChange={(e) => logSet(num, { completed: e.target.checked })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
