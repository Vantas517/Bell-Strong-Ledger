import { supabase } from "./supabaseClient";

export const CATEGORY_ORDER = { warmup: 0, working: 1, conditioning: 2, cooldown: 3 };
export const CATEGORY_LABELS = {
  warmup: "Warm-up / Movement Prep",
  working: "Working Phase",
  conditioning: "Conditioning",
  cooldown: "Cooldown / Stretch",
};

// Loads a workout and everything inside it (blocks -> exercises -> logged sets)
// and returns it as one nested object, ready to render.
export async function loadWorkoutData(workoutId) {
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle();
  if (!workout) return null;

  const { data: blocks } = await supabase
    .from("workout_blocks")
    .select("*")
    .eq("workout_id", workoutId)
    .order("sort_order", { ascending: true });

  const blockIds = (blocks || []).map((b) => b.id);

  let exercises = [];
  if (blockIds.length) {
    const { data } = await supabase
      .from("workout_exercises")
      .select("*")
      .in("block_id", blockIds)
      .order("sort_order", { ascending: true });
    exercises = data || [];
  }

  const exerciseIds = exercises.map((e) => e.id);
  let sets = [];
  if (exerciseIds.length) {
    const { data } = await supabase
      .from("logged_sets")
      .select("*")
      .in("workout_exercise_id", exerciseIds)
      .order("set_number", { ascending: true });
    sets = data || [];
  }

  const blocksSorted = [...(blocks || [])].sort(
    (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.sort_order - b.sort_order
  );

  const nested = blocksSorted.map((block) => ({
    ...block,
    exercises: exercises
      .filter((e) => e.block_id === block.id)
      .map((ex) => ({ ...ex, sets: sets.filter((s) => s.workout_exercise_id === ex.id) })),
  }));

  return { ...workout, blocks: nested };
}

// Groups consecutive exercises that share a superset_group so they render together.
export function groupExercises(exercises) {
  const groups = [];
  let current = null;
  for (const ex of exercises) {
    if (ex.superset_group != null && current && current.group === ex.superset_group) {
      current.items.push(ex);
    } else {
      current = { group: ex.superset_group, items: [ex] };
      groups.push(current);
    }
  }
  return groups;
}

// Writes (or updates) one actual set entry. Either the trainer or the client can call this.
export async function upsertSet(exerciseId, setNumber, patch, loggedBy) {
  const { error } = await supabase
    .from("logged_sets")
    .upsert(
      { workout_exercise_id: exerciseId, set_number: setNumber, logged_by: loggedBy, logged_at: new Date().toISOString(), ...patch },
      { onConflict: "workout_exercise_id,set_number" }
    );
  return error;
}
