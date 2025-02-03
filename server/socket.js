import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessagesModel.js";

const setupSocket = (server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ORIGIN || "http://localhost:3000", // Fallback to localhost if ORIGIN is not set
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const disconnect = (socket) => {
    console.log(`Client Disconnected: ${socket.id}`);
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  };

  const sendMessage = async (message) => {
    try {
      const senderSocketId = userSocketMap.get(message.sender);
      const recipientSocketId = userSocketMap.get(message.recipient);

      const createdMessage = await Message.create(message);

      const messageData = await Message.findById(createdMessage._id)
        .populate("sender", "id email firstName lastName image color")
        .populate("recipient", "id email firstName lastName image color");

      if (recipientSocketId) {
        io.to(recipientSocketId).emit("receiveMessage", messageData);
      }
      if (senderSocketId) {
        io.to(senderSocketId).emit("receiveMessage", messageData);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  io.on("connection", (socket) => {
    console.log("New connection attempt:", socket.id);
    const userId = socket.handshake.query.userId;
    console.log("User ID from handshake:", userId);

    if (!userId) {
      console.error("User ID is missing during connection");
      socket.disconnect(true);
      return;
    }

    userSocketMap.set(userId, socket.id);
    console.log(`User Connected: ${userId} with socket ID ${socket.id}`);

    socket.on("sendMessage", sendMessage);

    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;