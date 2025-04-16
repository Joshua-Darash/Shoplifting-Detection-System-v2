import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:5000' : ''; // Relative path in prod

class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io(SOCKET_URL, { autoConnect: true });
    this.socket.on('connect', () => console.log('Connected to Flask backend'));
    this.socket.on('disconnect', () => console.log('Disconnected from Flask backend'));
  }

  on(event: string, callback: (data: any) => void) {
    this.socket.on(event, callback);
  }

  emit(event: string, data?: any) {
    this.socket.emit(event, data);
  }

  disconnect() {
    this.socket.disconnect();
  }
}

export const socketService = new SocketService();