import { useState, FormEvent } from "react";
import { User, Link, Hash, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

interface RegistrationFormProps {
  onRegisterSuccess: () => void;
}

export default function RegistrationForm({ onRegisterSuccess }: RegistrationFormProps) {
  const [name, setName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [regNo, setRegNo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !handleInput.trim() || !regNo.trim()) {
      setError("Please fill in all the required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          handleInput: handleInput.trim(),
          regNo: regNo.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred during registration.");
      }

      setSuccess(`Congratulations! Student "${data.student.name}" (Handle: ${data.student.handle}) was successfully registered to SUST 25 Database!`);
      setName("");
      setHandleInput("");
      setRegNo("");
      onRegisterSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="register-panel" className="bg-cyber-panel neon-border-cyan rounded-xl p-6 md:p-8 relative overflow-hidden transition-all duration-300">
      {/* Absolute faint glowing backing */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-cyan/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10">
        <h2 className="text-xl font-bold tracking-wider text-white flex items-center gap-2 uppercase mb-1">
          <span className="w-1.5 h-6 bg-cyber-cyan inline-block rounded-sm animate-pulse"></span>
          Register Student
        </h2>
        <p className="text-gray-400 text-sm mb-6 font-mono">
          JOIN SUST 25 CODEFORCES BATTLEFIELD
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-sm flex gap-3 items-start font-mono">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold uppercase tracking-tight text-red-400">
                {error.toLowerCase().includes("already registered") || error.toLowerCase().includes("duplicate")
                  ? "Registration Duplicate"
                  : error.toLowerCase().includes("invalid characters") || error.toLowerCase().includes("criteria") || error.toLowerCase().includes("parse")
                  ? "Invalid Handle Format"
                  : error.toLowerCase().includes("required") || error.toLowerCase().includes("fill")
                  ? "Missing Fields"
                  : error.toLowerCase().includes("not found") || error.toLowerCase().includes("exist")
                  ? "Codeforces Handle Not Found"
                  : "Verification Protocol Failed"}
              </p>
              <p className="text-red-200/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-950/40 border border-cyber-green/30 text-green-300 text-sm flex gap-3 items-start font-mono">
            <CheckCircle2 className="w-5 h-5 text-cyber-green shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold uppercase tracking-tight text-cyber-green">Register Complete</p>
              <p className="text-green-200/80 mt-1">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student Name */}
          <div>
            <label className="block text-xs font-semibold tracking-widest text-cyber-cyan uppercase mb-2 font-mono">
              Student Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <User className="w-4 h-4" />
              </span>
              <input
                id="input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nilkontha Das"
                className="w-full bg-cyber-dark/80 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-800 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan text-sm font-mono tracking-wide placeholder-gray-600 transition-all duration-200"
                required
              />
            </div>
          </div>

          {/* Registration Number */}
          <div>
            <label className="block text-xs font-semibold tracking-widest text-cyber-cyan uppercase mb-2 font-mono">
              Registration Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Hash className="w-4 h-4" />
              </span>
              <input
                id="input-reg"
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. 2025331001"
                className="w-full bg-cyber-dark/80 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-800 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan text-sm font-mono tracking-wide placeholder-gray-600 transition-all duration-200"
                required
              />
            </div>
          </div>

          {/* Codeforces Link or Handle */}
          <div>
            <label className="block text-xs font-semibold tracking-widest text-cyber-cyan uppercase mb-2 font-mono">
              Codeforces Handle / Link
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Link className="w-4 h-4" />
              </span>
              <input
                id="input-handle"
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="e.g. tourist OR cf.com/profile/tourist"
                className="w-full bg-cyber-dark/80 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-800 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan text-sm font-mono tracking-wide placeholder-gray-600 transition-all duration-200"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5 font-mono">
              We verify and download real-time credentials from Codeforces Database.
            </p>
          </div>

          {/* Submit button */}
          <button
            id="register-submit-btn"
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 px-4 rounded-lg font-bold font-mono text-sm tracking-widest uppercase transition-all duration-300 relative group overflow-hidden ${
              isLoading
                ? "bg-cyber-dark border border-cyber-cyan/30 text-gray-400 cursor-not-allowed"
                : "bg-cyber-cyan/10 border border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan hover:text-cyber-dark hover:shadow-neon-cyan cursor-pointer"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-cyber-cyan" />
                VERIFYING & INITIALIZING...
              </span>
            ) : (
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                EXECUTE REGISTRATION
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
