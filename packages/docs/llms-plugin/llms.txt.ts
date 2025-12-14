// @ts-expect-error - TODO: fix this
import { site } from 'astro:config/client'
// @ts-expect-error - TODO: fix this
import { getCollection, type InferEntrySchema } from 'astro:content'
import config from 'virtual:llms-plugin/config'
import type { APIRoute } from 'astro'

/**
 * Route that generates a single plaintext Markdown document from the full website content.
 */
export const GET: APIRoute = async () => {
  type SectionNode = {
    docs: { id: string; data: InferEntrySchema<'docs'> }[]
    children: Map<string, SectionNode>
  }

  function toTitleCase(str: string): string {
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const root: SectionNode = { docs: [], children: new Map() }
  // @ts-expect-error - TODO: fix this
  const docs = await getCollection('docs', (doc) => !doc.data.draft)
  let body = `# ${config.title}\n\n${config.description}\n\n`

  for (const doc of docs) {
    const segments = doc.id.split('/')
    let current = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      if (!current.children.has(segment)) {
        current.children.set(segment, { docs: [], children: new Map() })
      }
      const next = current.children.get(segment)
      if (next) {
        current = next
      }
    }
    current.docs.push({ id: doc.id, data: doc.data })
  }

  function renderSection(
    node: SectionNode,
    level: number,
    path: string[]
  ): string {
    let output = ''
    const headerLevel = '#'.repeat(level + 1)
    if (node.docs.length > 0 && path.length === 0) {
      for (const doc of node.docs) {
        const description = doc.data.description
          ? `: ${doc.data.description}`
          : ''
        output += `- [${doc.data.title}](${site}/${doc.id}.md)${description}\n`
      }
      output += '\n'
    }

    for (const [segment, childNode] of node.children.entries()) {
      const currentPath = [...path, segment]
      output += `${headerLevel} ${toTitleCase(segment)}\n\n`
      if (childNode.docs.length > 0) {
        for (const doc of childNode.docs) {
          const description = doc.data.description
            ? `: ${doc.data.description}`
            : ''
          output += `- [${doc.data.title}](${site}/${doc.id}.md)${description}\n`
        }
        output += '\n'
      }
      output += renderSection(childNode, level + 1, currentPath)
    }

    return output
  }

  body += renderSection(root, 1, [])

  return new Response(body)
}
