let io = null;

const setSocketIO = (instance) => { io = instance; };
const getSocketIO = () => io;

const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;
  io.to(`user:${String(userId)}`).emit(event, payload);
  return true;
};

const emitToDriver = (driverId, event, payload) => {
  if (!io || !driverId) return false;
  io.to(`driver:${String(driverId)}`).emit(event, payload);
  return true;
};

const emitToRole = (role, event, payload) => {
  if (!io || !role) return false;
  io.to(`role:${String(role)}`).emit(event, payload);
  return true;
};

const emitToAll = (event, payload) => {
  if (!io) return false;
  io.emit(event, payload);
  return true;
};

module.exports = { setSocketIO, getSocketIO, emitToUser, emitToDriver, emitToRole, emitToAll };

