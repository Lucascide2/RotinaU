// app/index.tsx
// Substitui src/routes/index.tsx. Os `head()`/meta tags foram descartados (não existem no mobile).
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Shell } from "../components/ui";
import { IntroScreen } from "../components/intro-screen";
import { AvailabilityScreen } from "../components/availability-screen";
import { SubjectsScreen } from "../components/subjects-screen";
import { RoutineScreen } from "../components/routine-screen";
import { defaultState, needsWeeks, prepareWeeks, type State } from "../lib/rotina";
import { reportError } from "../lib/error-reporting";
import { prepareWeeksLLM } from "@/lib/rotina-ai";

const KEY = "rotinau-v1";

export default function Index() {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Carrega do AsyncStorage (assíncrono, diferente do localStorage).
  const [preparing, setPreparing] = useState(false);
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;
  
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
  
    const prepare = async (base: State, d: Date): Promise<State> => {
      if (!needsWeeks(base, d)) return prepareWeeks(base, d); // rápido, sem LLM
      if (alive) setPreparing(true);
      try {
        return await prepareWeeksLLM(base, d, ctrl.signal);
      } finally {
        if (alive) setPreparing(false);
      }
    };
  
    (async () => {
      let s: State;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        s = raw ? (JSON.parse(raw) as State) : defaultState();
      } catch {
        s = defaultState();
      }
      if (!s?.days) s = defaultState();
      const prepared = await prepare(s, new Date());
      if (alive) setState(prepared);
    })();
  
    const t = setInterval(() => setNow(new Date()), 60000);
  
    const sub = AppState.addEventListener("change", async (status) => {
      if (status !== "active") return;
      const d = new Date();
      setNow(d);
      const base = stateRef.current;
      if (!base) return;
      const prepared = await prepare(base, d);
      if (alive) setState((cur) => (cur === base ? prepared : cur));
    });
  
    return () => { alive = false; ctrl.abort(); clearInterval(t); sub.remove(); };
  }, []);

  // Persiste a cada mudança (só depois de carregado).
  useEffect(() => {
    if (!state) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) =>
      reportError(e, { boundary: "persist_state" }),
    );
  }, [state]);

  if (!state) {
    return (
      <Shell>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" />
          {preparing && <Text>Preparando sua rotina da semana…</Text>}
        </View>
      </Shell>
    );
  }

  const update = (p: Partial<State>) =>
    setState((s) => (s ? prepareWeeks({ ...s, ...p }, new Date()) : s));

  return (
    <>
      <Shell>
        {state.step === "intro" && (
          <IntroScreen onStart={() => update({ step: state.sessions.length ? "routine" : "availability" })} />
        )}
        {state.step === "availability" && <AvailabilityScreen state={state} update={update} />}
        {state.step === "subjects" && <SubjectsScreen state={state} update={update} />}
        {state.step === "routine" && <RoutineScreen state={state} update={update} now={now} />}
      </Shell>

      {preparing && (
        <View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
              gap: 12,
            }
          ]}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff" }}>Gerando a nova semana…</Text>
        </View>
      )}
  </>
  );
}