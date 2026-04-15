import { getCollection } from 'astro:content'
import type { APIRoute, GetStaticPaths } from 'astro'
import { type DocEntry, getMarkdownPath, stripMdxSyntax } from './strip'

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getCollection(
    'docs',
    (doc: { data: { draft?: boolean } }) => !doc.data.draft
  )

  return docs.map((doc) => ({
    params: { slug: getMarkdownPath(doc.id) },
    props: { doc },
  }))
}

export const GET: APIRoute = ({ props }) => {
  const { doc } = props as { doc: DocEntry }
  const body = `# ${doc.data.title}\n\n${stripMdxSyntax(doc.body).trim()}`

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
    },
  })
}
