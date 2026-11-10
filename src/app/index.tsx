// app/index.tsx
// Substitui src/routes/index.tsx. Os `head()`/meta tags foram descartados (não existem no mobile).
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Shell } from "../components/ui";
import { IntroScreen } from "../components/intro-screen";
import { AvailabilityScreen } from "../components/availability-screen";
import { SubjectsScreen } from "../components/subjects-screen";
import { RoutineScreen } from "../components/routine-screen";
import { defaultState, prepareWeeks, type State } from "../lib/rotina";
import { reportError } from "../lib/error-reporting";

const KEY = "rotinau-v1";

export default function Index() {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Carrega do AsyncStorage (assíncrono, diferente do localStorage).
  useEffect(() => {
    let alive = true;
    (async () => {
      let s: State;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        s = raw ? (JSON.parse(raw) as State) : defaultState();
      } catch {
        s = defaultState();
      }
      if (!s?.days) s = defaultState();
      if (alive) setState(prepareWeeks(s, new Date()));
    })();

    const t = setInterval(() => setNow(new Date()), 60000);

    // Timers pausam em segundo plano: ao voltar ao app, atualiza o relógio
    // e garante que a semana atual (e a próxima) existam.
    const sub = AppState.addEventListener("change", (status) => {
      if (status !== "active") return;
      const d = new Date();
      setNow(d);
      setState((s) => (s ? prepareWeeks(s, d) : s));
    });

    return () => {
      alive = false;
      clearInterval(t);
      sub.remove();
    };
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
        <View />
      </Shell>
    );
  }

  const update = (p: Partial<State>) =>
    setState((s) => (s ? prepareWeeks({ ...s, ...p }, new Date()) : s));

  return (
    <Shell>
      {state.step === "intro" && (
        <IntroScreen onStart={() => update({ step: state.sessions.length ? "routine" : "availability" })} />
      )}
      {state.step === "availability" && <AvailabilityScreen state={state} update={update} />}
      {state.step === "subjects" && <SubjectsScreen state={state} update={update} />}
      {state.step === "routine" && <RoutineScreen state={state} update={update} now={now} />}
    </Shell>
  );
}