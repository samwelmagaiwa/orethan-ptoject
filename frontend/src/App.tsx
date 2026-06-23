import { BrowserRouter, Routes, Route, Navigate, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import LoadingScreen from "./components/LoadingScreen";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import GroupLoan from "./pages/GroupLoan";
import PersonalLoan from "./pages/PersonalLoan";
import logo from "./assets/logo.png";

import Users from "./pages/Users";

import LoanManager from "./pages/LoanManager";
import GeneralManager from "./pages/GeneralManager";
import ManagingDirector from "./pages/ManagingDirector";
import MyLoans from "./pages/MyLoans";

import RepaymentTracker from "./pages/RepaymentTracker";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import LoanRepayments from "./pages/LoanRepayments";
import DisburseLoan from "./pages/DisburseLoan";

// =========================
// AXIOS INTERCEPTORS
// =========================
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Only set application/json if not sending FormData
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// =========================
// MICROFINANCE CALCULATOR COMPONENT
// =========================
function MicrofinanceCalculator({ setLoading, setSyncMessages }: { setLoading: (l: boolean) => void, setSyncMessages: (m: string[]) => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromLoan = searchParams.get("fromLoan") === "true";

  const [loanAmount, setLoanAmount] = useState<number>(1000000);
  const [loanPeriod, setLoanPeriod] = useState<number>(12);
  const [repaymentFrequency, setRepaymentFrequency] = useState<string>("Monthly");
  const [interestType, setInterestType] = useState<string>("Declining Balance");
  const [interestRate, setInterestRate] = useState<number>(3);
  const [processingFee, setProcessingFee] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>("2026-06-27");
  const [income, setIncome] = useState<string>("");
  const [expenses, setExpenses] = useState<string>("");

  const [monthlyPayment, setMonthlyPayment] = useState<number>(0);
  const [totalPayment, setTotalPayment] = useState<number>(0);
  const [totalInterest, setTotalInterest] = useState<number>(0);
  const [totalFee, setTotalFee] = useState<number>(0);

  useEffect(() => {
    // Pre-populate from draft if exists
    if (fromLoan) {
      const draft = localStorage.getItem("personal_loan_draft");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.form?.wastaniKipatoKwaMwezi) setIncome(parsed.form.wastaniKipatoKwaMwezi);
          if (parsed.form?.wastaniMatumiziKwaMwezi) setExpenses(parsed.form.wastaniMatumiziKwaMwezi);
          if (parsed.form?.kiasiMkopo) setLoanAmount(Number(parsed.form.kiasiMkopo.replace(/[^0-9]/g, '')) || 1000000);
        } catch (e) {
          console.error("Draft parsing error", e);
        }
      }
    }
  }, [fromLoan]);

  useEffect(() => {
    calculateLoan();
  }, [loanAmount, loanPeriod, interestRate, processingFee, interestType, repaymentFrequency, income, expenses]);

  const [sustainability, setSustainability] = useState<{ isSustainable: boolean; dti: number; message: string; suggestedMax: number } | null>(null);

  const calculateLoan = () => {
    let installmentsPerMonth = 1;
    if (repaymentFrequency === "Weekly") installmentsPerMonth = 4.33;
    else if (repaymentFrequency === "Bi-Weekly") installmentsPerMonth = 2.165;
    else if (repaymentFrequency === "Daily") installmentsPerMonth = 30;
    else if (repaymentFrequency === "Quarterly") installmentsPerMonth = 1 / 3;

    const totalInstallments = Math.max(1, Math.round(loanPeriod * installmentsPerMonth));
    let installmentAmount = 0;

    if (interestType === "Declining Balance") {
      const ratePerInstallment = (interestRate / 100) / installmentsPerMonth;
      if (ratePerInstallment > 0) {
        installmentAmount = loanAmount * ratePerInstallment * Math.pow(1 + ratePerInstallment, totalInstallments) / (Math.pow(1 + ratePerInstallment, totalInstallments) - 1);
      } else {
        installmentAmount = loanAmount / totalInstallments;
      }
    } else {
      const totalInterestFlat = loanAmount * (interestRate / 100) * loanPeriod;
      installmentAmount = (loanAmount + totalInterestFlat) / totalInstallments;
    }

    const totalLoanPayment = installmentAmount * totalInstallments;
    const interest = totalLoanPayment - loanAmount;
    const fee = (loanAmount * processingFee) / 100;

    setMonthlyPayment(installmentAmount);
    setTotalPayment(totalLoanPayment + fee);
    setTotalInterest(interest);
    setTotalFee(fee);

    // Sustainability Calculation
    if (fromLoan && income && expenses) {
      const netIncome = Number(income) - Number(expenses);
      const monthlyPaymentEquivalent = installmentAmount * installmentsPerMonth;
      const dti = netIncome > 0 ? (monthlyPaymentEquivalent / netIncome) * 100 : 1000;

      let message = "";
      let suggestedMax = 0;

      if (dti > 40) {
        // Find max loan where monthly_repayment = netIncome * 0.4
        const targetMonthly = netIncome * 0.4;
        const targetInstallment = targetMonthly / installmentsPerMonth;

        // Simple back-calculation for flat rate approximation or declining
        // Using flat rate for safe suggestion: kiasi * (1 + rate*months) / installments = target
        const rateFactor = 1 + (interestRate / 100) * loanPeriod;
        suggestedMax = (targetInstallment * totalInstallments) / rateFactor;

        if (dti > 60) message = "HATARI: Mkopo huu ni mkubwa mno kulinganisha na kipato chako. Tafadhali punguza kiasi au ongeza muda.";
        else message = "ONYO: Rejesho hili linazidi 40% ya kipato chako cha ziada. Tunashauri kupunguza kiasi.";
      }

      setSustainability({
        isSustainable: dti <= 40,
        dti,
        message,
        suggestedMax: Math.floor(suggestedMax / 1000) * 1000
      });
    } else {
      setSustainability(null);
    }
  };

  const handleApply = async () => {
    if (sustainability && sustainability.dti > 60) {
      alert("Samahani, mkopo huu hauwezi kuendelea kwa sasa kwa kuwa unazidi uwezo wako wa kulipa (DTI > 60%). Tafadhali rekebisha kiasi cha mkopo.");
      return;
    }

    const token = localStorage.getItem("token");
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

    const calculatorFields = {
      wastaniKipatoKwaMwezi: income,
      wastaniMatumiziKwaMwezi: expenses,
      kiasiMkopo: loanAmount.toString(),
      mudaKulipaMkopo: `Miezi ${loanPeriod}`,
      kwaTarakimu: loanPeriod.toString(),
      kiasiRejeshoBilaMatatizo: Math.round(monthlyPayment).toString(),
      repaymentFrequency: repaymentFrequency // Pass the original frequency key
    };

    // Merge with existing backend draft if user is logged in
    let mergedForm = calculatorFields;
    let targetStep = 2;

    setSyncMessages(["Inasawazisha taarifa...", "Inatunza draft yako...", "Tunatayarisha fomu...", "Karibu ORETHAN!"]);
    setLoading(true);

    // Give it a tiny moment to show the loader before heavy logic
    await new Promise(r => setTimeout(r, 100));

    try {
      if (token) {
        const res = await axios.get(`${API_BASE}/drafts/personal`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.draft?.form) {
          mergedForm = { ...res.data.draft.form, ...calculatorFields };
          targetStep = res.data.draft.step ?? 2;
        }
        // Save merged draft back to backend
        await axios.post(`${API_BASE}/drafts`, {
          type: 'personal',
          data: mergedForm,
          step: targetStep,
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (e) {
      console.error("Draft merge error", e);
    }

    // Set light localStorage bridge for the isReturningFromCalculator flag
    localStorage.setItem("personal_loan_draft", JSON.stringify({
      form: calculatorFields, // only calculator fields as a hint
      step: targetStep,
      isReturningFromCalculator: true
    }));

    // Navigation will happen as loader is finishing its animation
    setTimeout(() => {
      navigate("/personal-loan");
    }, 2400); // Navigate earlier so page is ready before fade-out starts at 2.6s
  };

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const exportToPDF = () => {
    alert("PDF Export feature will be available soon!");
  };

  return (
    <div className="main-calculator" style={{ position: 'relative' }}>
      <div className="calc-header" style={{ position: 'relative' }}>
        {fromLoan && (
          <button
            onClick={() => navigate("/personal-loan")}
            style={{
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'white',
              border: '1px solid #e2e8f0',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: '#64748b',
              fontWeight: 'bold',
              zIndex: 100,
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
          >
            ← Back to Form
          </button>
        )}
        <div className="title-circle">
          <h1>MICROFINANCE CALCULATOR</h1>
        </div>
      </div>

      <div className="calc-form">
        <div className="form-grid">
          <div className="field-group">
            <label>Kiasi cha Mkopo (TZS)</label>
            <input
              type="text"
              value={formatMoney(loanAmount)}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setLoanAmount(Number(val) || 0);
              }}
            />
          </div>

          <div className="field-group">
            <label>Muda wa kulipa Mkopo (Miezi)</label>
            <input
              type="number"
              value={loanPeriod}
              onChange={(e) => setLoanPeriod(Number(e.target.value))}
            />
          </div>

          <div className="field-group">
            <label>Mzunguko wa Marejesho</label>
            <select value={repaymentFrequency} onChange={(e) => setRepaymentFrequency(e.target.value)}>
              <option value="Daily">Kila Siku (Daily)</option>
              <option value="Weekly">Kila Wiki (Weekly)</option>
              <option value="Monthly">Kila Mwezi (Monthly)</option>
            </select>
          </div>

          <div className="field-group">
            <label>Aina ya Riba</label>
            <select value={interestType} onChange={(e) => setInterestType(e.target.value)}>
              <option value="Declining Balance">Riba Inayopungua (Declining)</option>
              <option value="Flat Rate">Riba Isiyobadilika (Flat Rate)</option>
            </select>
          </div>

          <div className="field-group">
            <label>Kiwango cha Riba (% kwa mwezi)</label>
            <input
              type="number"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
            />
          </div>

          <div className="field-group">
            <label>Ada ya Uchakataji (%)</label>
            <input
              type="number"
              step="0.5"
              value={processingFee}
              onChange={(e) => setProcessingFee(Number(e.target.value))}
            />
          </div>

          {fromLoan && (
            <>
              <div className="field-group">
                <label>Kipato kwa Mwezi (TZS)</label>
                <input
                  type="text"
                  value={income ? formatMoney(Number(income)) : ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setIncome(val);
                  }}
                  placeholder="mf. 1,500,000"
                />
              </div>
              <div className="field-group">
                <label>Matumizi kwa Mwezi (TZS)</label>
                <input
                  type="text"
                  value={expenses ? formatMoney(Number(expenses)) : ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setExpenses(val);
                  }}
                  placeholder="mf. 600,000"
                />
              </div>
            </>
          )}

          {!fromLoan && (
            <div className="field-group">
              <label>Tarehe ya Kuanza</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          )}

          <div className="field-group buttons" style={{ gridColumn: fromLoan ? 'span 2' : 'auto' }}>
            <button className="btn-calculate" onClick={calculateLoan}>KOKOTOA</button>
            {fromLoan ? (
              <button
                className="btn-export"
                onClick={handleApply}
                style={{ background: sustainability && sustainability.dti > 60 ? '#cbd5e1' : '#102a43', cursor: sustainability && sustainability.dti > 60 ? 'not-allowed' : 'pointer' }}
                disabled={sustainability ? sustainability.dti > 60 : false}
              >
                TUMIA MATOKEO
              </button>
            ) : (
              <button className="btn-export" onClick={exportToPDF}>HIFADHI KAMA PDF</button>
            )}
          </div>
        </div>

        {sustainability && sustainability.message && (
          <div style={{ marginTop: '20px', padding: '15px', borderRadius: '10px', background: sustainability.dti > 60 ? '#fff1f2' : '#fffbeb', border: `1px solid ${sustainability.dti > 60 ? '#fecaca' : '#fef3c7'}`, animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>{sustainability.dti > 60 ? '❌' : '⚠️'}</span>
              <p style={{ color: sustainability.dti > 60 ? '#991b1b' : '#92400e', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>{sustainability.message}</p>
            </div>
            {sustainability.suggestedMax > 0 && (
              <div style={{ marginTop: '10px', paddingLeft: '28px' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Kiasi kinachopendekezwa kwa kipato chako ni: <strong>{formatMoney(sustainability.suggestedMax)}</strong>
                </p>
                <button
                  onClick={() => { setLoanAmount(sustainability.suggestedMax); setTimeout(calculateLoan, 50); }}
                  className="sustainability-adjust-btn"
                  style={{
                    marginTop: '12px',
                    backgroundColor: sustainability.dti > 60 ? '#f43f5e' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '8px 20px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.15)';
                    e.currentTarget.style.filter = 'brightness(1.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
                    e.currentTarget.style.filter = 'brightness(1)';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>✨</span> Bofya hapa kurekebisha kiasi kiatomatiki
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="calc-results">
        <div className="result-card">
          <div className="result-label" style={{ textTransform: 'capitalize' }}>
            Rejesho la {repaymentFrequency === "Daily" ? "Kila Siku" : repaymentFrequency === "Weekly" ? "Kila Wiki" : "Kila Mwezi"}
          </div>
          <div className="result-value" style={{ color: '#102a43' }}>{formatMoney(monthlyPayment)}</div>
        </div>
        <div className="result-card">
          <div className="result-label">Jumla ya Marejesho</div>
          <div className="result-value">{formatMoney(totalPayment)}</div>
        </div>
        <div className="result-card">
          <div className="result-label">Jumla ya Riba</div>
          <div className="result-value">{formatMoney(totalInterest)}</div>
        </div>
        <div className="result-card">
          <div className="result-label">Ada ya Mkopo</div>
          <div className="result-value">{formatMoney(totalFee)}</div>
        </div>
      </div>
    </div>
  );
}

// =========================
// HOME PAGE (LANDING PAGE)
// =========================
function Home({ setLoading, setSyncMessages }: { setLoading: (l: boolean) => void, setSyncMessages: (m: string[]) => void }) {
  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <div className="top-nav">
        {/* ========== LOGO SECTION - CLASS ZAKE ZIPO WAZI ========== */}
        {/* Badilisha class hizi hapa kama unataka kubadilisha style ya logo */}
        <div className="custom-logo-wrapper">
          <img
            src={logo}
            alt="Company Logo"
            className="custom-logo-image"
          />
        </div>
        {/* ========== MWISHO WA LOGO SECTION ========== */}

        <div className="nav-links">
          <Link to="/login" className="login-btn">Login</Link>
          <Link to="/register" className="register-btn">Get Started</Link>
        </div>
      </div>

      {/* Calculator Section */}
      <div className="calculator-section">
        <MicrofinanceCalculator setLoading={setLoading} setSyncMessages={setSyncMessages} />
      </div>

      {/* Footer */}
      <div className="footer">
        <p>© 2026 Orethan Microfinance. All rights reserved.</p>
      </div>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Landing Page - Professional Background */
        .landing-page {
          min-height: 100vh;
          background: #f0f4f8;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Subtle Pattern Overlay */
        .landing-page::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='%23d4dcec' fill-opacity='0.15' d='M10 10h5v5h-5zM25 10h5v5h-5zM40 10h5v5h-5zM55 10h5v5h-5zM70 10h5v5h-5zM85 10h5v5h-5zM10 25h5v5h-5zM25 25h5v5h-5zM40 25h5v5h-5zM55 25h5v5h-5zM70 25h5v5h-5zM85 25h5v5h-5zM10 40h5v5h-5zM25 40h5v5h-5zM40 40h5v5h-5zM55 40h5v5h-5zM70 40h5v5h-5zM85 40h5v5h-5zM10 55h5v5h-5zM25 55h5v5h-5zM40 55h5v5h-5zM55 55h5v5h-5zM70 55h5v5h-5zM85 55h5v5h-5zM10 70h5v5h-5zM25 70h5v5h-5zM40 70h5v5h-5zM55 70h5v5h-5zM70 70h5v5h-5zM85 70h5v5h-5zM10 85h5v5h-5zM25 85h5v5h-5zM40 85h5v5h-5zM55 85h5v5h-5zM70 85h5v5h-5zM85 85h5v5h-5z'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        /* Top Navigation */
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 65px;
          padding: 0 60px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border-bottom: 1px solid #e2e8f0;
          position: relative;
          z-index: 50; /* Base index higher for logo pop */
        }

        .custom-logo-wrapper {
          display: flex;
          align-items: center;
          position: relative;
          height: 100%;
          width: 250px;
        }

        .custom-logo-image {
          height: 130px;
          width: auto;
          object-fit: contain;
          position: absolute;
          top: -10px; /* Bleed out from top */
          left: 0;
          z-index: 100;
          filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));
          animation: logo-orbit 15s linear infinite;
          transform-origin: center center;
        }

        @keyframes logo-orbit {
          from { transform: perspective(1000px) rotateY(0deg); }
          to { transform: perspective(1000px) rotateY(360deg); }
        }
        /* ========== MWISHO WA LOGO CLASSES ========== */

        .nav-links {
          display: flex;
          gap: 16px;
        }

        .login-btn {
          padding: 10px 28px;
          background: transparent;
          border: 1px solid #cbd5e1;
          border-radius: 40px;
          color: #1e293b;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s;
        }

        .login-btn:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        .register-btn {
          padding: 10px 28px;
          background: #0f172a;
          border: none;
          border-radius: 40px;
          color: white;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s;
        }

        .register-btn:hover {
          background: #1e293b;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        /* Calculator Section */
        .calculator-section {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start; /* Move up */
          padding: 20px;
          position: relative;
          z-index: 10;
        }

        /* Main Calculator */
        .main-calculator {
          max-width: 1500px;
          margin: 0 auto;
          width: 98%;
          background: white;
          border-radius: 24px;
          padding: 32px 40px;
          box-shadow: 0 20px 35px -10px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0;
        }

        /* Title Circle - ROUND SHAPE WITH PINK COLOR */
        .calc-header {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
        }

        .title-circle {
          background: linear-gradient(135deg, #f472b6, #ec4899);
          width: auto;
          min-width: 320px;
          padding: 20px 40px;
          border-radius: 60px;
          text-align: center;
          box-shadow: 0 10px 25px -5px rgba(236,72,153,0.3);
        }

        .title-circle h1 {
          font-size: 22px;
          font-weight: 700;
          color: white;
          letter-spacing: 1px;
          margin: 0;
        }

        /* Form Grid - Horizontal Layout */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .field-group label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .field-group input,
        .field-group select {
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          transition: all 0.3s;
          background: #ffffff;
        }

        .field-group input:focus,
        .field-group select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .field-group.buttons {
          display: flex;
          flex-direction: row;
          gap: 12px;
          margin-top: 22px;
        }

        /* Calculate Button - BLUE */
        .btn-calculate {
          flex: 1;
          padding: 12px;
          background: #3b82f6;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-calculate:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 5px 15px rgba(59,130,246,0.3);
        }

        /* Export Button - GREEN */
        .btn-export {
          flex: 1;
          padding: 12px;
          background: #10b981;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-export:hover {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 5px 15px rgba(16,185,129,0.3);
        }

        /* Results */
        .calc-results {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
        }

        .result-card {
          text-align: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .result-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .result-value {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 20px;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          position: relative;
          z-index: 10;
        }

        .footer p {
          font-size: 12px;
          color: #64748b;
        }

        /* Responsive */
        @media (max-width: 1000px) {
          .form-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .calc-results {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .top-nav {
            padding: 15px 30px;
            flex-direction: column;
            gap: 15px;
          }
          .calculator-section {
            padding: 30px;
          }
          .main-calculator {
            padding: 24px;
          }
          .form-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .title-circle {
            min-width: 250px;
            padding: 15px 25px;
          }
          .title-circle h1 {
            font-size: 16px;
          }
          .custom-logo-image {
            height: 35px;
          }
        }

        @media (max-width: 600px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          .calc-results {
            grid-template-columns: 1fr;
          }
          .field-group.buttons {
            flex-direction: column;
          }
          .title-circle {
            min-width: 200px;
            padding: 12px 20px;
          }
          .title-circle h1 {
            font-size: 14px;
          }
          .custom-logo-image {
            height: 30px;
          }
        }
      `}</style>
    </div>
  );
}

// =========================
// PROTECTED ROUTE COMPONENT
// =========================
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// =========================
// MAIN LAYOUT
// =========================
function MainLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div style={{
        flex: 1,
        marginLeft: isCollapsed ? "80px" : "260px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        transition: "margin-left 0.3s ease"
      }}>
        <Navbar />
        <div style={{
          flex: 1,
          padding: "10px 16px",
          overflowY: "auto"
        }}>
          {children}
        </div>
        <Footer />
      </div>
    </div>
  );
}

// =========================
// APP ROUTES
// =========================
function App() {
  const [loading, setLoading] = useState(true);
  const [syncMessages, setSyncMessages] = useState<string[]>([]);

  return (
    <>
      {loading && <LoadingScreen onFinish={() => { setLoading(false); setSyncMessages([]); }} statusMessages={syncMessages} />}
      <BrowserRouter>
        <Routes>
          {/* ROOT - Home Page (Landing Page with Calculator) */}
          <Route path="/" element={<Home setLoading={setLoading} setSyncMessages={setSyncMessages} />} />

          {/* PUBLIC ROUTES */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ========== PROTECTED ROUTES - WITH SIDEBAR ========== */}
          <Route
            path="/personal-loan"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PersonalLoan />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/group-loan"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <GroupLoan />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-loan"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <GroupLoan />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Users />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/loan-manager"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <LoanManager />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-applications"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MyLoans />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/general-manager"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <GeneralManager />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/managing-director"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ManagingDirector />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/repayment-tracker"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <RepaymentTracker />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ROLE-BASED CUSTOMER ROUTES */}
          <Route
            path="/lm/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gm/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/md/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/customers"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Customers />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/disburse/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DisburseLoan />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/disburse/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DisburseLoan />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ROLE-BASED CUSTOMER DETAILS */}
          <Route
            path="/lm/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gm/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/md/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/customers/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomerDetails />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/customers/:id/repayments"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <LoanRepayments />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/customers/:id/repayments"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <LoanRepayments />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;