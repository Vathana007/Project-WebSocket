import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LoginForm from "./components/LoginForm";
import Register from "./components/Register";
import ChatPage from "./pages/ChatPage";

const App = () => {
    const [user, setUser] = useState(null);

    return (
        <Router>
            <Routes>
                <Route path="/" element={<LoginPage setUser={setUser} />} />
                <Route path="/login" element={<LoginForm setUser={setUser} />} />
                <Route path="/register" element={<Register setUser={setUser} />} />
                <Route path="/chat" element={<ChatPage user={user} />} />
            </Routes>
        </Router>
    );
};

export default App;
