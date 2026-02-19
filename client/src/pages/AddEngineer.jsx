import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';

const AddEngineer = () => {
    const navigate = useNavigate();
    
    // Database column 'phone' kooda match panna 'phone' field sethurukkaen
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '', 
        group_type: 'ups' 
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log("Submitting data:", formData);
            const response = await fetch('http://localhost:5000/api/engineers/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Success alert-la automatic-ah generate aana Series ID kaattum
                alert(`Success! Engineer Created: ${data.engineer.engineer_id}`);
                navigate('/groups'); 
            } else {
                alert(`Error: ${data.error || "Failed to register"}`);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Network Error: Backend connection check pannunga!");
        }
    };

    return (
        <div className="add-engineer-container" style={{ padding: '30px', maxWidth: '1500px', margin: '0 auto', background: '#e6f5fd', minHeight: '100vh' }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#000000', marginBottom: '20px', fontWeight: 'bold' }}>
                <ArrowLeft size={20} /> Back to Groups
            </button>

            <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 25px rgba(0,0,0,0.1)', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1590df' }}>
                    <UserPlus size={28} /> Register New Engineer
                </h2>

                <form onSubmit={handleSubmit}>
                    <div style={fieldWrapper}>
                        <label style={labelStyle}>Full Name</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Enter full name"
                            style={inputStyle} 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        />
                    </div>

                    <div style={fieldWrapper}>
                        <label style={labelStyle}>Email Address</label>
                        <input 
                            type="email" 
                            required 
                            placeholder="example@jerobyte.com"
                            style={inputStyle} 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>

                    {/* NEW PHONE NUMBER FIELD */}
                    <div style={fieldWrapper}>
                        <label style={labelStyle}>Phone Number</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Ex: +91 9876543210"
                            style={inputStyle} 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                        />
                    </div>

                    <div style={fieldWrapper}>
                        <label style={labelStyle}>Login Password</label>
                        <input 
                            type="password" 
                            required 
                            placeholder="Create a password"
                            style={inputStyle} 
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})} 
                        />
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <label style={labelStyle}>Department / Group</label>
                        <select 
                            style={inputStyle} 
                            value={formData.group_type}
                            onChange={(e) => setFormData({...formData, group_type: e.target.value})}
                        >
                            <option value="ups">UPS Engineer</option>
                            <option value="lan">LAN Engineer</option>
                            <option value="cctv">CCTV Engineer</option>
                        </select>
                    </div>

                    <div style={infoBox}>
                        <small>ℹ️ ID format (ENG-DEPT-XXX) and Offline status will be assigned automatically.</small>
                    </div>

                    <button type="submit" style={submitBtnStyle}>REGISTER ENGINEER</button>
                </form>
            </div>
        </div>
    );
};

// Styles toolkit
const fieldWrapper = { marginBottom: '20px' };
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '8px', color: '#333' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #9ee5fe', outline: 'none', fontSize: '1rem', boxSizing: 'border-box' };
const submitBtnStyle = { width: '100%', padding: '14px', background: '#1590df', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', transition: '0.3s' };
const infoBox = { padding: '12px', background: '#f0f9ff', borderRadius: '6px', marginBottom: '20px', color: '#555', borderLeft: '4px solid #1590df' };

export default AddEngineer;