"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { loadWorkoutData, groupExercises, upsertSet, CATEGORY_LABELS } from "../../../../lib/workouts";

const CATEGORIES = ["warmup", "working", "conditioning", "cooldown"];

export default function TrainerWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.workoutId;

  const [checking, setChecking] = useState(true);
  const [workout, setWorkout] = useState(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const [newCategory, setNewCategory] = useState("warmup");

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
    const { data: trainerRow } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    if (!trainerRow) return router.push("/");

    await refresh();
    setChecking(false);

    const channel = supabase
      .channel(`workout-${workoutId}-trainer`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_blocks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_exercises" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "logged_sets" }, refresh)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  async function addBlock() {
    const existing = workout.blocks.length;
    await supabase.from("workout_blocks").insert({
      workout_id: workoutId,
      category: newCategory,
      sort_order: existing,
    });
    setAddingBlock(false);
    refresh();
  }

  async function removeBlock(blockId) {
    await supabase.from("workout_blocks").delete().eq("id", blockId);
    refresh();
  }

  if (checking || !workout) return <div className="container muted">Loading...</div>;

  return (
    <div className="container">
      <button className="btn-ghost" onClick={() => router.push(`/trainer/client/${workout.client_id}`)}>← Back</button>
      <div style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 4px" }}>{workout.title}</div>
      <div className="muted" style={{ marginBottom: 18 }}>{workout.scheduled_date}</div>

      {workout.blocks.map((block) => (
        <BlockEditor key={block.id} block={block} onRemoveBlock={removeBlock} onChanged={refresh} />
      ))}

      {addingBlock ? (
        <div className="card" style={{ marginTop: 10 }}>
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, background: "#121617", color: "#F2EFE6", border: "1px solid rgba(242,239,230,0.2)" }}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={addBlock}>Add section</button>
            <button className="btn-ghost" onClick={() => setAddingBlock(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => setAddingBlock(true)}>
          + Add section
        </button>
      )}
    </div>
  );
}

function BlockEditor({ block, onRemoveBlock, onChanged }) {
  const [addingExercise, setAddingExercise] = useState(false);
  const [form, setForm] = useState({ name: "", sets: 3, reps: "8-10", load: "", rest: 60, superset: false, notes: "" });

  const groups = groupExercises(block.exercises);

  async function addExercise() {
    if (!form.name.trim()) return;
    const sortOrder = block.exercises.length;
    let supersetGroup = null;

    const last = block.exercises[block.exercises.length - 1];
    if (form.superset && last) {
      if (last.superset_group != null) {
        supersetGroup = last.superset_group;
      } else {
        supersetGroup = Date.now();
        await supabase.from("workout_exercises").update({ superset_group: supersetGroup }).eq("id", last.id);
      }
    }

    await supabase.from("workout_exercises").insert({
      block_id: block.id,
      name: form.name.trim(),
      prescribed_sets: Number(form.sets) || 1,
      prescribed_reps: form.reps,
      prescribed_load: form.load,
      rest_seconds: form.rest ? Number(form.rest) : null,
      notes: form.notes,
      superset_group: supersetGroup,
      sort_order: sortOrder,
    });

    setForm({ name: "", sets: 3, reps: "8-10", load: "", rest: 60, superset: false, notes: "" });
    setAddingExercise(false);
    onChanged();
  }

  async function removeExercise(id) {
    await supabase.from("workout_exercises").delete().eq("id", id);
    onChanged();
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {CATEGORY_LABELS[block.category]}
        </div>
        <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => onRemoveBlock(block.id)}>Remove section</button>
      </div>

      {groups.map((g, i) => (
        <div key={i} style={{ marginBottom: 10, border: g.items.length > 1 ? "1px dashed rgba(232,185,77,0.4)" : "none", borderRadius: 8, padding: g.items.length > 1 ? 8 : 0 }}>
          {g.items.length > 1 && <div className="muted" style={{ fontSize: 11, marginBottom: 6, color: "#E8B94D" }}>SUPERSET</div>}
          {g.items.map((ex) => (
            <ExerciseEditor key={ex.id} exercise={ex} onRemove={() => removeExercise(ex.id)} role="trainer" />
          ))}
        </div>
      ))}

      {addingExercise ? (
        <div style={{ marginTop: 8, padding: 10, background: "#171B1C", borderRadius: 8 }}>
          <input placeholder="Exercise name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input placeholder="Sets" type="number" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
            <input placeholder="Reps (e.g. 8-10)" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input placeholder="Load (e.g. 135 lbs)" value={form.load} onChange={(e) => setForm({ ...form, load: e.target.value })} />
            <input placeholder="Rest (sec)" type="number" value={form.rest} onChange={(e) => setForm({ ...form, rest: e.target.value })} />
          </div>
          <input placeholder="Notes / cues (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginBottom: 6 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={form.superset} onChange={(e) => setForm({ ...form, superset: e.target.checked })} />
            Part of a superset with the exercise above
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={addExercise}>Add exercise</button>
            <button className="btn-ghost" onClick={() => setAddingExercise(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => setAddingExercise(true)}>+ Add exercise</button>
      )}
    </div>
  );
}

function ExerciseEditor({ exercise, onRemove, role }) {
  const setNumbers = Array.from({ length: exercise.prescribed_sets }, (_, i) => i + 1);

  async function logSet(setNumber, patch) {
    await upsertSet(exercise.id, setNumber, patch, role);
  }

  return (
    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(242,239,230,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{exercise.name}</div>
          <div className="muted">
            {exercise.prescribed_sets} × {exercise.prescribed_reps}
            {exercise.prescribed_load ? ` · ${exercise.prescribed_load}` : ""}
            {exercise.rest_seconds ? ` · rest ${exercise.rest_seconds}s` : ""}
          </div>
          {exercise.notes && <div className="muted" style={{ fontStyle: "italic" }}>{exercise.notes}</div>}
        </div>
        {onRemove && <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={onRemove}>✕</button>}
      </div>

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
                placeholder="RPE" defaultValue={existing.actual_rpe || ""}
                onBlur={(e) => logSet(num, { actual_rpe: e.target.value })}
                style={{ padding: "6px 8px", fontSize: 13, width: 60 }}
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
