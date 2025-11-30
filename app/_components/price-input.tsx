"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface PriceInputProps {
  value: number
  onChange: (value: number) => void
  label?: string
  id?: string
  required?: boolean
}

const PriceInput = ({
  value,
  onChange,
  label = "Preço (R$)",
  id = "price",
  required = false,
}: PriceInputProps) => {
  const [displayValue, setDisplayValue] = useState("")
  const isInternalUpdate = useRef(false)

  // Converter número para string formatada (ex: 100.50 -> "100,50")
  const formatPrice = (num: number): string => {
    if (num === 0 || isNaN(num)) return ""
    return num.toFixed(2).replace(".", ",")
  }

  // Converter centavos para número (ex: 1234 -> 12.34)
  const centsToNumber = (cents: number): number => {
    return cents / 100
  }

  // Converter número para centavos (ex: 12.34 -> 1234)
  const numberToCents = (num: number): number => {
    return Math.round(num * 100)
  }

  // Sincronizar displayValue com value apenas quando value mudar externamente
  useEffect(() => {
    if (!isInternalUpdate.current && value > 0) {
      const formatted = formatPrice(value)
      setDisplayValue(formatted)
    } else if (value === 0 && displayValue !== "") {
      setDisplayValue("")
    }
    isInternalUpdate.current = false
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value

    // Remove tudo exceto números
    const numbersOnly = inputValue.replace(/[^\d]/g, "")

    if (numbersOnly === "") {
      setDisplayValue("")
      isInternalUpdate.current = true
      onChange(0)
      return
    }

    // Converter para número (centavos)
    const cents = parseInt(numbersOnly)

    // Formatar: reais,centavos
    const reais = Math.floor(cents / 100)
    const centavos = cents % 100
    const formatted = `${reais},${String(centavos).padStart(2, "0")}`

    setDisplayValue(formatted)
    isInternalUpdate.current = true
    onChange(centsToNumber(cents))
  }

  const handleBlur = () => {
    if (!displayValue || displayValue.trim() === "") {
      setDisplayValue("")
      onChange(0)
      return
    }

    // Garantir formatação correta
    const numbersOnly = displayValue.replace(/[^\d]/g, "")
    if (numbersOnly === "") {
      setDisplayValue("")
      onChange(0)
      return
    }

    const cents = parseInt(numbersOnly)
    const reais = Math.floor(cents / 100)
    const centavos = cents % 100
    const formatted = `${reais},${String(centavos).padStart(2, "0")}`

    setDisplayValue(formatted)
    onChange(centsToNumber(cents))
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && "*"}
      </Label>
      <Input
        id={id}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0,00"
        required={required}
      />
    </div>
  )
}

export default PriceInput
