import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ProjectForm from "../../components/project-form";
import { CSRF_COOKIE, getSession } from "../../lib/auth";

export default function NewProjectPage() {
  if (!getSession()) {
    redirect("/login");
  }
  const csrf = cookies().get(CSRF_COOKIE)?.value ?? "";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-slate-900/40">
      <h1 className="text-3xl font-semibold text-white">New Project</h1>
      <p className="mt-2 text-sm text-slate-400">
        Name the project, describe the desired vibe, and pick style/output presets. Upload media after creation.
      </p>
      <div className="mt-6">
        <ProjectForm csrfCookie={csrf} />
      </div>
    </div>
  );
}
