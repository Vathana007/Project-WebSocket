# Express WebSocket MongoDB Example

This project is a simple Express.js connected to MongoDB Atlas using Mongoose. It demonstrates basic CRUD operations for a `User` model.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or a local MongoDB instance)

## Setup

1. **Install dependencies**
   ```sh
   npm init -y
   npm install express mongoose dotenv
   npm install --save-dev nodemon
    
   npm install tailwindcss @tailwindcss/vite
   npm install react-icons
   npm install socket.io
   npm install socket.io-client

   ```

2. **Configure environment variables**

   Create a `.env` file in the project root with the following content:

   ```
   PORT=3000
   MONGO_URI=your_mongodb_connection_string
   ```

   Replace `your_mongodb_connection_string` with your actual MongoDB Atlas URI.

3. **Start the server**

   For development (with auto-reload):
   ```sh
   npm run dev
   ```

   For production:
   ```sh
   npm start
   `````

## Project Structure

```
express_websocket/
├── models/
│   └── User.js
├── server.js
├── .env
├── package.json
└── README.md
```

## Notes

- Make sure your MongoDB Atlas user has the correct privileges and your IP is whitelisted.
- Do **not** commit your `.env` file or credentials to public repositories.

---

Feel free to modify and extend this project!