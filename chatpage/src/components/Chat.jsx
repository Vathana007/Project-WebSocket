import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiLogOut, FiSearch, FiMoreVertical, FiPaperclip, FiPlus, FiUserPlus } from 'react-icons/fi';
import { IoCheckmarkDone } from 'react-icons/io5';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Chat = () => {
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

    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const typingTimeoutRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load user data and chats on mount
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (!storedUsername) {
            navigate('/login');
            return;
        }
        setUsername(storedUsername);
        loadUserChats(storedUsername);
    }, [navigate]);

    // Socket.io connection and event handlers
    useEffect(() => {
        if (!username) return;

        const socketConnection = io('http://localhost:3000', {
            auth: { username },
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        setSocket(socketConnection);

        socketConnection.on('connect', () => {
            socketConnection.emit('join', username);
            if (activeChat) {
                loadMessages(activeChat);
            }
        });

        socketConnection.on('newMessage', (message) => {
            if (message.chatId === activeChat) {
                setMessages(prev => [...prev, {
                    ...message,
                    timestamp: new Date(message.timestamp)
                }]);
                updateChatLastMessage(message.chatId, message.text);
                scrollToBottom();
            }
        });

        socketConnection.on('typing', (usersTyping) => {
            setTypingUsers(usersTyping.filter(u => u !== username));
        });

        socketConnection.on('stopTyping', () => {
            setTypingUsers([]);
        });

        socketConnection.on('onlineUsers', (users) => {
            setOnlineUsers(users);
        });

        socketConnection.on('connect_error', (err) => {
            console.error('Connection error:', err);
        });

        return () => {
            socketConnection.disconnect();
        };
    }, [username, activeChat]);

    // Load messages when active chat changes
    useEffect(() => {
        if (activeChat) {
            loadMessages(activeChat);
            updateOnlineStatus();
        }
    }, [activeChat]);

    // Update online status periodically
    useEffect(() => {
        const interval = setInterval(updateOnlineStatus, 10000);
        return () => clearInterval(interval);
    }, [activeChat, chats]);

    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Just now';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Just now';
        }
    };

    const loadUserChats = async (username) => {
        try {
            setIsLoading(true);

            // Load user's groups from API
            const response = await axios.get(`http://localhost:3000/api/groupChats/user/${username}`);
            const userGroups = response.data.map(group => ({
                id: group._id,
                name: group.name,
                lastMessage: group.lastMessage || 'Group created',
                time: formatDate(group.updatedAt || group.createdAt),
                unread: 0,
                members: group.members,
                isGroup: true
            }));

            // Add general chat if it doesn't exist
            if (!userGroups.some(chat => chat.id === 'general')) {
                userGroups.unshift({
                    id: 'general',
                    name: 'General Chat',
                    lastMessage: 'Welcome to the general chat!',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: [],
                    isGroup: true
                });
            }

            setChats(userGroups);
            setActiveChat(userGroups[0]?.id || 'general');

            setIsLoading(false);
        } catch (err) {
            console.error('Error loading groups:', err);
            setIsLoading(false);
        }
    };

    const loadMessages = async (chatId) => {
        try {
            const response = await axios.get(`http://localhost:3000/api/messages?chatId=${chatId}`);
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

                setChats(prev => prev.map(chat =>
                    chat.id === activeChat
                        ? { ...chat, lastSeen: `${onlineMembers?.length || 0} online` }
                        : chat
                ));
            } else {
                const otherUser = currentChat.members?.find(m => m !== username);
                if (otherUser) {
                    const isOnline = await new Promise(resolve => {
                        socket.emit('checkUserOnline', otherUser, resolve);
                    });

                    setChats(prev => prev.map(chat =>
                        chat.id === activeChat
                            ? { ...chat, lastSeen: isOnline ? 'Online' : 'Offline' }
                            : chat
                    ));
                }
            }
        } catch (err) {
            console.error('Error updating online status:', err);
        }
    };

    const updateChatLastMessage = (chatId, message) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId
                ? {
                    ...chat,
                    lastMessage: message,
                    time: formatDate(new Date())
                }
                : chat
        ));
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !username || !activeChat) return;

        try {
            // Optimistic UI update
            const tempId = Date.now().toString();
            const tempMessage = {
                _id: tempId,
                text: newMessage,
                sender: username,
                chatId: activeChat,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, tempMessage]);
            updateChatLastMessage(activeChat, newMessage);
            scrollToBottom();

            // Send to server
            const response = await axios.post('http://localhost:3000/api/messages', {
                text: newMessage,
                sender: username,
                chatId: activeChat,
                timestamp: new Date().toISOString(),
            });

            // Replace temporary message with server response
            setMessages(prev => prev.map(msg =>
                msg._id === tempId
                    ? { ...response.data, timestamp: new Date(response.data.timestamp) }
                    : msg
            ));

            // Clear typing indicator
            socket?.emit('stopTyping', activeChat);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
            // Remove optimistic update if failed
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

    const handleCreateChat = async () => {
        if (!newChatName.trim()) return;

        try {
            // Send the request to the backend to create the new group
            const response = await axios.post('http://localhost:3000/api/groupChats', {
                name: newChatName.trim(),
                creator: username,
                members: groupMembers // Include members list
            });

            // Handle success, e.g., add the group to the chat list
            console.log('Group created:', response.data);

            // Reset fields and close modal
            setNewChatName('');
            setGroupMembers([]);
            setShowCreateChatModal(false);
        } catch (err) {
            console.error('Error creating group:', err);
            alert('Failed to create group');
        }
    };

    const handleAddMember = (newMember) => {
        if (newMember && !groupMembers.includes(newMember)) {
            setGroupMembers([...groupMembers, newMember]);
        }
    };

    const handleAddFriend = async () => {
        if (!friendUsername.trim() || username === friendUsername) return;

        try {
            const currentChat = chats.find(c => c.id === activeChat);

            if (currentChat?.isGroup) {
                await axios.post(`http://localhost:3000/api/groupChats/${activeChat}/add-member`, {
                    username: friendUsername
                });

                setChats(prev => prev.map(chat =>
                    chat.id === activeChat
                        ? { ...chat, members: [...new Set([...chat.members, friendUsername])] }
                        : chat
                ));
            } else {
                const response = await axios.post('http://localhost:3000/api/groupChats', {
                    name: `${username} and ${friendUsername}`,
                    creator: username,
                    members: [username, friendUsername]
                });

                const newChat = {
                    id: response.data._id,
                    name: response.data.name,
                    lastMessage: 'Chat started',
                    time: formatDate(new Date()),
                    unread: 0,
                    members: [username, friendUsername],
                    isGroup: true
                };

                setChats(prev => [...prev, newChat]);
                setActiveChat(response.data._id);
                setMessages([]);
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
                {/* Sidebar header */}
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
                        >
                            &times;
                        </button>
                    )}
                </div>

                {/* Search */}
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
                            />
                        </div>
                    </div>
                )}

                {/* Chat list */}
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
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 cursor-pointer">
                                {chat.name.charAt(0).toUpperCase()}
                            </div>
                            {showSidebar && (
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                        <h3 className="font-medium text-gray-900 truncate cursor-pointer">{chat.name}</h3>
                                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2 cursor-default">{chat.time}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate cursor-pointer">{chat.lastMessage}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-gray-500 cursor-default">
                                            {chat.isGroup ? `${chat.members.length} members` : ''} • {chat.lastSeen || ''}
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

                {/* Sidebar footer */}
                {showSidebar && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
                        <button
                            onClick={() => {
                                setIsGroupChat(false);
                                setShowCreateChatModal(true);
                            }}
                            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 cursor-pointer"
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
                        >
                            <FiUserPlus className="mr-2" />
                            New Group Chat
                        </button>
                    </div>
                )}
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col">
                {/* Chat header */}
                <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center">
                        {!showSidebar && (
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="mr-3 text-gray-500 hover:text-blue-600 cursor-pointer"
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
                        >
                            <FiMoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                                <button
                                    onClick={() => {
                                        setShowAddFriendModal(true);
                                        setShowMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                >
                                    Add Friend
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLogoutModal(true);
                                        setShowMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                >
                                    Log Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">No messages yet. Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
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

                {/* Message input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-500 hover:text-blue-600 cursor-pointer">
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
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className={`p-2 rounded-full ${newMessage.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-400'} cursor-pointer`}
                        >
                            <FiSend size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Chat Modal */}
            {showCreateChatModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4 text-center cursor-default">
                            {isGroupChat ? 'Create New Group' : 'New Chat'}
                        </h3>
                        <input
                            type="text"
                            value={newChatName}
                            onChange={(e) => setNewChatName(e.target.value)}
                            className="w-full p-3 mb-4 border border-gray-300 rounded-lg cursor-text"
                            placeholder={isGroupChat ? 'Group name' : 'Chat name'}
                        />

                        {isGroupChat && (
                            <div className="mb-4">
                                <div className="flex mb-2">
                                    <input
                                        type="text"
                                        value={newMember}
                                        onChange={(e) => setNewMember(e.target.value)}
                                        className="flex-1 p-2 border border-gray-300 rounded-l-lg cursor-text"
                                        placeholder="Add member username"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newMember.trim() && !groupMembers.includes(newMember)) {
                                                setGroupMembers([...groupMembers, newMember]);
                                                setNewMember('');
                                            }
                                        }}
                                        className="bg-blue-500 text-white px-3 rounded-r-lg hover:bg-blue-600 cursor-pointer"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="max-h-32 overflow-y-auto">
                                    {groupMembers.map((member, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded mb-1">
                                            <span className="cursor-default">{member}</span>
                                            <button
                                                onClick={() => setGroupMembers(groupMembers.filter(m => m !== member))}
                                                className="text-red-500 hover:text-red-700 cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowCreateChatModal(false);
                                    setNewChatName('');
                                    setGroupMembers([]);
                                }}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateChat}
                                disabled={!newChatName.trim()}
                                className={`px-4 py-2 rounded-lg ${newChatName.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500'} cursor-pointer`}
                            >
                                {isGroupChat ? 'Create Group' : 'Create Chat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Friend Modal */}
            {showAddFriendModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4 text-center cursor-default">Add Friend</h3>
                        <input
                            type="text"
                            value={friendUsername}
                            onChange={(e) => setFriendUsername(e.target.value)}
                            className="w-full p-3 mb-4 border border-gray-300 rounded-lg cursor-text"
                            placeholder="Enter friend's username"
                        />
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowAddFriendModal(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddFriend}
                                disabled={!friendUsername.trim() || username === friendUsername}
                                className={`px-4 py-2 rounded-lg ${friendUsername.trim() && username !== friendUsername ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500'} cursor-pointer`}
                            >
                                Add Friend
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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