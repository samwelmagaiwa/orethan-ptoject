import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";

import Sidebar from "../components/Sidebar";

import GroupLoan from "./GroupLoan";
import PersonalLoan from "./PersonalLoan";
import EmployeeLoan from "./EmployeeLoan";

function Home() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/api/test")
      .then((res) => {
        setMessage(res.data.message);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Microfinance System</h1>
        <p className="tagline">Empowering Your Financial Growth</p>

        {!loading && message && (
          <p className="subtitle">{message}</p>
        )}

        <div className="buttons">
          <Link to="/login" className="btn login">
            Login
          </Link>

          <Link to="/register" className="btn register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardLayout() {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar isCollapsed={false} setIsCollapsed={() => {}} />

      <div
        style={{
          flex: 1,
          minHeight: "100vh",
          backgroundColor: "#f1f5f9",
          marginLeft: "260px",
        }}
      >
        <Dashboard />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<DashboardLayout />} />

        <Route path="/group-loan" element={<GroupLoan />} />

        <Route path="/personal-loan" element={<PersonalLoan />} />

        <Route path="/employee-loan" element={<EmployeeLoan />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;