export const transactions_query = (last_timestamp: string) => {
  const whereClause = last_timestamp
    ? `where: { timestamp_gt: "${last_timestamp}" }`
    : ''
  return `
    {
      transactions(first: 5, orderBy: timestamp, orderDirection: asc, ${whereClause}) {
        id
        hash
        from
        to
        value
        timestamp
      }
    }
  `
}
