import { useEffect, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import GetHelp from "../components/GetHelp";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface Settings {
  penalty_rate: string | number;
  default_interest_rate: string | number;
  default_processing_fee_rate: string | number;
}

const LoanSettings = () => {
  const [form, setForm] = useState<Settings>({ penalty_rate: "", default_interest_rate: "", default_processing_fee_rate: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" as any });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/loan-settings`, { headers: authHeaders() });
      setForm(res.data.data);
    } catch (err: any) {
      setModal({ isOpen: true, title: "Hitilafu", message: err.response?.data?.message || "Imeshindikana kupakia mipangilio", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API_BASE}/loan-settings`, {
        penalty_rate: form.penalty_rate,
        default_interest_rate: form.default_interest_rate,
        default_processing_fee_rate: form.default_processing_fee_rate,
      }, { headers: authHeaders() });
      setForm(res.data.data);
      setModal({ isOpen: true, title: "Imehifadhiwa", message: "Mipangilio ya riba na adhabu imebadilishwa kwa mafanikio. Mikopo mipya na hesabu za uchelewaji zitatumia thamani hizi mara moja.", type: "success" });
    } catch (err: any) {
      setModal({ isOpen: true, title: "Hitilafu", message: err.response?.data?.message || "Imeshindikana kuhifadhi mipangilio", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Settings, label: string, hint: string) => (
    <div className="ls-field">
      <label>{label}</label>
      <div className="ls-input-wrap">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
        />
        <span className="ls-percent">%</span>
      </div>
      <p className="ls-hint">{hint}</p>
    </div>
  );

  return (
    <div className="ls-page">
      <AlertModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, isOpen: false })} />

      <div className="ls-card">
        <div className="ls-accent-bar" />
        <div className="ls-sticky-top">
          <div className="ls-header">
            <div>
              <h1>Mipangilio ya Riba na Adhabu</h1>
              <p>Vigezo hivi vinatumika mahali popote mfumo unapohesabu adhabu ya uchelewaji au riba chaguomsingi ya mkopo</p>
            </div>
          </div>

          <GetHelp
            title="How to use Loan Settings"
            intro="These three rates are the system-wide defaults used every time a loan is calculated, a penalty is charged, or a processing fee is deducted at disbursement. Change them here and every future calculation picks up the new value instantly — existing loan schedules are not retroactively changed."
            steps={[
              { title: "1. Penalty rate", text: "The percentage applied to the overdue installment amount when a borrower is late. Used by the Overdue Management module and printed on guarantor SMS reminders.", example: "Set to 2.0% → a borrower with TZS 50,000 overdue owes TZS 1,000 as a late-payment penalty." },
              { title: "2. Default interest rate", text: "The monthly interest rate applied to new loans when the loan officer does not set a specific rate during the application — common for standard products.", example: "Set to 3.0% per month → a TZS 1,000,000 loan accrues TZS 30,000 interest in the first month." },
              { title: "3. Processing fee rate", text: "The percentage deducted from the gross loan amount at disbursement as an origination fee. Flows to Fee Income in the General Ledger.", example: "Set to 1.5% → a TZS 500,000 loan has TZS 7,500 withheld; the borrower receives TZS 492,500." },
              { title: "4. Save", text: "Click Save Settings — the new rates take effect immediately. A confirmation shows the change was applied." },
            ]}
            tip="Loan officers can override the default interest rate on individual applications. These settings are the fallback when no specific rate is entered."
          />
        </div>

        {loading ? (
          <div className="ls-empty">Inapakia...</div>
        ) : (
          <>
            <div className="ls-grid">
              {field("penalty_rate", "Kiwango cha Adhabu ya Uchelewaji", "Asilimia ya kiasi kilichochelewa inayoongezwa kama adhabu — inaonekana kwenye Usimamizi wa Madeni na SMS za wadhamini.")}
              {field("default_interest_rate", "Riba Chaguomsingi ya Mkopo", "Riba inayotumika kama kikokotoo/maombi ya mkopo hayajaweka riba yake mahususi.")}
              {field("default_processing_fee_rate", "Ada Chaguomsingi ya Uchakataji", "Ada inayotumika wakati taarifa za mkopo hazina ada ya uchakataji iliyowekwa.")}
            </div>

            <button className="ls-save-btn" onClick={save} disabled={saving}>
              {saving ? "Inahifadhi..." : "Hifadhi Mipangilio"}
            </button>
          </>
        )}
      </div>

      <style>{`
        .ls-page { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f1f5f9; padding: 14px 18px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .ls-card { max-width: 1100px; margin: 0 auto; background: white; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; position: relative; overflow: clip; }
        .ls-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #102a43 0%, #1e5fae 45%, #e2bc8a 100%); }
        .ls-sticky-top { position: sticky; top: 0; z-index: 5; background: white; padding-bottom: 4px; }
        .ls-header { margin: 6px 0 28px; }
        .ls-header h1 { font-size: 22px; font-weight: 700; color: #102a43; margin: 0 0 6px; }
        .ls-header p { font-size: 13px; color: #64748b; margin: 0; max-width: 640px; line-height: 1.5; }
        .ls-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-bottom: 26px; }
        @media (max-width: 900px) { .ls-grid { grid-template-columns: 1fr; } }
        .ls-field { display: flex; flex-direction: column; gap: 8px; }
        .ls-field label { font-size: 12px; font-weight: 700; color: #334155; }
        .ls-input-wrap { position: relative; display: flex; align-items: center; }
        .ls-input-wrap input { width: 100%; padding: 12px 36px 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 16px; font-weight: 700; color: #102a43; box-sizing: border-box; }
        .ls-input-wrap input:focus { outline: none; border-color: #1e5fae; box-shadow: 0 0 0 3px rgba(30,95,174,0.12); }
        .ls-percent { position: absolute; right: 14px; font-size: 14px; font-weight: 700; color: #94a3b8; }
        .ls-hint { font-size: 11.5px; color: #94a3b8; margin: 0; line-height: 1.5; }
        .ls-save-btn { background: #102a43; color: white; border: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ls-save-btn:hover:not(:disabled) { background: #1e5fae; }
        .ls-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ls-empty { text-align: center; padding: 40px; color: #64748b; }
      `}</style>
    </div>
  );
};

export default LoanSettings;
