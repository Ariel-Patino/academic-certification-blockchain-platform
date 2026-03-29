// Wraps page content to keep spacing and width consistent across screens.
import { PropsWithChildren } from "react";

interface PageContainerProps extends PropsWithChildren {
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <main className={["page-container", className].filter(Boolean).join(" ")}>{children}</main>;
}
