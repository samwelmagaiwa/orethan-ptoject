import { useState, useEffect } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";

function EmployeeLoan() {
  const [form, setForm] = useState({
    employer: "",
    employeeId: "",
    amount: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");

  useEffect(() => {
    const saved = localStorage.getItem("employee_loan_draft");
    if (saved) setForm(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("employee_loan_draft", JSON.stringify(form));
  }, [form]);

  const showAlert = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
  };

  const validateField = (name: string, value: string) => {
    let error = "";
    if (!value) {
      error = "Sehemu hii inahitajika";
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: value,
    });
    validateField(name, value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let hasError = false;
    Object.keys(form).forEach(key => {
      const error = validateField(key, (form as any)[key]);
      if (error) hasError = true;
    });

    if (hasError) return;

    try {
      setLoading(true);

      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.post(
        `${API_BASE}/loans`,
        {
          name: form.employer,
          amount: form.amount,
          type: "employee",

          details: {
            employeeId: form.employeeId,
          },
        }
      );

      console.log(res.data);

      showAlert("Loan submitted successfully", "success");

      setForm({
        employer: "",
        employeeId: "",
        amount: "",
      });

    } catch (error: any) {
      console.log(error.response?.data || error.message);

      showAlert(error.response?.data?.message || "Failed to submit loan", "error");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">

      <div className="card">

        <div className="header">
          <h1>Employee Loan</h1>
          <p>Submit loan request for employee</p>
        </div>

        <form onSubmit={handleSubmit} className="form">

          <div className="input-box">
            <input
              name="employer"
              className={errors.employer ? "input-error" : ""}
              value={form.employer}
              onChange={handleChange}
              placeholder="Mfano: Wizara ya Elimu"
            />
            <label>Employer Name</label>
            {errors.employer && <span className="error-text">{errors.employer}</span>}
          </div>

          <div className="input-box">
            <input
              name="employeeId"
              className={errors.employeeId ? "input-error" : ""}
              value={form.employeeId}
              onChange={handleChange}
              placeholder="Mfano: EMP12345"
            />
            <label>Employee ID</label>
            {errors.employeeId && <span className="error-text">{errors.employeeId}</span>}
          </div>

          <div className="input-box">
            <input
              name="amount"
              className={errors.amount ? "input-error" : ""}
              value={form.amount}
              onChange={handleChange}
              placeholder="Mfano: 500,000"
            />
            <label>Loan Amount (TZS)</label>
            {errors.amount && <span className="error-text">{errors.amount}</span>}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Application"}
          </button>

        </form>

      </div>

      <style>{`
        .page {
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          padding: 20px;
        }

        .card {
          width: 420px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
          border-radius: 18px;
          padding: 30px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
          color: white;
        }

        .header h1 {
          margin: 0;
          font-size: 22px;
        }

        .header p {
          font-size: 13px;
          opacity: 0.7;
          margin-bottom: 20px;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .input-box {
          position: relative;
        }

        input {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          outline: none;
          background: #ffffff !important;
          color: #1e293b !important;
        }

        .input-error {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }

        input:focus {
          box-shadow: 0 0 0 2px #22d3ee;
        }

        label {
          position: absolute;
          left: 12px;
          top: 14px;
          color: #94a3b8;
          transition: 0.2s;
          pointer-events: none;
        }

        input:focus + label,
        input:not(:placeholder-shown) + label {
          top: -10px;
          left: 10px;
          font-size: 11px;
          background: #0f172a;
          padding: 0 6px;
          color: #22d3ee;
        }

        button {
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(90deg, #6366f1, #22d3ee);
          color: white;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>

      <AlertModal
        isOpen={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default EmployeeLoan;