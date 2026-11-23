export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M11 14v-3a5 5 0 0 1 10 0v3"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-primary-foreground"
        />
        <rect x="8" y="14" width="16" height="11" rx="2.5" className="fill-primary-foreground" />
        <circle cx="16" cy="19.5" r="2" className="fill-accent" />
      </svg>
      <span>
        LOCK<span className="text-primary">IN</span>
      </span>
    </span>
  );
}
