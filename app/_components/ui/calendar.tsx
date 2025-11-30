"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, CaptionProps } from "react-day-picker"

import { cn } from "@/app/_lib/utils"
import { buttonVariants } from "@/app/_components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || new Date())

  // Componente customizado para capitalizar o mês e mostrar o ano
  const Caption = (captionProps: CaptionProps) => {
    const monthName = captionProps.displayMonth.toLocaleDateString("pt-BR", { month: "long" })
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
    const year = captionProps.displayMonth.getFullYear()

    return (
      <div className="flex justify-between pt-1 relative items-center w-full">
        <div className="text-sm font-medium capitalize">
          {capitalizedMonth} {year}
        </div>
        <nav className="space-x-1 flex items-center">
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-8"
            )}
            onClick={() => {
              const prevMonth = new Date(captionProps.displayMonth)
              prevMonth.setMonth(prevMonth.getMonth() - 1)
              setMonth(prevMonth)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
            )}
            onClick={() => {
              const nextMonth = new Date(captionProps.displayMonth)
              nextMonth.setMonth(nextMonth.getMonth() + 1)
              setMonth(nextMonth)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    )
  }

  return (
    <DayPicker
      month={month}
      onMonthChange={setMonth}
      showOutsideDays={showOutsideDays}
      className={cn("w-full p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
        month: "space-y-4 w-full",
        caption: "flex justify-between pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute right-8",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex w-full",
        head_cell:
          "text-muted-foreground rounded-md w-full font-normal text-[0.8rem] flex-1 capitalize",
        row: "flex w-full mt-2",
        cell: "h-9 flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#EE8530] text-black hover:bg-[#EE8530] hover:text-black focus:bg-[#EE8530] focus:text-black rounded-full",
        day_today: "bg-transparent text-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-[#EE8530] aria-selected:text-black aria-selected:opacity-100 rounded-full",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-[#EE8530] aria-selected:text-black rounded-full",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        Caption,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
