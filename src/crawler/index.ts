import { Graffle } from 'graffle'
import { transactions_query } from '../queries/index.js'
import { SocketClient } from '../ws/socket-client.js'
import { CRAWLER_EVENTS } from '../utils/variables.js'

export interface CrawlerConfig {
  id: string
  subgraph?: string
  name: string
  symbol: string
  chain: string
  start_block?: string
  current_block?: string
  last_timestamp?: string // Last fetched transaction timestamp for pagination
  image: string
  subgraph_id?: string
  subgraph_token?: string
}

interface Transaction {
  id: string
  hash: string
  from: string
  to: string | null
  value: string
  timestamp: string
}

export class Crawler {
  private socket: SocketClient
  private id: string
  private subgraph: string
  private name: string
  private symbol: string
  private chain: string
  private start_block: string
  private current_block: string
  private timestamp_gt: string // Cursor for pagination - stores last fetched transaction timestamp
  private status: 'running' | 'stoped' | 'error' | 'idle'
  private created_at: Date
  private updated_at: Date
  private image: string
  private subgraph_id?: string
  private subgraph_url?: string
  private subgraph_token?: string
  private crawlInterval: NodeJS.Timeout | null = null
  private crawlIntervalMs: number = 5000 // Default 5 seconds

  constructor(socket: SocketClient, configs: CrawlerConfig) {
    this.socket = socket
    this.id = configs.id
    this.name = configs.name
    this.symbol = configs.symbol
    this.chain = configs.chain
    this.start_block = configs.start_block || ''
    this.current_block = configs.current_block || ''
    this.timestamp_gt = configs.last_timestamp || '' // Initialize pagination cursor from last timestamp
    this.created_at = new Date()
    this.updated_at = new Date()
    this.image = configs.image
    this.status = 'idle'
    this.subgraph_id = configs.subgraph_id
      ? configs.subgraph_id
      : (process.env['SUBGRAPH_ID'] as string)
    this.subgraph_token = configs.subgraph_token
      ? configs.subgraph_token
      : (process.env['SUBGRAPH_TOKEN'] as string)
    this.subgraph = configs.subgraph
      ? configs.subgraph
      : this.create_subgraph_url()
  }

  private create_subgraph_url = () => {
    // return `${process.env.SUBGRAPH_END_POINT}/${this.subgraph_id}`
    return 'https://api.studio.thegraph.com/query/110670/pepe-txs/version/latest'
  }

  public stats = () => {
    return {
      id: this.id,
      subgraph: this.subgraph,
      name: this.name,
      symbol: this.symbol,
      chain: this.chain,
      start_block: this.start_block,
      current_block: this.current_block,
      timestamp_gt: this.timestamp_gt, // Current pagination cursor
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
      image: this.image
    }
  }

  public start = async () => {
    if (this.status === 'running') {
      return
    }
    this.status = 'running'
    this.updated_at = new Date()

    // Run initial crawl
    // await this.crawl()

    // Set up interval to run crawl continuously
    this.crawlInterval = setInterval(async () => {
      if (this.status === 'running') {
        await this.crawl()
      }
    }, this.crawlIntervalMs)
  }

  private create_graffle = () => {
    return Graffle.create().transport({
      url: this.subgraph,
      headers: {
        Authorization: `Bearer ${this.subgraph_token}`
      }
    })
  }

  private handle_respone = data => {
    if (data && data.transactions) {
      const last_txs = data.transactions[data.transactions.length - 1]
      this.timestamp_gt = last_txs.timestamp
      console.log('last_txs.timestamp', last_txs.timestamp)
      console.log('this.timestamp_gt', this.timestamp_gt)
      this.updated_at = new Date()
      console.log(`📍 Updated timestamp_gt to: ${this.timestamp_gt}`)
      return data.transactions
    }
    return data.transactions
  }

  private get_query = () => {
    return transactions_query(this.timestamp_gt)
  }

  public crawl = async () => {
    try {
      console.log('transactions_query', this.get_query())
      const graffle = this.create_graffle()
      console.log('this.timestamp_gt', this.timestamp_gt)
      const query = this.get_query()
      const response = await graffle.gql(query).$send()
      const result = this.handle_respone(response)

      this.send_events(result as Transaction[])
      console.log('response', response)
    } catch (error) {
      this.status = 'error'
      this.updated_at = new Date()
      console.error(error)
    }
  }

  public send_events = (data: Transaction[]) => {
    if (!this.socket.isConnected()) {
      console.warn('⚠️ Socket not connected, cannot send events')
      return
    }

    const eventData = {
      crawler_id: this.id,
      crawler_name: this.name,
      crawler_symbol: this.symbol,
      chain: this.chain,
      timestamp: new Date().toISOString(),
      transactions: data,
      count: data.length
    }

    const events = {
      type: 'transactions:data:new',
      data: eventData
    }
    this.socket.emit(CRAWLER_EVENTS.EVENTS, events)
    console.log(`📤 Sent ${data.length} transactions from crawler ${this.name}`)
  }

  public stop = () => {
    this.status = 'stoped'
    this.updated_at = new Date()

    if (this.crawlInterval) {
      clearInterval(this.crawlInterval)
      this.crawlInterval = null
    }

    console.log(`🛑 Crawler ${this.name} stopped`)
  }

  public setCrawlInterval(intervalMs: number): void {
    this.crawlIntervalMs = intervalMs
    if (this.status === 'running' && this.crawlInterval) {
      clearInterval(this.crawlInterval)
      this.crawlInterval = setInterval(async () => {
        if (this.status === 'running') {
          await this.crawl()
        }
      }, this.crawlIntervalMs)
    }
  }
}
