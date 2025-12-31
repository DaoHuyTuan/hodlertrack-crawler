import dotenv from 'dotenv'
import { Crawler } from './crawler/index.js'
import { SocketClient } from './ws/socket-client.js'

// Load environment variables
dotenv.config()

// Initialize socket client
const socketUrl =
  process.env['WEBSOCKET_URL'] || 'ws://localhost:3000/ws/v1/crawler-events'

const socket_client = new SocketClient(socketUrl)

// Initialize crawler
const crawler = new Crawler(socket_client, {
  id: process.env['CRAWLER_ID'] as string,
  name: process.env['CRAWLER_NAME'] as string,
  symbol: process.env['CRAWLER_SYMBOL'] as string,
  chain: process.env['CRAWLER_CHAIN'] as string,
  image: process.env['CRAWLER_IMAGE'] as string
})

// Start socket first, then start crawler after socket is connected
socket_client
  .connect()
  .then(() => {
    console.log('✅ Socket connected, starting crawler...')
    crawler.start()
  })
  .catch(error => {
    console.error('❌ Failed to connect socket:', error)
    process.exit(1)
  })
