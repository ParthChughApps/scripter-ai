export function Loader() {
  return (
    <div className="flex flex-col justify-center items-center py-12 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-600 dark:border-purple-400 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">Generating your scripts...</p>
    </div>
  );
}

