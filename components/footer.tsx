export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left lg:px-8">
        <p>© {new Date().getFullYear()} LessonPlanner. Built for teachers.</p>
        <p className="text-xs sm:text-sm">
          Turn your question bank into a ready lesson plan.
        </p>
      </div>
    </footer>
  );
}
