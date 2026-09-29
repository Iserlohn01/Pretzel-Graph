import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn"
import { Spinner } from "./spinner"


export const buttonVariants = cva(
  `
    cursor-pointer 
    focus-visible:border-ring 
    focus-visible:ring-ring/50 
    aria-invalid:ring-destructive/20 
    dark:aria-invalid:ring-destructive/40 
    aria-invalid:border-destructive 
    dark:aria-invalid:border-destructive/50 
    rounded-md border border-transparent text-sm font-medium 
    focus-visible:ring-[3px] 
    aria-invalid:ring-[3px] 
    [&_svg:not([class*='size-'])]:size-4 
    [&_svg]:pointer-events-none 
    inline-flex items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,opacity]
    disabled:pointer-events-none disabled:opacity-50 
    shrink-0 [&_svg]:shrink-0 outline-none group/button select-none
    shadow-md shadow-black/10
  `,
  {
    variants: {
      variant: {
        default: `
          bg-primary border-primary-accent text-primary-foreground 
          hover:bg-primary-hover [a]:hover:bg-primary/80
        `,
        outline: `
          border-border bg-input hover:bg-muted hover:text-foreground shadow-none
          dark:border-border dark:hover:bg-input/50 
          aria-expanded:bg-muted aria-expanded:text-foreground
        `,
        secondary: `
          bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none
          aria-expanded:bg-secondary aria-expanded:text-secondary-foreground
        `,
        ghost: `
          hover:bg-muted shadow-none hover:text-foreground dark:hover:bg-muted
          aria-expanded:bg-muted aria-expanded:text-foreground
        `,
        "ghost-primary": `
          shadow-none text-primary
          hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/20
          aria-expanded:bg-primary/15 aria-expanded:text-primary
          dark:aria-expanded:bg-primary/20
        `,
        "ghost-success": `
          shadow-none text-emerald-600 dark:text-emerald-500
          hover:bg-emerald-400/20 hover:text-emerald-800 dark:hover:text-emerald-300
          aria-expanded:bg-emerald-400/20 aria-expanded:text-emerald-800
          dark:aria-expanded:bg-emerald-500/20 dark:aria-expanded:text-emerald-300
        `,
        "ghost-destructive": `
          shadow-none text-red-600 dark:text-red-500
          hover:bg-red-500/20 hover:text-red-900 dark:hover:text-red-600
          aria-expanded:bg-red-400/20 aria-expanded:text-red-800
          dark:aria-expanded:bg-red-500/20 dark:aria-expanded:text-red-300
        `,
        destructive: `
          bg-red-400/40 text-red-700 hover:bg-red-400/80 shadow-none not-dark:hover:border-red-400
          dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900/80
          focus-visible:ring-red-600/20 dark:focus-visible:ring-red-600/40 
          focus-visible:border-red-600/40
        `,
        warning: `
          bg-yellow-400/50 text-amber-900 hover:bg-amber-200 shadow-none not-dark:hover:border-amber-400
          dark:bg-amber-400/50 dark:text-yellow-100 dark:hover:bg-amber-400/80
          focus-visible:ring-amber-500/20 
          dark:focus-visible:ring-amber-500/40 focus-visible:border-amber-500/40
        `,
        success: `
          bg-emerald-400/50  text-emerald-700 hover:bg-emerald-400/80 shadow-none
          dark:bg-emerald-700/50  dark:text-emerald-300
          dark:hover:bg-emerald-700/80 focus-visible:ring-emerald-500/20
          dark:focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40
        `,
        accent: `
          bg-accent/10 border-accent/50 hover:bg-accent/20 
          focus-visible:ring-accent/20 dark:focus-visible:ring-accent/40 
          dark:bg-accent/20 text-accent-foreground 
          focus-visible:border-accent/40 dark:hover:bg-accent/30
        `,
        link: `
          text-primary shadow-none underline-offset-4 hover:underline
        `,
        input: `
          bg-input border-border
        `,
        active: `
          bg-sky-400/20 text-sky-700 hover:bg-sky-400/30 shadow-none
          dark:bg-sky-700/20 dark:text-sky-400 dark:hover:bg-sky-700/30
          focus-visible:ring-sky-600/20 dark:focus-visible:ring-sky-600/40
          focus-visible:border-sky-600/40
        `,
        "ghost-active": `
          shadow-none text-sky-700 dark:text-sky-400
          hover:bg-sky-400/20 hover:text-sky-800 dark:hover:text-sky-300
          aria-expanded:bg-sky-400/20 aria-expanded:text-sky-800
          dark:aria-expanded:bg-sky-500/20 dark:aria-expanded:text-sky-300
        `,
        "ghost-warning": `
          shadow-none text-amber-600/70 dark:text-amber-400
          hover:bg-amber-400/20 hover:text-amber-800 dark:hover:text-amber-300
          aria-expanded:bg-amber-400/20 aria-expanded:text-amber-800
          dark:aria-expanded:bg-amber-500/20 dark:aria-expanded:text-amber-300
        `,
        "language-model": `
          shadow-none border-transparent text-[var(--port-LanguageModel-foreground)]
          bg-[color-mix(in_srgb,var(--port-LanguageModel)_20%,transparent)]
          hover:bg-[color-mix(in_srgb,var(--port-LanguageModel)_32%,transparent)]
          aria-expanded:bg-[color-mix(in_srgb,var(--port-LanguageModel)_32%,transparent)]
          focus-visible:ring-[color-mix(in_srgb,var(--port-LanguageModel)_30%,transparent)]
          focus-visible:border-[color-mix(in_srgb,var(--port-LanguageModel)_40%,transparent)]
        `,
        "ghost-language-model": `
          shadow-none border-transparent text-[var(--port-LanguageModel-foreground)]
          hover:bg-[color-mix(in_srgb,var(--port-LanguageModel)_20%,transparent)]
          aria-expanded:bg-[color-mix(in_srgb,var(--port-LanguageModel)_20%,transparent)]
          focus-visible:ring-[color-mix(in_srgb,var(--port-LanguageModel)_30%,transparent)]
          focus-visible:border-[color-mix(in_srgb,var(--port-LanguageModel)_40%,transparent)]
        `,
        message: `
          shadow-none border-transparent text-[var(--port-Message-foreground)]
          bg-[color-mix(in_srgb,var(--port-Message)_20%,transparent)]
          hover:bg-[color-mix(in_srgb,var(--port-Message)_32%,transparent)]
          aria-expanded:bg-[color-mix(in_srgb,var(--port-Message)_32%,transparent)]
          focus-visible:ring-[color-mix(in_srgb,var(--port-Message)_30%,transparent)]
          focus-visible:border-[color-mix(in_srgb,var(--port-Message)_40%,transparent)]
        `
      },
      size: {
        default: "h-7 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-lg),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-lg),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 rounded-full! in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-4",
        "icon-xxs": "size-5 rounded-full! in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 rounded-full! in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// shadow-[0px_0px_8px_0.7px_oklch(0.58_0.2152_27.33)]
// shadow-[0px_0px_8px_0.7px_oklch(0.860_0.1731_91.94)]

interface IconProps {
  Icon: React.ElementType;
  iconPlacement: "left" | "right";
}

interface IconRefProps {
  Icon?: never;
  iconPlacement?: undefined;
}

export type ButtonIconProps = IconProps | IconRefProps;

export interface ButtonProps {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  asChild?: boolean;
  shouldBounce?: boolean;
  loading?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  shouldBounce = true,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={
        cn(
          buttonVariants({ variant, size, className }),
          shouldBounce && "active:scale-[0.95]",
        )
      }
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner elementClassName="fill-current!" />}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}
Button.displayName = "Button";

export { Button };

