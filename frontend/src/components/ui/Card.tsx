import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        interactive &&
          "transition-all duration-150 hover:border-line-strong hover:shadow-glow cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}
