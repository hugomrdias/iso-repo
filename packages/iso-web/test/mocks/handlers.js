import { rest } from 'msw'

let expireCount = 0
export const handlers = [
  rest.get('https://cloudflare-dns.com/dns-query', (req, res, ctx) => {
    const params = Object.fromEntries(req.url.searchParams)

    if (params.name === 'google.com' && params.type === 'A') {
      return res(
        ctx.status(200),
        ctx.json({
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [{ name: 'google.com', type: 1 }],
          Answer: [
            { name: 'google.com', type: 1, TTL: 100, data: '142.250.184.174' },
          ],
        })
      )
    }

    if (params.name === 'expires.com' && params.type === 'A') {
      expireCount++
      return res(
        ctx.status(200),
        ctx.json({
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [{ name: 'google.com', type: 1 }],
          Answer: [
            {
              name: 'google.com',
              type: 1,
              TTL: 1,
              data: expireCount === 1 ? '142.250.184.174' : `${expireCount}`,
            },
          ],
        })
      )
    }
  }),
]
