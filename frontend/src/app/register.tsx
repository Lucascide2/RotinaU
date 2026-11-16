// app/register.tsx
import { useRouter } from "expo-router";
import { RegisterScreen } from "@/components/register-screen";

export default function Register() {
  const router = useRouter();
  return <RegisterScreen onGoLogin={() => router.replace("/login")} />;
}