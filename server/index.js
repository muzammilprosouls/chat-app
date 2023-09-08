import express from 'express';
import dotenv from 'dotenv/config';
import mongoDBConnect from './mongoDB/connection.js';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import messageRoutes from './routes/message.js';
import * as Server from 'socket.io';

const app = express();
const corsConfig = {
  origin: process.env.BASE_URL,
  credentials: true,
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsConfig));
app.use('/', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);
mongoose.set('strictQuery', false);
mongoDBConnect();
const server = http.createServer(app); // Create an HTTP server instance
server.listen(process.env.PORT, () => {
  console.log(`Server Listening at PORT - ${process.env.PORT}`);
});
// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // Add your frontend origin here
  },
});
// Create a map to store online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('setup', (userData) => {
    // Mark the user as online when they connect
    onlineUsers.set(userData.id, socket.id);
    socket.emit('connected');
  });

  socket.on('join room', (room) => {
    socket.join(room);
  });

  socket.on('typing', (room) => socket.in(room).emit('typing'));

  socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

  socket.on('new message', (newMessageRecieve) => {
    const chat = newMessageRecieve.chatId;
    if (!chat.users) console.log('chats.users is not defined');
    chat.users.forEach((user) => {
      if (user._id == newMessageRecieve.sender._id) return;
      // Check if the user is online and emit the message
      if (onlineUsers.has(user._id)) {
        io.to(onlineUsers.get(user._id)).emit('message received', newMessageRecieve);
      }
    });
  });

  socket.on('disconnect', () => {
    // Mark the user as offline when they disconnect
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
      }
    });
  });
});