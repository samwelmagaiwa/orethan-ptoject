import { useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    return email.trim() !== "" && password.trim() !== "" && !loading;
  }, [email, password, loading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.post(
        `${API_BASE}/login`,
        {
          email: email.trim(),
          password: password.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      console.log("LOGIN RESPONSE:", res.data);

      // SAVE TOKEN
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      }

      // SAVE USER
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }

      // Dashboard (repayment tracker) is the default entry after login
      navigate("/repayment-tracker");
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);

      if (err.response?.status === 401) {
        setError("Invalid email or password");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Server error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modern">
      <div className="animated-bg"></div>

      <div className="login-container">
        {/* LEFT */}
        <div className="welcome-section">
          <h1>
            Welcome Back <span>Loan System</span>
          </h1>

          <p>
            Login to continue managing loans, approvals and users.
          </p>
        </div>

        {/* RIGHT */}
        <div className="login-card">
          <h2>Sign In</h2>

          <form onSubmit={handleLogin}>
            {error && <div className="error">{error}</div>}

            <div className="input-group">
              <label>Email</label>

              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>

              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={!canSubmit}
            >
              {loading ? "Signing in..." : "Login"}
            </button>

            <div className="register-link">
              Don&apos;t have account?{" "}
              <Link to="/register">Register</Link>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        *{
          margin:0;
          padding:0;
          box-sizing:border-box;
        }

        .login-modern{
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:20px;
          overflow:hidden;
          position:relative;
          font-family:Arial, Helvetica, sans-serif;
        }

        .animated-bg{
          position:fixed;
          inset:0;
          background:linear-gradient(135deg,#0f172a,#1e293b,#312e81);
          z-index:-1;
        }

        .login-container{
          width:100%;
          max-width:1100px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:40px;
          align-items:center;
        }

        .welcome-section{
          color:white;
        }

        .welcome-section h1{
          font-size:52px;
          margin-bottom:20px;
          line-height:1.2;
        }

        .welcome-section span{
          color:#a78bfa;
        }

        .welcome-section p{
          color:#cbd5e1;
          font-size:18px;
          line-height:1.7;
        }

        .login-card{
          background:rgba(255,255,255,0.08);
          border:1px solid rgba(255,255,255,0.1);
          backdrop-filter:blur(15px);
          border-radius:24px;
          padding:40px;
          color:white;
        }

        .login-card h2{
          margin-bottom:30px;
          font-size:32px;
        }

        form{
          display:flex;
          flex-direction:column;
          gap:20px;
        }

        .input-group{
          display:flex;
          flex-direction:column;
          gap:8px;
        }

        .input-group label{
          font-size:14px;
          color:#e2e8f0;
        }

        .input-group input{
          width:100%;
          padding:14px;
          border:none;
          border-radius:12px;
          background:rgba(255,255,255,0.1);
          color:white;
          font-size:15px;
          outline:none;
        }

        .input-group input::placeholder{
          color:#94a3b8;
        }

        .password-wrapper{
          position:relative;
        }

        .toggle-btn{
          position:absolute;
          top:50%;
          right:12px;
          transform:translateY(-50%);
          background:none;
          border:none;
          color:#a78bfa;
          cursor:pointer;
          font-size:13px;
        }

        .login-btn{
          padding:14px;
          border:none;
          border-radius:12px;
          background:linear-gradient(135deg,#6366f1,#8b5cf6);
          color:white;
          font-size:16px;
          font-weight:bold;
          cursor:pointer;
          transition:0.3s;
        }

        .login-btn:hover{
          transform:translateY(-2px);
        }

        .login-btn:disabled{
          opacity:0.6;
          cursor:not-allowed;
        }

        .error{
          background:rgba(239,68,68,0.15);
          border:1px solid rgba(239,68,68,0.3);
          color:#fca5a5;
          padding:12px;
          border-radius:10px;
          font-size:14px;
        }

        .register-link{
          text-align:center;
          font-size:14px;
          color:#cbd5e1;
        }

        .register-link a{
          color:#a78bfa;
          text-decoration:none;
          font-weight:bold;
        }

        @media(max-width:900px){
          .login-container{
            grid-template-columns:1fr;
          }

          .welcome-section{
            text-align:center;
          }

          .welcome-section h1{
            font-size:40px;
          }
        }

        @media(max-width:500px){
          .login-card{
            padding:25px;
          }

          .welcome-section h1{
            font-size:32px;
          }
        }
      `}</style>
    </div>
  );
}

export default Login;