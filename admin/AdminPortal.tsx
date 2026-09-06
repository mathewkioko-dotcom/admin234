import React from "react";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { Profile } from "../types";
import { isAdminUser } from "./adminAccess";
import { AdminWorkspace } from "./AdminWorkspace";

interface AdminPortalProps {
  currentUser: Profile;
  onBack: () => void;
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onBack,
  onLogout,
}) => {
  if (!isAdminUser(currentUser)) {
    return (
      <main className="min-h-screen bg-[#081014] px-6 py-16 text-slate-100">
        <section className="mx-auto max-w-lg border border-rose-400/30 bg-rose-400/10 p-8 text-center">
          <CircleAlert className="mx-auto mb-4 h-10 w-10 text-rose-300" />
          <h1 className="text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-400">
            This account is not authorized to enter the operations workspace.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-400 hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" /> Back to HeyLook
          </button>
        </section>
      </main>
    );
  }

  return (
    <AdminWorkspace
      currentUser={currentUser}
      onBack={onBack}
      onLogout={onLogout}
    />
  );
};
