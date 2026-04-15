export interface DocEntry {
  id: string
  body: string
  data: {
    title: string
    description?: string
    draft?: boolean
  }
}

export function getMarkdownPath(docId: string): string {
  const pathSegments = docId.split('/')
  const fileName = pathSegments[pathSegments.length - 1]

  if (fileName === 'index') {
    if (pathSegments.length === 1) {
      return 'index'
    }

    const directories = pathSegments.slice(0, -2).join('/')
    const folderName = pathSegments[pathSegments.length - 2]

    return directories
      ? `${directories}/${folderName}`
      : (folderName ?? 'index')
  }

  const directories = pathSegments.slice(0, -1).join('/')
  return directories ? `${directories}/${fileName}` : (fileName ?? 'index')
}

const jsxTagLine = /^\s*<\/?[A-Z][\w.]*(?:\s[^>]*)?\/?>\s*$/

export function stripMdxSyntax(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let codeBlockDepth = 0

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```')) {
      if (codeBlockDepth > 0 && trimmed === '```') {
        codeBlockDepth--
      } else {
        codeBlockDepth++
      }
      result.push(line)
      continue
    }

    if (codeBlockDepth > 0) {
      result.push(line)
      continue
    }

    if (trimmed.startsWith('import ')) {
      continue
    }

    if (jsxTagLine.test(line)) {
      continue
    }

    result.push(line)
  }

  return result.join('\n')
}
