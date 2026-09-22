import { ShieldCheck } from "lucide-react";
export function Shell({ children }) {
  return (
    <div className="signal-shell signal-grid">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-360 items-center justify-between px-5 py-4 sm:px-8">
          <a
            data-testid="link-signal-home"
            href="/"
            className="focus-ring flex items-center gap-3 rounded-lg"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <span className="h-4 w-4 rounded-full border-[3px] border-current" />
            </span>
            <span>
              <span className="display block text-xl font-bold leading-none">
                SIGNAL
              </span>
              <span className="hidden text-xs font-semibold tracking-[.14em] text-muted-foreground sm:block">
                CLEAR COMMUNICATION PLANS
              </span>
            </span>
          </a>
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">
              Chuẩn bị giao tiếp theo lựa chọn của bạn.
            </span>
            <span className="sm:hidden">Bạn quyết định.</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
