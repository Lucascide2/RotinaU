// app/index.tsx
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Shell } from "../components/ui";
import { IntroScreen } from "../components/intro-screen";
import { AvailabilityScreen } from "../components/availability-screen";
import { SubjectsScreen } from "../components/subjects-screen";
import { RoutineScreen } from "../components/routine-screen";
import { defaultState, needsWeeks, prepareWeeks, type State } from "../lib/rotina";
import { reportError } from "../lib/error-reporting";
import { prepareWeeksLLM } from "@/lib/rotina-ai";
import { useAuth } from "@/components/auth-context";
import { LoginScreen } from "@/components/login-screen";
import { RegisterScreen } from "@/components/register-screen"; // ajuste o caminho

const LEGACY_KEY = "rotinau-v1"; // chave antiga (única, sem usuário), usada só na migração

type AuthView = "intro" | "login" | "register";

function Splash({ message }: { message?: string }) {
  return (
    <Shell>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator size="large" />
        {message ? <Text>{message}</Text> : null}
      </View>
    </Shell>
  );
}

export default function Index() {
  const { ready, isAuthenticated, user } = useAuth();

  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [authView, setAuthView] = useState<AuthView>("intro");
  const [preparing, setPreparing] = useState(false);

  const stateRef = useRef<State | null>(null);
  stateRef.current = state;

  // Cada conta tem o seu registro. Sem usuário logado, não há chave.
  const storageKey = isAuthenticated && user?.id ? `rotinau-v1:${user.id}` : null;
  const loadedKeyRef = useRef<string | null>(null);

  // Ao deslogar, volta para a apresentação.
  useEffect(() => {
    if (!isAuthenticated) setAuthView("intro");
  }, [isAuthenticated]);

  // Ao logar, nunca fica na intro: vai para a rotina (ou disponibilidade, se ainda não há sessões).
  useEffect(() => {
    if (isAuthenticated && state?.step === "intro") {
      setState((s) =>
        s ? prepareWeeks({ ...s, step: s.sessions.length ? "routine" : "availability" }, new Date()) : s,
      );
    }
  }, [isAuthenticated, state?.step]);

  // Carrega o estado da conta atual e mantém o relógio e o AppState.
  useEffect(() => {
    if (!storageKey) {
      loadedKeyRef.current = null;
      setState(null);
      return;
    }

    setState(null); // não mostra os dados do usuário anterior
    loadedKeyRef.current = null;
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
      let readOk = true;
      try {
        let raw = await AsyncStorage.getItem(storageKey);

        // Migração única: se a chave nova está vazia e há dado na chave antiga, adota-o.
        if (!raw) {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy) {
            raw = legacy;
            await AsyncStorage.setItem(storageKey, legacy);
            await AsyncStorage.removeItem(LEGACY_KEY);
          }
        }
        s = raw ? (JSON.parse(raw) as State) : defaultState();
      } catch (e) {
        readOk = false;
        reportError(e, { boundary: "load_state" });
        s = defaultState();
      }
      if (!s?.days) s = defaultState();

      let prepared: State;
      try {
        prepared = await prepare(s, new Date());
      } catch (e) {
        if (!alive) return;
        reportError(e, { boundary: "prepare_state" });
        prepared = prepareWeeks(s, new Date()); // fallback sem LLM
      }
      if (!alive) return;

      // Se a leitura falhou, não libera a gravação, para não sobrescrever os dados salvos.
      loadedKeyRef.current = readOk ? storageKey : null;
      setState(prepared);
    })();

    const t = setInterval(() => setNow(new Date()), 60000);

    const sub = AppState.addEventListener("change", async (status) => {
      if (status !== "active") return;
      const d = new Date();
      setNow(d);
      const base = stateRef.current;
      if (!base) return;
      try {
        const prepared = await prepare(base, d);
        if (alive) setState((cur) => (cur === base ? prepared : cur));
      } catch (e) {
        reportError(e, { boundary: "prepare_on_resume" });
      }
    });

    return () => {
      alive = false;
      ctrl.abort();
      clearInterval(t);
      sub.remove();
    };
  }, [storageKey]);

  // Persiste a cada mudança (só depois de carregado, e só na chave da conta atual).
  useEffect(() => {
    if (!state || !storageKey || loadedKeyRef.current !== storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch((e) =>
      reportError(e, { boundary: "persist_state" }),
    );
  }, [state, storageKey]);

  // ---------- Renderização (nenhum hook abaixo desta linha) ----------

  if (!ready) return <Splash />;

  if (!isAuthenticated) {
    return (
      <Shell>
        {authView === "intro" && <IntroScreen onStart={() => setAuthView("login")} />}
        {authView === "login" && <LoginScreen onGoRegister={() => setAuthView("register")} />}
        {authView === "register" && <RegisterScreen onGoLogin={() => setAuthView("login")} />}
      </Shell>
    );
  }

  if (!state) return <Splash message={preparing ? "Preparando sua rotina da semana…" : undefined} />;

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
            },
          ]}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff" }}>Gerando a nova semana…</Text>
        </View>
      )}
    </>
  );
}