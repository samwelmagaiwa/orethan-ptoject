import { useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import { API_BASE } from "../lib/api";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modal, setModal] = useState({ isOpen: false, message: "", type: 'info' as any });

  const handleRegister = (e: any) => {
    e.preventDefault();

    axios.post(`${API_BASE}/register`, {
      name,
      email,
      password
    })
      .then(res => {
        setModal({ isOpen: true, message: res.data.message || "Registration successful!", type: 'success' });
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      })
      .catch(err => {
        console.log(err.response);
        setModal({ isOpen: true, message: err.response?.data?.message || "Error during registration", type: 'error' });
      });
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleRegister} style={styles.card}>
        <h2>Register</h2>

        <input
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />

        <input
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        <button style={styles.button}>Register</button>
      </form>
      <AlertModal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#1e3a8a"
  },
  card: {
    background: "#fff",
    padding: "30px",
    borderRadius: "10px",
    width: "300px"
  },
  input: {
    width: "100%",
    margin: "10px 0",
    padding: "10px"
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#10b981",
    color: "#fff",
    border: "none"
  }
};

export default Register;
