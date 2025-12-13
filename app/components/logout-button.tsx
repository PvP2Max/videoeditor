"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { csrfToken: string };

const LogoutButton = ({ csrfToken }: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/logout", {
      method: "POST",
      headers: {
        "x-csrf-token": csrfToken
      }
    });
    setLoading(false);
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 transition hover:border-emerald-400 hover:text-white disabled:opacity-60"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
};

export default LogoutButton;
