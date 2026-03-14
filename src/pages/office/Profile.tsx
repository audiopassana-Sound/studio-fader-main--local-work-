import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Profile = () => {
  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
        <Link
          to="/office"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to The Office
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-cyan-300">Account & Profile</h1>
        <p className="mt-3 text-sm text-slate-400">Profile controls will live here.</p>
      </div>
    </div>
  );
};

export default Profile;
