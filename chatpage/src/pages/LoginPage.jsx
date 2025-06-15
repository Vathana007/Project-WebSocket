import React from "react";
import { Link } from "react-router-dom";
import { FiMessageSquare, FiUsers, FiShield } from "react-icons/fi";

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col justify-center items-center p-6">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">ChatSphere</h1>
        <p className="text-xl text-indigo-100 max-w-2xl">
          Connect with your friends in real-time with our secure messaging platform
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden w-full max-w-4xl">
        <div className="md:flex">
          <div className="p-10 md:w-1/2 bg-white/5">
            <h2 className="text-2xl font-bold text-white mb-6">Get Started</h2>

            <div className="space-y-6">
              <Link
                to="/login"
                className="block w-full py-3 px-6 bg-white text-indigo-600 rounded-lg font-medium text-center hover:bg-gray-50 transition shadow-md"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="block w-full py-3 px-6 border-2 border-white text-white rounded-lg font-medium text-center hover:bg-white/10 transition"
              >
                Create Account
              </Link>
            </div>
          </div>

          <div className="p-10 md:w-1/2 bg-white/20">
            <div className="space-y-8">
              <div className="flex items-start">
                <FiMessageSquare className="text-white text-2xl mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Real-time Chat</h3>
                  <p className="text-indigo-100">Instant messaging with friends and colleagues</p>
                </div>
              </div>

              <div className="flex items-start">
                <FiUsers className="text-white text-2xl mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Group Chats</h3>
                  <p className="text-indigo-100">Create groups for your teams and communities</p>
                </div>
              </div>

              <div className="flex items-start">
                <FiShield className="text-white text-2xl mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Secure</h3>
                  <p className="text-indigo-100">End-to-end encryption for your privacy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-indigo-200">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default LoginPage;