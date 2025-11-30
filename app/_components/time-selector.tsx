"use client"

import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface TimeSelectorProps {
  value: number // valor em minutos
  onChange: (minutes: number) => void
  label?: string
}

const TimeSelector = ({ value, onChange, label = "Tempo" }: TimeSelectorProps) => {
  // Converter minutos para a unidade mais apropriada para exibição
  const getDisplayValue = (minutes: number) => {
    if (minutes < 60) {
      return { value: minutes, unit: "minutes" as const }
    } else if (minutes < 1440) {
      return { value: minutes / 60, unit: "hours" as const }
    } else {
      return { value: minutes / 1440, unit: "days" as const }
    }
  }

  const display = getDisplayValue(value)
  const [inputValue, setInputValue] = useState(display.value.toString())
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">(display.unit)

  useEffect(() => {
    const newDisplay = getDisplayValue(value)
    setInputValue(newDisplay.value.toString())
    setUnit(newDisplay.unit)
  }, [value])

  const handleValueChange = (newValue: string) => {
    setInputValue(newValue)
    const numValue = parseFloat(newValue) || 0
    let totalMinutes = 0

    switch (unit) {
      case "minutes":
        totalMinutes = numValue
        break
      case "hours":
        totalMinutes = numValue * 60
        break
      case "days":
        totalMinutes = numValue * 1440
        break
    }

    onChange(Math.round(totalMinutes))
  }

  const handleUnitChange = (newUnit: "minutes" | "hours" | "days") => {
    setUnit(newUnit)
    const numValue = parseFloat(inputValue) || 0
    let totalMinutes = 0

    switch (newUnit) {
      case "minutes":
        totalMinutes = numValue
        break
      case "hours":
        totalMinutes = numValue * 60
        break
      case "days":
        totalMinutes = numValue * 1440
        break
    }

    onChange(Math.round(totalMinutes))
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input
          type="number"
          min="0"
          step="0.1"
          value={inputValue}
          onChange={(e) => handleValueChange(e.target.value)}
          className="flex-1"
        />
        <Select value={unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default TimeSelector

