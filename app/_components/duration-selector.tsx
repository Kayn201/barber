"use client"

import { useState, useEffect, useRef } from "react"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

interface DurationSelectorProps {
  value: number
  onChange: (minutes: number) => void
  label?: string
}

const DurationSelector = ({
  value,
  onChange,
  label = "Duração",
}: DurationSelectorProps) => {
  const hours = Math.floor(value / 60)
  const minutes = value % 60

  const [selectedHours, setSelectedHours] = useState(hours.toString())
  const [selectedMinutes, setSelectedMinutes] = useState(minutes.toString())
  const isInternalChange = useRef(false)

  // Sincronizar com o valor externo
  useEffect(() => {
    if (!isInternalChange.current) {
      const hours = Math.floor(value / 60)
      const minutes = value % 60
      setSelectedHours(hours.toString())
      setSelectedMinutes(minutes.toString())
    }
    isInternalChange.current = false
  }, [value])

  // Converter minutos >= 60 para horas
  useEffect(() => {
    const mins = parseInt(selectedMinutes)
    if (mins >= 60) {
      const newHours = parseInt(selectedHours) + Math.floor(mins / 60)
      const newMinutes = mins % 60
      isInternalChange.current = true
      setSelectedHours(newHours.toString())
      setSelectedMinutes(newMinutes.toString())
    }
  }, [selectedMinutes, selectedHours])

  // Notificar mudanças internas
  useEffect(() => {
    const totalMinutes = parseInt(selectedHours) * 60 + parseInt(selectedMinutes)
    if (totalMinutes >= 0 && totalMinutes !== value && !isInternalChange.current) {
      isInternalChange.current = true
      onChange(totalMinutes)
    }
  }, [selectedHours, selectedMinutes, value, onChange])

  const hoursOptions = Array.from({ length: 24 }, (_, i) => i)
  const minutesOptions = Array.from({ length: 4 }, (_, i) => i * 15) // 0, 15, 30, 45

  // Formatar o total de forma legível
  const formatDuration = () => {
    const h = parseInt(selectedHours)
    const m = parseInt(selectedMinutes)
    
    if (h > 0 && m > 0) {
      return `${h}h ${m}min`
    } else if (h > 0) {
      return `${h}h`
    } else if (m > 0) {
      return `${m}min`
    } else {
      return "0min"
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <div className="flex items-center gap-2">
        {/* Sempre mostrar seletor de horas */}
        <Select
          value={selectedHours}
          onValueChange={(value) => {
            setSelectedHours(value)
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="0h" />
          </SelectTrigger>
          <SelectContent position="popper">
            {hoursOptions.map((hour) => (
              <SelectItem key={hour} value={hour.toString()}>
                {hour}h
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <span className="text-gray-400 font-semibold">:</span>
        
        {/* Sempre mostrar seletor de minutos */}
        <Select
          value={selectedMinutes}
          onValueChange={(value) => {
            setSelectedMinutes(value)
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="0min" />
          </SelectTrigger>
          <SelectContent position="popper">
            {minutesOptions.map((minute) => (
              <SelectItem key={minute} value={minute.toString()}>
                {minute}min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-gray-400">
        Total: {formatDuration()}
      </p>
    </div>
  )
}

export default DurationSelector
