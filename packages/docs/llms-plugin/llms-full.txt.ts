import { site } from 'astro:config/client'
import config from 'virtual:llms-plugin/config'
import type { APIRoute } from 'astro'
import { generateLlmsIndex } from './utils'

export const GET: APIRoute = () => {
  return generateLlmsIndex(site, config, Number.POSITIVE_INFINITY)
}
