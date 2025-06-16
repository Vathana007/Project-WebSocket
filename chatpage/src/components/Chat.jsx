import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSend, FiLogOut, FiSearch, FiMoreVertical, FiPaperclip, FiPlus, FiUserPlus, FiUsers } from 'react-icons/fi';
import { IoCheckmarkDone } from 'react-icons/io5';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Chat = () => {
    // State management
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [username, setUsername] = useState('');
    const [activeChat, setActiveChat] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showMenu, setShowMenu] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateChatModal, setShowCreateChatModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [friendUsername, setFriendUsername] = useState('');
    const [logo, setLogo] = useState(null);
    const [isGroupChat, setIsGroupChat] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [newMember, setNewMember] = useState('');
    const [chats, setChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [memberOperationStatus, setMemberOperationStatus] = useState({
        loading: false,
        error: null,
        success: false
    });

    // Refs
    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const typingTimeoutRef = useRef(null);

    // Constants
    const API_BASE_URL = 'http://localhost:3000/api';
    const SOCKET_URL = 'http://localhost:3000';

    // Helper functions
    const formatDate = useCallback((dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Just now';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Just now';
        }
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // Sort chats by updatedAt in descending order
    const sortChats = (chatsToSort) => {
        return [...chatsToSort].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    };

    // Event handlers
    const handleClickOutside = useCallback((event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
            setShowMenu(false);
        }
    }, []);

    // Effects
    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (!storedUsername) {
            navigate('/login');
            return;
        }
        setUsername(storedUsername);
        loadUserChats(storedUsername);
    }, [navigate]);

    useEffect(() => {
        if (!username) return;

        const socketConnection = io(SOCKET_URL, {
            auth: { username },
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        setSocket(socketConnection);

        // Socket event handlers
        const handleConnect = () => {
            socketConnection.emit('join', username);
            if (activeChat) {
                loadMessages(activeChat);
            }
        };

        const handleNewMessage = (message) => {
            const isCurrentChat = message.chatId === activeChat;
            const isUserChat = chats.some(chat => chat.id === message.chatId);

            if (isCurrentChat) {
                setMessages(prev => [...prev, {
                    ...message,
                    timestamp: new Date(message.timestamp)
                }]);
                updateChatLastMessage(message.chatId, message.text);
                scrollToBottom();
            } else if (isUserChat) {
                updateChatLastMessage(message.chatId, message.text);
            }
        };

        const handleTypingEvent = (usersTyping) => {
            setTypingUsers(usersTyping.filter(u => u !== username));
        };

        const handleOnlineUsers = (users) => {
            setOnlineUsers(users);
        };

        const handleGroupUpdated = (updatedGroup) => {
            setChats(prev => sortChats(prev.map(chat =>
                chat.id === updatedGroup._id.toString()
                    ? { ...chat, members: updatedGroup.members, updatedAt: new Date(updatedGroup.updatedAt) }
                    : chat
            )));
        };

        const handleConnectError = (err) => {
            console.error('Connection error:', err);
        };

        socketConnection.on('connect', handleConnect);
        socketConnection.on('newMessage', handleNewMessage);
        socketConnection.on('typing', handleTypingEvent);
        socketConnection.on('stopTyping', () => setTypingUsers([]));
        socketConnection.on('onlineUsers', handleOnlineUsers);
        socketConnection.on('groupUpdated', handleGroupUpdated);
        socketConnection.on('connect_error', handleConnectError);

        return () => {
            socketConnection.off('connect', handleConnect);
            socketConnection.off('newMessage', handleNewMessage);
            socketConnection.off('typing', handleTypingEvent);
            socketConnection.off('stopTyping');
            socketConnection.off('onlineUsers', handleOnlineUsers);
            socketConnection.off('groupUpdated', handleGroupUpdated);
            socketConnection.off('connect_error', handleConnectError);
            socketConnection.disconnect();
        };
    }, [username, activeChat, chats, scrollToBottom]);

    useEffect(() => {
        if (activeChat) {
            loadMessages(activeChat);
            updateOnlineStatus();
        }
    }, [activeChat]);

    useEffect(() => {
        const interval = setInterval(updateOnlineStatus, 10000);
        return () => clearInterval(interval);
    }, [activeChat, chats]);

    // API functions
    const loadUserChats = async (username) => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_BASE_URL}/groupChats/user/${username}`);
            const userGroups = response.data.map(group => ({
                id: group._id.toString(),
                name: group.name,
                lastMessage: group.lastMessage || 'Group created',
                time: formatDate(group.updatedAt),
                unread: 0,
                members: group.members,
                isGroup: true,
                updatedAt: new Date(group.updatedAt)
            }));

            if (!userGroups.some(chat => chat.id === 'general')) {
                userGroups.unshift({
                    id: 'general',
                    name: 'General Chat',
                    lastMessage: 'Welcome to the general chat!',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: [],
                    isGroup: true,
                    updatedAt: new Date()
                });
            }

            setChats(sortChats(userGroups));
            setActiveChat(userGroups[0]?.id || 'general');
        } catch (err) {
            console.error('Error loading groups:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async (chatId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/messages?chatId=${chatId}`);
            setMessages(response.data.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            })));
            scrollToBottom();
        } catch (err) {
            console.error('Error loading messages:', err);
        }
    };

    const updateOnlineStatus = async () => {
        if (!socket || !activeChat) return;
        const currentChat = chats.find(c => c.id === activeChat);
        if (!currentChat) return;

        try {
            if (currentChat.isGroup) {
                const onlineMembers = await new Promise(resolve => {
                    socket.emit('getOnlineMembers', activeChat, resolve);
                });
                setChats(prev => sortChats(prev.map(chat =>
                    chat.id === activeChat
                        ? { ...chat, lastSeen: `${onlineMembers?.length || 0} online` }
                        : chat
                )));
            } else {
                const otherUser = currentChat.members?.find(m => m !== username);
                if (otherUser) {
                    const isOnline = await new Promise(resolve => {
                        socket.emit('checkUserOnline', otherUser, resolve);
                    });
                    setChats(prev => sortChats(prev.map(chat =>
                        chat.id === activeChat
                            ? { ...chat, lastSeen: isOnline ? 'Online' : 'Offline' }
                            : chat
                    )));
                }
            }
        } catch (err) {
            console.error('Error updating online status:', err);
        }
    };

    const updateChatLastMessage = (chatId, message) => {
        setChats(prev => sortChats(prev.map(chat =>
            chat.id === chatId
                ? {
                    ...chat,
                    lastMessage: message,
                    time: formatDate(new Date()),
                    updatedAt: new Date()
                }
                : chat
        )));
    };

    // Message handling
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !username || !activeChat) return;

        const tempId = Date.now().toString();
        try {
            const tempMessage = {
                _id: tempId,
                text: newMessage,
                sender: username,
                chatId: activeChat,
                timestamp: new Date()
            };

            // Optimistic update
            setMessages(prev => [...prev, tempMessage]);
            updateChatLastMessage(activeChat, newMessage);
            scrollToBottom();

            // Send to server
            socket?.emit('chatMessage', {
                text: newMessage,
                chatId: activeChat
            });

            // Update group chat's lastMessage and updatedAt
            await axios.post(`${API_BASE_URL}/messages`, {
                text: newMessage,
                sender: username,
                chatId: activeChat,
                timestamp: new Date()
            });

            // Clear typing indicator
            socket?.emit('stopTyping', activeChat);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
            setMessages(prev => prev.filter(msg => msg._id !== tempId));
        }
    };

    const handleTyping = () => {
        if (!socket || !activeChat) return;

        if (newMessage.trim()) {
            socket.emit('typing', activeChat);

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('stopTyping', activeChat);
                typingTimeoutRef.current = null;
            }, 2000);
        } else {
            socket.emit('stopTyping', activeChat);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    };

    // Chat management
    const handleCreateChat = async () => {
        if (!newChatName.trim()) return;

        try {
            if (isGroupChat) {
                const response = await axios.post(`${API_BASE_URL}/groupChats`, {
                    name: newChatName.trim(),
                    creator: username,
                    members: groupMembers
                });

                socket?.emit('joinGroup', response.data._id);

                const newChat = {
                    id: response.data._id.toString(),
                    name: response.data.name,
                    lastMessage: 'Group created!',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: response.data.members,
                    isGroup: true,
                    updatedAt: new Date()
                };
                setChats(prev => sortChats([...prev, newChat]));
                setActiveChat(response.data._id.toString());
            } else {
                const newChatId = `chat_${Date.now()}`;
                const newChat = {
                    id: newChatId,
                    name: newChatName.trim(),
                    lastMessage: 'Chat started',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: [username],
                    isGroup: false,
                    updatedAt: new Date()
                };
                setChats(prev => sortChats([...prev, newChat]));
                setActiveChat(newChatId);
            }

            setMessages([]);
            setNewChatName('');
            setGroupMembers([]);
            setShowCreateChatModal(false);
        } catch (err) {
            console.error('Error creating chat:', err);
            alert(err.response?.data?.message || 'Failed to create chat');
        }
    };

    const handleAddMember = async () => {
        if (!newMember.trim()) return;

        setMemberOperationStatus({ loading: true, error: null, success: false });

        try {
            const userCheck = await axios.get(`${API_BASE_URL}/auth/check/${newMember}`);
            if (!userCheck.data.exists) {
                throw new Error('User not found');
            }

            const currentGroup = chats.find(chat => chat.id === activeChat);
            if (currentGroup?.members.includes(newMember)) {
                throw new Error('User already in group');
            }

            const response = await axios.post(
                `${API_BASE_URL}/groupChats/${activeChat}/add-member`,
                { username: newMember }
            );

            setChats(prev => sortChats(prev.map(chat =>
                chat.id === activeChat
                    ? {
                        ...chat,
                        members: response.data.members,
                        lastSeen: `${response.data.members.length} members`,
                        updatedAt: new Date()
                    }
                    : chat
            )));

            setNewMember('');
            setMemberOperationStatus({ loading: false, error: null, success: true });
            setTimeout(() => setShowAddMemberModal(false), 1500);
        } catch (error) {
            console.error('Error adding member:', error);
            setMemberOperationStatus({
                loading: false,
                error: error.response?.data?.message || error.message || 'Failed to add member',
                success: false
            });
        }
    };

    const handleRemoveMember = async (memberToRemove) => {
        if (!memberToRemove || memberToRemove === username) return;

        try {
            const response = await axios.post(
                `${API_BASE_URL}/groupChats/${activeChat}/remove-member`,
                { username: memberToRemove }
            );

            setChats(prev => sortChats(prev.map(chat =>
                chat.id === activeChat
                    ? {
                        ...chat,
                        members: response.data.members,
                        lastSeen: `${response.data.members.length} members`,
                        updatedAt: new Date()
                    }
                    : chat
            )));
        } catch (error) {
            console.error('Error removing member:', error);
            alert(error.response?.data?.message || 'Failed to remove member');
        }
    };

    const handleAddFriend = async () => {
        if (!friendUsername.trim() || username === friendUsername) return;

        try {
            const userCheck = await axios.get(`${API_BASE_URL}/auth/check/${friendUsername}`);
            if (!userCheck.data.exists) {
                alert('User not found');
                return;
            }

            const currentChat = chats.find(c => c.id === activeChat);

            if (currentChat?.isGroup) {
                await axios.post(`${API_BASE_URL}/groupChats/${activeChat}/add-member`, {
                    username: friendUsername
                });

                setChats(prev => sortChats(prev.map(chat =>
                    chat.id === activeChat
                        ? { ...chat, members: [...new Set([...chat.members, friendUsername])] }
                        : chat
                )));

                alert(`${friendUsername} added to the group!`);
            } else {
                const response = await axios.post(`${API_BASE_URL}/groupChats`, {
                    name: `${username} and ${friendUsername}`,
                    creator: username,
                    members: [username, friendUsername]
                });

                const newChat = {
                    id: response.data._id.toString(),
                    name: response.data.name,
                    lastMessage: 'Chat started',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: [username, friendUsername],
                    isGroup: true,
                    updatedAt: new Date()
                };

                setChats(prev => sortChats([...prev, newChat]));
                setActiveChat(response.data._id.toString());
                setMessages([]);
                socket?.emit('joinGroup', response.data._id);
            }

            setFriendUsername('');
            setShowAddFriendModal(false);
        } catch (err) {
            console.error('Error adding friend:', err);
            alert(err.response?.data?.message || 'Failed to add friend');
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setLogo(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSignOut = () => {
        localStorage.removeItem('username');
        socket?.disconnect();
        navigate('/login');
    };

    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Render functions
    if (!username) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <p className="text-white bg-red-600 p-4 rounded-lg">Please sign in</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className={`${showSidebar ? 'w-80' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-200 bg-blue-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            {logo ? (
                                <img src={logo} alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 cursor-pointer" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold cursor-pointer">
                                    {username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <label className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow cursor-pointer hover:bg-gray-100">
                                <FiPlus size={12} className="text-blue-600" />
                                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            </label>
                        </div>
                        {showSidebar && (
                            <div>
                                <h2 className="font-bold text-blue-800 cursor-default">{username}</h2>
                                <p className="text-xs text-gray-600 cursor-default">
                                    {onlineUsers.includes(username) ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        )}
                    </div>
                    {showSidebar && (
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="text-gray-600 hover:text-gray-800 cursor-pointer"
                            aria-label="Collapse sidebar"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                {showSidebar && (
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm cursor-text"
                                placeholder="Search chats..."
                                aria-label="Search chats"
                            />
                        </div>
                    </div>
                )}

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredChats.map(chat => (
                        <div
                            key={chat.id}
                            onClick={() => {
                                setActiveChat(chat.id);
                                if (chat.isGroup) {
                                    socket?.emit('joinGroup', chat.id);
                                }
                            }}
                            className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex items-center ${activeChat === chat.id ? 'bg-blue-50' : ''}`}
                            aria-label={`Chat with ${chat.name}`}
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 cursor-pointer">
                                {chat.name.charAt(0).toUpperCase()}
                            </div>
                            {showSidebar && (
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                        <h3 className="font-medium text-gray-900 truncate cursor-pointer">{chat.name}</h3>
                                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2 cursor-default">{formatDate(chat.updatedAt)}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate cursor-pointer">{chat.lastMessage}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-gray-500 cursor-default">
                                            {chat.members.length} members • {chat.lastSeen || ''}
                                        </span>
                                        {chat.unread > 0 && (
                                            <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center cursor-default">
                                                {chat.unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* New Chat Buttons */}
                {showSidebar && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
                        <button
                            onClick={() => {
                                setIsGroupChat(false);
                                setShowCreateChatModal(true);
                            }}
                            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 cursor-pointer"
                            aria-label="Create new chat"
                        >
                            <FiPlus className="mr-2" />
                            New Chat
                        </button>
                        <button
                            onClick={() => {
                                setIsGroupChat(true);
                                setShowCreateChatModal(true);
                            }}
                            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 cursor-pointer"
                            aria-label="Create new group chat"
                        >
                            <FiUserPlus className="mr-2" />
                            New Group Chat
                        </button>
                    </div>
                )}
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center">
                        {!showSidebar && (
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="mr-3 text-gray-500 hover:text-blue-600 cursor-pointer"
                                aria-label="Expand sidebar"
                            >
                                ☰
                            </button>
                        )}
                        <div>
                            <h3 className="font-semibold text-lg cursor-default">
                                {chats.find(c => c.id === activeChat)?.name || 'Chat'}
                            </h3>
                            <p className="text-xs text-gray-500 cursor-default">
                                {typingUsers.length > 0
                                    ? `${typingUsers.join(', ')} typing...`
                                    : chats.find(c => c.id === activeChat)?.lastSeen || ''}
                            </p>
                        </div>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1 text-gray-500 hover:text-blue-600 cursor-pointer"
                            aria-label="Menu options"
                        >
                            <FiMoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                                {activeChat && chats.find(c => c.id === activeChat)?.isGroup && (
                                    <button
                                        onClick={() => {
                                            setShowAddMemberModal(true);
                                            setShowMenu(false);
                                            setNewMember('');
                                            setMemberOperationStatus({ loading: false, error: null, success: false });
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition duration-200 hover:bg-gray-100 cursor-pointer"
                                        aria-label="Manage members"
                                    >
                                        <FiUsers className="inline mr-2" />
                                        Manage Members
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowAddFriendModal(true);
                                        setShowMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition duration-200 hover:bg-gray-100 cursor-pointer"
                                    aria-label="Add friend"
                                >
                                    <FiUserPlus className="inline mr-2" />
                                    Add Friend
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLogoutModal(true);
                                        setShowMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition duration-200 hover:bg-gray-100 cursor-pointer"
                                    aria-label="Log out"
                                >
                                    <FiLogOut className="inline mr-2" />
                                    Log Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">No messages yet. Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={msg._id || index}
                                className={`flex mb-4 ${msg.sender === username ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-md rounded-lg p-3 ${msg.sender === username ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white shadow rounded-bl-none'} cursor-default`}
                                >
                                    {msg.sender !== username && (
                                        <div className="font-semibold text-sm text-blue-700 mb-1 cursor-default">
                                            {msg.sender}
                                        </div>
                                    )}
                                    <div>{msg.text}</div>
                                    <div className="flex justify-end items-center mt-1 space-x-1 text-xs">
                                        <span className={msg.sender === username ? 'text-blue-100' : 'text-gray-500 cursor-default'}>
                                            {formatDate(msg.timestamp)}
                                        </span>
                                        {msg.sender === username && <IoCheckmarkDone className="text-blue-200 cursor-default" />}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-500 hover:text-blue-600 cursor-pointer" aria-label="Attach file">
                            <FiPaperclip size={20} />
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                handleTyping();
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            className="flex-1 p-2 bg-gray-100 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-text"
                            placeholder="Type a message..."
                            aria-label="Type your message"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className={`p-2 rounded-full ${newMessage.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-400'} cursor-pointer`}
                            aria-label="Send message"
                        >
                            <FiSend size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Chat Modal */}
            {showCreateChatModal && (
                <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-gray-800">
                                {isGroupChat ? 'Create New Group' : 'New Chat'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCreateChatModal(false);
                                    setNewChatName('');
                                    setGroupMembers([]);
                                }}
                                className="text-gray-500 transition duration-200 hover:text-gray-700 cursor-pointer"
                                aria-label="Close modal"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isGroupChat ? 'Group Name' : 'Chat Name'}
                                </label>
                                <input
                                    type="text"
                                    value={newChatName}
                                    onChange={(e) => setNewChatName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    placeholder={isGroupChat ? 'e.g. Project Team' : 'e.g. Personal Chat'}
                                />
                            </div>

                            {isGroupChat && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Add Members
                                    </label>
                                    <div className="flex mb-2">
                                        <input
                                            type="text"
                                            value={newMember}
                                            onChange={(e) => setNewMember(e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            placeholder="Enter username"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && newMember.trim() && !groupMembers.includes(newMember)) {
                                                    setGroupMembers([...groupMembers, newMember]);
                                                    setNewMember('');
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (newMember.trim() && !groupMembers.includes(newMember)) {
                                                    setGroupMembers([...groupMembers, newMember]);
                                                    setNewMember('');
                                                }
                                            }}
                                            disabled={!newMember.trim()}
                                            className={`px-4 py-2 rounded-r-lg cursor-pointer ${newMember.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300'} text-white transition-colors`}
                                        >
                                            <FiPlus size={20} />
                                        </button>
                                    </div>

                                    {groupMembers.length > 0 && (
                                        <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                                {groupMembers.length} {groupMembers.length === 1 ? 'Member' : 'Members'} Added
                                            </h4>
                                            <div className="space-y-2">
                                                {groupMembers.map((member, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded-md shadow-sm">
                                                        <div className="flex items-center">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium mr-2">
                                                                {member.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-sm font-medium">{member}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => setGroupMembers(groupMembers.filter(m => m !== member))}
                                                            className="text-gray-400 transition duration-200 hover:text-red-500 transition-colors cursor-pointer"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowCreateChatModal(false);
                                    setNewChatName('');
                                    setGroupMembers([]);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 transition duration-200 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateChat}
                                disabled={!newChatName.trim()}
                                className={`px-4 py-2 rounded-lg cursor-pointer ${newChatName.trim() ? 'bg-gradient-to-r from-blue-600 to-blue-500 transition duration-200 hover:from-blue-700 hover:to-blue-600' : 'bg-gray-300'} text-white shadow-md transition-all`}
                            >
                                {isGroupChat ? 'Create Group' : 'Create Chat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4 text-center">
                            Add Member to {chats.find(c => c.id === activeChat)?.name}
                        </h3>

                        {memberOperationStatus.error && (
                            <div className="bg-red-100 text-red-700 p-2 rounded-lg mb-4 text-sm">
                                {memberOperationStatus.error}
                            </div>
                        )}

                        {memberOperationStatus.success && (
                            <div className="bg-green-100 text-green-700 p-2 rounded-lg mb-4 text-sm">
                                Member added successfully!
                            </div>
                        )}

                        <div className="mb-4">
                            <input
                                type="text"
                                value={newMember}
                                onChange={(e) => setNewMember(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                placeholder="Enter username"
                                disabled={memberOperationStatus.loading}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                            />
                        </div>

                        <div className="mb-4 max-h-40 overflow-y-auto">
                            <h4 className="font-medium mb-2">Current Members ({chats.find(c => c.id === activeChat)?.members.length}):</h4>
                            {chats.find(c => c.id === activeChat)?.members.map((member, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded mb-1">
                                    <span>{member}</span>
                                    {member !== username && (
                                        <button
                                            onClick={() => handleRemoveMember(member)}
                                            className="text-red-500 transition cursor-pointer hover:text-red-700 cursor-pointer"
                                            disabled={memberOperationStatus.loading}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowAddMemberModal(false);
                                    setNewMember('');
                                    setMemberOperationStatus({ loading: false, error: null, success: false });
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg transition duration-200 hover:bg-gray-300 cursor-pointer"
                                disabled={memberOperationStatus.loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMember}
                                disabled={!newMember.trim() || memberOperationStatus.loading}
                                className={`px-4 py-2 rounded-lg cursor-pointer ${newMember.trim() && !memberOperationStatus.loading
                                    ? 'bg-blue-600 text-white transition duration-200 hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500'
                                    }`}
                            >
                                {memberOperationStatus.loading ? 'Adding...' : 'Add Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Friend Modal */}
            {showAddFriendModal && (
                <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4 text-center cursor-default">Add Friend</h3>
                        <div className="mb-4">
                            <input
                                type="text"
                                value={friendUsername}
                                onChange={(e) => setFriendUsername(e.target.value)}
                                className="w-full p-3 mb-2 border border-gray-300 rounded-lg cursor-text"
                                placeholder="Enter friend's username"
                            />
                            {friendUsername && (
                                <div className="p-2 bg-gray-100 rounded-lg mb-2">
                                    <p className="text-sm">Add: <span className="font-medium">{friendUsername}</span></p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowAddFriendModal(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg transition duration-200 hover:bg-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddFriend}
                                disabled={!friendUsername.trim() || username === friendUsername}
                                className={`px-4 py-2 rounded-lg cursor-pointer ${friendUsername.trim() && username !== friendUsername ? 'bg-blue-600 text-white transition duration-200 hover:bg-blue-700' : 'bg-gray-300 text-gray-500'} cursor-pointer`}
                            >
                                Add Friend
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4 text-center cursor-default">Confirm Logout</h3>
                        <p className="text-gray-600 mb-6 text-center cursor-default">Are you sure you want to log out?</p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;