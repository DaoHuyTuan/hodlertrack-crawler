import { Socket, io } from 'socket.io-client'

export class SocketClient {
  private socket: Socket | null = null
  private url: string

  constructor(url: string) {
    this.url = url
    console.log(this.url)
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url)
      console.log('this.url', this.url)

      this.socket.on('connect', () => {
        console.log('🔌 Socket connected')
        resolve()
      })

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected')
      })

      this.socket.on('error', error => {
        console.log('🔌 Socket error', error)
        reject(error)
      })

      // Timeout after 10 seconds if connection doesn't establish
      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error('Socket connection timeout'))
        }
      }, 10000)
    })
  }

  public emit = (event: string, data: any) => {
    this.socket?.emit(event, data)
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      console.log('🔌 Socket disconnected')
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  public getSocket(): Socket | null {
    return this.socket
  }
}
