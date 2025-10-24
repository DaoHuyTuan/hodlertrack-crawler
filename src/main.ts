import WebSocket from "ws";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private lastMessageTime: number = 0;

  constructor() {
    // Validate required environment variables
    if (!process.env.CRAWLER_ID) {
      console.error("❌ CRAWLER_ID is required but not provided");
      process.exit(1);
    }

    this.config = {
      url: `${process.env.WEBSOCKET_URL}/${process.env.CRAWLER_ID}`,
      reconnectInterval: parseInt(process.env.CRAWLER_ID),
    };
  }

  public connect(): void {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      console.log("Already connected or connecting...");
      return;
    }

    this.isConnecting = true;
    console.log(`Attempting to connect to WebSocket: ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.on("open", () => {
        console.log("✅ WebSocket connected successfully");
        console.log("🔗 Connection URL:", this.config.url);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();

        // Send welcome message immediately after connection
        console.log("📤 Sending welcome message...");
        this.sendMessage({
          type: "welcome",
        });
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        console.log("📨 Received message:", data);
        this.handleMessage(data);
      });

      this.ws.on("close", (code: number, reason: string) => {
        console.log(`❌ WebSocket closed. Code: ${code}, Reason: ${reason}`);
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.on("error", (error: Error) => {
        console.error("❌ WebSocket error:", error.message);
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error("❌ Failed to create WebSocket connection:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = data.toString();
      this.lastMessageTime = Date.now();
      console.log("📨 Received message:", message);

      // Parse JSON if possible
      try {
        const parsedMessage = JSON.parse(message);
        console.log("📋 Parsed message:", parsedMessage);

        // Handle ping from server
        if (parsedMessage.type === "ping") {
          console.log("🏓 Received ping from server, sending pong...");
          this.sendMessage({
            type: "pong",
          });
        } else {
          console.log("ℹ️ Received other message type:", parsedMessage.type);
        }
      } catch {
        // Not JSON, treat as plain text
        console.log("📝 Plain text message:", message);

        // Check if it's a plain text ping
        if (message.toLowerCase().trim() === "ping") {
          console.log(
            "🏓 Received plain text ping from server, sending pong..."
          );
          this.sendMessage({
            type: "pong",
          });
        }
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(
      `🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${this.config.reconnectInterval}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public sendMessage(message: string | object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("❌ Cannot send message: WebSocket is not connected");
      return;
    }

    try {
      const data =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws.send(data);
      console.log("📤 Message sent:", data);
    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  }

  public disconnect(): void {
    console.log("🔌 Disconnecting WebSocket...");
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getConnectionStatus(): string {
    if (!this.ws) return "disconnected";

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
        return "closing";
      case WebSocket.CLOSED:
        return "closed";
      default:
        return "unknown";
    }
  }

  public getLastMessageTime(): number {
    return this.lastMessageTime;
  }
}

// Main application
class App {
  private wsClient: WebSocketClient;

  constructor() {
    this.wsClient = new WebSocketClient();
    this.setupGracefulShutdown();
  }

  public start(): void {
    console.log("🚀 Starting HodlerTrack Crawler...");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

    // Connect to WebSocket
    this.wsClient.connect();

    // Log connection status every 10 seconds
    setInterval(() => {
      const status = this.wsClient.getConnectionStatus();
      console.log(`📊 Connection status: ${status}`);

      // Check if we haven't received any messages for a while
      if (status === "connected") {
        const timeSinceLastMessage =
          Date.now() - this.wsClient.getLastMessageTime();
        if (timeSinceLastMessage > 30000) {
          // 30 seconds
          console.log(
            "⚠️ No messages received from server for",
            Math.floor(timeSinceLastMessage / 1000),
            "seconds"
          );
        }
      }
    }, 10000);
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      this.wsClient.disconnect();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }
}

// Start the application
const app = new App();
app.start();
