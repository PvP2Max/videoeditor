import { redirect } from "next/navigation";
import LoginForm from "../../components/login-form";
import { getSession } from "../../lib/auth";

export default function LoginPage() {
  if (getSession()) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl shadow-slate-900/40">
      <h1 className="text-2xl font-semibold text-white">Admin Login</h1>
      <p className="mt-2 text-sm text-slate-400">
        Enter the admin password to access the video editor dashboard.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
