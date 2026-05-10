export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
      <p className="text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm text-red-600 underline">
          重试
        </button>
      )}
    </div>
  )
}
