class WebSocketService {
    constructor() {
        this.io = null;
    }

    init(server) {
        const { Server } = require('socket.io');
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`[Web] Dashboard connected: ${socket.id}`);
            socket.on('disconnect', () => {
                console.log(`[Web] Dashboard disconnected: ${socket.id}`);
            });
        });
    }

    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
}

module.exports = new WebSocketService();
