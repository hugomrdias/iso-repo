/* eslint-disable unicorn/no-useless-undefined */
/* eslint-disable unicorn/no-null */
import { route } from 'preact-router'
import { useWebNative } from './hooks/use-webnative.js'
import * as wn from 'webnative'
import { useEffect, useState } from 'preact/hooks'

const branch = wn.path.RootBranch.Public

/**
 * @param {import('preact').Attributes} props
 */
export default function Home(props) {
  const { session, setSession } = useWebNative({
    redirectTo: '/login',
  })

  const [files, setFiles] = useState(
    /** @type {import('webnative/fs/types').Links | undefined} */ (undefined)
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
        const files = await fs.ls(wn.path.directory(branch, 'test'))
        console.log(
          '🚀 ~ file: home.jsx:28 ~ list ~ files',
          Object.values(files)
        )
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

  return (
    <div>
      <h2>Files</h2>

      {files
        ? Object.values(files).map((file) => {
            return <div key={file.name}>{file.name}</div>
          })
        : 'N/A'}

      <h2>Upload</h2>
      <input type="file" id="input" onChangeCapture={onUpload} />
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
