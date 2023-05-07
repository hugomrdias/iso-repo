/* eslint-disable unicorn/no-useless-undefined */
/* eslint-disable unicorn/no-null */
import { useWebNative } from './hooks/use-webnative.js'
import * as wn from 'webnative'
import { useEffect, useState } from 'preact/hooks'

const branch = wn.path.RootBranch.Private

/**
 * @param {import('preact').Attributes} props
 */
export default function Home(props) {
  const { session, setSession, isValidating } = useWebNative({
    redirectTo: '/login',
  })
  const [files, setFiles] = useState(
    /** @type {Array<{src: string, path: string}> | undefined} */ (undefined)
  )

  useEffect(() => {
    getFiles(session)
  }, [session])

  /**
   *
   * @param {import('webnative').Session | null} [session]
   */
  async function getFiles(session) {
    if (session && session.fs) {
      const { fs } = session
      const path = wn.path.directory(branch, 'test')
      if (await fs.exists(path)) {
        const links = await fs.ls(path)
        const files = await Promise.all(
          Object.entries(links).map(async ([name]) => {
            const filepath = wn.path.combine(path, wn.path.file(name))
            const file = await fs.get(filepath)

            if (!file) return
            console.log('🚀 ~ file: home.jsx:49 ~ Object.entries ~ file:', file)
            // Create a blob to use as the image `src`
            const blob = new Blob([file.content])
            const src = URL.createObjectURL(blob)

            return {
              path: filepath.file.join('/'),
              src,
              // cid: file.cid.toString(),
            }
          })
        )

        console.log(files)
        setFiles(files)
      }
    }
  }

  async function onUpload() {
    const fileEl = document.querySelector('input[type="file"]')
    if (fileEl && session && session.fs) {
      const { fs } = session
      const file = /** @type {File} */ (fileEl.files[0])
      console.log('🚀 ~ file: home.jsx:44 ~ onUpload ~ file', file)

      await fs.write(
        wn.path.file(branch, 'test', file.name),
        new Uint8Array(await new Blob([file]).arrayBuffer())
      )

      // Announce the changes to the server
      await fs.publish()

      getFiles(session)
    }
  }

  if (isValidating) {
    return <div>Loading...</div>
  }
  return (
    <div>
      <h2>Upload</h2>
      <input type="file" id="input" onChangeCapture={onUpload} />
      <h2>Files</h2>

      {files
        ? Object.values(files).map((file) => {
            return (
              <div key={file.path}>
                {file.path}
                <img src={file.src} width="100" />
              </div>
            )
          })
        : 'N/A'}

      <h2>Account</h2>
      <div>{session?.username}</div>
      <button
        type="button"
        onClick={async () => {
          if (session) {
            await session.destroy()
            setSession(null)
          }
        }}
      >
        Logout
      </button>
    </div>
  )
}
