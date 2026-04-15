import { getCollection } from 'astro:content'
import type { PageActionsConfig } from './index'
import { type DocEntry, getMarkdownPath } from './strip'

type SectionNode = {
  docs: Pick<DocEntry, 'id' | 'data'>[]
  children: Map<string, SectionNode>
}

function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function renderSection(
  node: SectionNode,
  level: number,
  path: string[],
  site: string,
  maxDepth: number
): string {
  let output = ''
  const headerLevel = '#'.repeat(level + 1)
  if (node.docs.length > 0 && path.length === 0) {
    for (const doc of node.docs) {
      const description = doc.data.description
        ? `: ${doc.data.description}`
        : ''
      output += `- [${doc.data.title}](${site}/${getMarkdownPath(doc.id)}.md)${description}\n`
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
        output += `- [${doc.data.title}](${site}/${getMarkdownPath(doc.id)}.md)${description}\n`
      }
      output += '\n'
    }

    if (level + 1 < maxDepth) {
      output += renderSection(childNode, level + 1, currentPath, site, maxDepth)
    }
  }

  return output
}

export async function generateLlmsIndex(
  site: string,
  config: PageActionsConfig,
  maxDepth: number
): Promise<Response> {
  const root: SectionNode = { docs: [], children: new Map() }
  const docs = await getCollection(
    'docs',
    (doc: { data: { draft?: boolean } }) => !doc.data.draft
  )

  let body = `# ${config.title}\n\n> ${config.description}\n\n`

  for (const doc of docs) {
    const segments = doc.id.split('/')
    let current = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      if (segment === undefined) {
        continue
      }
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

  body += renderSection(root, 1, [], site, maxDepth)

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
    },
  })
}
