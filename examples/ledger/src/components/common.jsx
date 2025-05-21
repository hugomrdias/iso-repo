/**
 * Displays an error message in a styled box
 *
 * @param {object} param0
 * @param {Error} param0.error - Error object to display
 */
export function ErrorBox({ error }) {
  return (
    <div
      style={{
        backgroundColor: 'rgb(191 97 106 / 50%)',
        color: 'white',
        borderRadius: '6px',
        padding: '10px',
        marginTop: '10px',
      }}
    >
      <h4>Error</h4>
      <p>{error.message}</p>
      <small> {error.cause?.toString()} </small>
    </div>
  )
}
