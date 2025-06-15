// chatpage/src/utils/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET || '07009df1d947420e8fb391abe049fc9f6528b61987c38b118eb76e98f39f3d02c68615bc8ca1f431c2f44e154de4c47d0eb9a81a4993499426014e788224bd85';

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];  // Get token from header

  if (!token) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Verify token
    req.user = decoded;  // Store decoded user data in req.user
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// You can also export other functions if needed
