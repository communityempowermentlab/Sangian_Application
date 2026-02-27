import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminChildrenList from './pages/AdminChildrenList';
import AdminChildAdd from './pages/AdminChildAdd';
import AdminChildEdit from './pages/AdminChildEdit';
import './index.css';

// Public Layout incorporates standard Header and Footer
const PublicLayout = () => {
    return (
        <>
            <Navbar />
            <Outlet />
            <Footer />
        </>
    );
};

function App() {
    return (
        <Router>
            <div className="App">
                <Routes>
                    {/* Public Child Navigation Routes */}
                    <Route element={<PublicLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/login" element={<Login />} />
                    </Route>

                    {/* Isolated Admin Navigation Routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />

                    {/* Protected Admin Routes Wrap */}
                    <Route path="/admin" element={<AdminLayout />}>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="children" element={<AdminChildrenList />} />
                        <Route path="children/add" element={<AdminChildAdd />} />
                        <Route path="children/edit/:id" element={<AdminChildEdit />} />
                    </Route>
                </Routes>
            </div>
        </Router>
    );
}

export default App;
