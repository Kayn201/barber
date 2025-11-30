"use client"

export const isIOS = (): boolean => {
  if (typeof window === "undefined") return false

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

export const isAndroid = (): boolean => {
  if (typeof window === "undefined") return false

  return /Android/.test(navigator.userAgent)
}

