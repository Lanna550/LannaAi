import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const update = () => setIsMobile(mq.matches)

    update()

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }

    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  const resolvedPosition = useMemo<ToasterProps["position"]>(() => {
    if (props.position) return props.position
    return isMobile ? "top-center" : "bottom-right"
  }, [isMobile, props.position])

  const resolvedOffset = useMemo<ToasterProps["offset"]>(() => {
    if (props.offset !== undefined) return props.offset
    if (!isMobile) return 16
    return { top: "calc(env(safe-area-inset-top) + 5.75rem)" }
  }, [isMobile, props.offset])

  const resolvedToastOptions = useMemo<ToasterProps["toastOptions"]>(() => {
    const incoming = props.toastOptions
    const incomingClassNames = incoming?.classNames ?? {}

    return {
      ...incoming,
      classNames: {
        ...incomingClassNames,
        toast: [
          isMobile ? "justify-center" : null,
          "shadow-lg shadow-black/10 dark:shadow-black/40",
          "ring-1 ring-black/10 dark:ring-white/10",
          "backdrop-blur-sm",
          incomingClassNames.toast,
        ]
          .filter(Boolean)
          .join(" "),
        content: [
          isMobile ? "items-center text-center" : null,
          incomingClassNames.content,
        ]
          .filter(Boolean)
          .join(" "),
        title: [
          isMobile ? "text-center" : null,
          "drop-shadow-sm",
          "text-[color:var(--normal-text)]",
          incomingClassNames.title,
        ]
          .filter(Boolean)
          .join(" "),
        description: [
          isMobile ? "text-center" : null,
          "drop-shadow-sm",
          "opacity-90",
          "text-[color:var(--normal-text)]",
          incomingClassNames.description,
        ]
          .filter(Boolean)
          .join(" "),
      },
    }
  }, [isMobile, props.toastOptions])

  const resolvedStyle = useMemo<React.CSSProperties>(() => {
    return {
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--border-radius": "var(--radius)",
      ...(props.style ?? {}),
    } as React.CSSProperties
  }, [props.style])

  return (
    <Sonner
      {...props}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={resolvedPosition}
      offset={resolvedOffset}
      toastOptions={resolvedToastOptions}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={resolvedStyle}
    />
  )
}

export { Toaster }
