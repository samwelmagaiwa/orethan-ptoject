import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "loan_officer",
  });

  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: 'info' as any });
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: 'info' as any });
  const [openMenuFor, setOpenMenuFor] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/users`, {
        headers: getAuthHeaders()
      });
      console.log("Fetched users:", res.data);
      setUsers(res.data);
    } catch (err: any) {
      console.error("Fetch error:", err.response?.data || err.message);
      if (err.response?.status === 401) {
        setModal({ isOpen: true, title: "Session Expired", message: "Please login again.", type: 'error' });
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async () => {
    if (!newUser.name || !newUser.email) {
      setModal({ isOpen: true, title: "Missing Information", message: "Name and Email are required!", type: 'warning' });
      return;
    }

    try {
      if (editUser) {
        const payload: any = {
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
        };
        if (newUser.password) payload.password = newUser.password;
        const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
        const res = await axios.put(`${API_BASE}/users/${editUser.id}`, payload, {
          headers: getAuthHeaders()
        });
        setUsers(users.map(u => u.id === editUser.id ? res.data : u));
        setModal({ isOpen: true, title: "Success", message: "User updated successfully!", type: 'success' });
      } else {
        if (!newUser.password) {
          setModal({ isOpen: true, title: "Missing Password", message: "Password is required for new user!", type: 'warning' });
          return;
        }

        const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
        const res = await axios.post(`${API_BASE}/users`, {
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          password: newUser.password,
          role: newUser.role,
        }, {
          headers: getAuthHeaders()
        });

        console.log("Created user:", res.data);
        setUsers([...users, res.data]);
        setModal({ isOpen: true, title: "Success", message: `User ${res.data.name} created successfully!`, type: 'success' });
      }
      resetModal();
    } catch (err: any) {
      console.error("Save error:", err.response?.data || err.message);
      setModal({ isOpen: true, title: "Error", message: err.response?.data?.message || "Operation failed", type: 'error' });
    }
  };

  const deleteUser = (id: number) => {
    setConfirm({
      isOpen: true,
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      type: 'danger',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        try {
          const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
          await axios.delete(`${API_BASE}/users/${id}`, {
            headers: getAuthHeaders()
          });
          setUsers(users.filter(u => u.id !== id));
          setModal({ isOpen: true, title: "Deleted", message: "User deleted successfully!", type: 'success' });
        } catch (err) {
          console.error(err);
          setModal({ isOpen: true, title: "Error", message: "Delete failed", type: 'error' });
        }
      }
    });
  };

  const toggleLock = (user: any) => {
    const locking = !user.is_locked;
    setConfirm({
      isOpen: true,
      title: locking ? "Lock User" : "Unlock User",
      message: locking
        ? `Lock ${user.name}? They will be signed out immediately and blocked from logging in until unlocked.`
        : `Unlock ${user.name} so they can use the system again?`,
      type: locking ? 'danger' : 'info',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        try {
          const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
          const res = await axios.post(`${API_BASE}/users/${user.id}/${locking ? "lock" : "unlock"}`, {}, { headers: getAuthHeaders() });
          setUsers(users.map(u => u.id === user.id ? { ...u, ...res.data.user } : u));
          setModal({ isOpen: true, title: locking ? "Locked" : "Unlocked", message: res.data.message || "Done", type: 'success' });
        } catch (err: any) {
          setModal({ isOpen: true, title: "Error", message: err?.response?.data?.message || "Action failed", type: 'error' });
        }
      }
    });
  };

  const startEdit = (user: User) => {
    setEditUser(user);
    setNewUser({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      role: user.role,
    });
    setShowModal(true);
  };

  const resetModal = () => {
    setShowModal(false);
    setEditUser(null);
    setNewUser({ name: "", email: "", phone: "", password: "", role: "loan_officer" });
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      loan_officer: "Loan Officer",
      loan_manager: "Loan Manager",
      general_manager: "General Manager",
      managing_director: "Managing Director",
      finance_officer: "Finance Officer / Cashier",
    };
    return labels[role] || role;
  };

  return (
    <div className="users-page">
      <AlertModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
      <ConfirmModal
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        type={confirm.type}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ ...confirm, isOpen: false })}
      />
      <div className="users-card">
        <div className="users-header">
          <div>
            <h1>Users Management</h1>
            <p>Manage system users and their roles</p>
          </div>
          <button className="add-user-btn" onClick={() => { setEditUser(null); setNewUser({ name: "", email: "", phone: "", password: "", role: "loan_officer" }); setShowModal(true); }}>
            Add User
          </button>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-state">Loading users...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">No users found</td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any, index) => (
                    <tr key={user.id}>
                      <td className="user-number">{index + 1}</td>
                      <td className="user-name">
                        <span className="user-name-text">{user.name || "—"}</span>
                      </td>
                      <td className="user-email">{user.email || "—"}</td>
                      <td className="user-phone">{user.phone || "—"}</td>
                      <td className="user-role">
                        <span className={`role-badge role-${user.role}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 800, background: user.is_locked ? "#fef2f2" : "#ecfdf5", color: user.is_locked ? "#dc2626" : "#059669" }}>
                          {user.is_locked ? "🔒 Locked" : "Active"}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button
                          className="kebab-btn"
                          onClick={() => setOpenMenuFor(openMenuFor === user.id ? null : user.id)}
                          aria-label="Actions"
                        >
                          &#8942;
                        </button>
                        {openMenuFor === user.id && (
                          <div className="actions-dropdown" ref={menuRef}>
                            <div className="actions-dropdown-title">Actions</div>
                            <button className="edit-btn" onClick={() => { startEdit(user); setOpenMenuFor(null); }}>Edit</button>
                            <button className="lock-btn" style={{ background: user.is_locked ? "#ecfdf5" : "#fffbeb", color: user.is_locked ? "#059669" : "#d97706", border: `1px solid ${user.is_locked ? "#a7f3d0" : "#fde68a"}` }} onClick={() => { toggleLock(user); setOpenMenuFor(null); }}>{user.is_locked ? "Unlock" : "Lock"}</button>
                            <button className="delete-btn" onClick={() => { deleteUser(user.id); setOpenMenuFor(null); }}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editUser ? "Edit User" : "Add New User"}</h2>
            <div className="modal-form">
              <div className="form-field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>{editUser ? "New Password (optional)" : "Password"}</label>
                <input
                  type="password"
                  placeholder={editUser ? "Leave blank to keep current" : "Enter password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>User Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="loan_officer">Loan Officer</option>
                  <option value="loan_manager">Loan Manager</option>
                  <option value="general_manager">General Manager</option>
                  <option value="managing_director">Managing Director</option>
                  <option value="finance_officer">Finance Officer / Cashier</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={resetModal}>Cancel</button>
              <button className="btn-save" onClick={saveUser}>{editUser ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .users-page {
          min-height: 100vh;
          background: #f1f5f9;
          padding: 80px 28px 28px 28px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .users-card {
          max-width: 1300px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
        }

        .users-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .users-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .users-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .add-user-btn {
          background: #0f172a;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .add-user-btn:hover {
          background: #1e293b;
        }

        .search-bar {
          margin-bottom: 24px;
        }

        .search-bar input {
          width: 100%;
          max-width: 320px;
          padding: 10px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-bar input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 14px 12px;
          background: #f8fafc;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
        }

        td {
          padding: 14px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
          color: #1e293b;
        }

        tr:hover {
          background: #f8fafc;
        }

        .user-number {
          font-weight: 500;
          color: #64748b;
          width: 50px;
        }

        .user-name {
          font-weight: 500;
        }

        .user-name-text {
          color: #0f172a;
          font-weight: 500;
        }

        .user-email {
          color: #475569;
        }

        .user-phone {
          color: #64748b;
        }

        .role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-admin {
          background: #e9d5ff;
          color: #6b21a5;
        }

        .role-loan_officer {
          background: #dcfce7;
          color: #166534;
        }

        .role-loan_manager {
          background: #dbeafe;
          color: #1e40af;
        }

        .role-general_manager {
          background: #fed7aa;
          color: #9a3412;
        }

        .role-managing_director {
          background: #fee2e2;
          color: #b91c1c;
        }

        .actions-cell {
          position: relative;
          text-align: center;
        }

        .kebab-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          padding: 4px 12px;
          border-radius: 8px;
          color: #475569;
          transition: background 0.2s;
        }

        .kebab-btn:hover {
          background: #f1f5f9;
        }

        .actions-dropdown {
          position: absolute;
          top: 100%;
          right: 8px;
          margin-top: 4px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 150px;
          z-index: 50;
          text-align: left;
        }

        .actions-dropdown-title {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0 4px 6px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 2px;
        }

        .actions-dropdown .edit-btn,
        .actions-dropdown .lock-btn,
        .actions-dropdown .delete-btn {
          width: 100%;
          text-align: center;
        }

        .edit-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .edit-btn:hover {
          background: #2563eb;
        }

        .delete-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .delete-btn:hover {
          background: #dc2626;
        }

        .lock-btn {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .lock-btn:hover { filter: brightness(0.97); }

        .loading-state {
          text-align: center;
          padding: 60px;
          color: #64748b;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 24px;
          padding: 28px;
          width: 480px;
          max-width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 20px 0;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-field label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .form-field input, .form-field select {
          padding: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-field input:focus, .form-field select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-cancel {
          background: #e2e8f0;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-cancel:hover {
          background: #cbd5e1;
        }

        .btn-save {
          background: #0f172a;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-save:hover {
          background: #1e293b;
        }

        @media (max-width: 768px) {
          .users-page {
            padding: 70px 16px 16px 16px;
          }
          .users-card {
            padding: 20px;
          }
          .users-header {
            flex-direction: column;
            align-items: stretch;
          }
          .search-bar input {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Users;