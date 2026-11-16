// app/login.tsx
import { useRouter } from "expo-router";
import { LoginScreen } from "@/components/login-screen";

export default function Login() {
  const router = useRouter();
  return <LoginScreen onGoRegister={() => router.push("/register")} />;
}