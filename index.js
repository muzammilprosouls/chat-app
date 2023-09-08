import express from 'express';
import dotenv from 'dotenv';
import mongoDBConnect from './mongoDB/connection.js';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import messageRoutes from './routes/message.js';
import * as Server from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use(express.static(path.join(__dirname, './clients/build')))
app.use('*', function (req, res) {
  res.sendFile(path.join(__dirname, "./clients/build/index.html"));
})
mongoose.set('strictQuery', false);
mongoDBConnect();
const server = app.listen(process.env.PORT, () => {
  console.log(`Server Listening at PORT - ${process.env.PORT}`);
});
const io = new Server.Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: 'http://localhost:3000',
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