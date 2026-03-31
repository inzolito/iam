"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type Period = "today" | "yesterday" | "week" | "lastweek" | "month" | "lastmonth" | "3m" | "6m" | "year" | "all" | "custom";

export interface DateFilterState {
  period: Period;
  dateFrom: string | null;
  dateTo: string | null;
}

interface DateFilterContextType extends DateFilterState {
  setPeriod: (p: Period, customFrom?: string, customTo?: string) => void;
}

export function computeDates(
  period: Period,
  customFrom?: string,
  customTo?: string,
): { dateFrom: string | null; dateTo: string | null } {
  const today = new Date();
  // Use LOCAL date components — toISOString() returns UTC which causes "Hoy"
  // to send the wrong date for users in timezones behind UTC.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (period) {
    case "today":
      return { dateFrom: fmt(today), dateTo: fmt(today) };

    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { dateFrom: fmt(d), dateTo: fmt(d) };
    }

    case "week": {
      const d = new Date(today);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // retroceder al lunes
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }

    case "lastweek": {
      const endD = new Date(today);
      endD.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 1); // domingo pasado
      const startD = new Date(endD);
      startD.setDate(endD.getDate() - 6); // lunes de la semana pasada
      return { dateFrom: fmt(startD), dateTo: fmt(endD) };
    }

    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: fmt(first), dateTo: fmt(today) };
    }

    case "lastmonth": {
      const firstOfLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLast  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: fmt(firstOfLast), dateTo: fmt(lastOfLast) };
    }

    case "3m": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }

    case "6m": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }

    case "year": {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }

    case "all":
      return { dateFrom: null, dateTo: null };

    case "custom":
      return { dateFrom: customFrom ?? null, dateTo: customTo ?? null };

    default:
      return { dateFrom: null, dateTo: null };
  }
}

const DateFilterContext = createContext<DateFilterContextType>({
  period: "today",
  dateFrom: null,
  dateTo: null,
  setPeriod: () => {},
});

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const initialDates = computeDates("today");
  const [period, setPeriodState] = useState<Period>("today");
  const [dateFrom, setDateFrom] = useState<string | null>(initialDates.dateFrom);
  const [dateTo, setDateTo] = useState<string | null>(initialDates.dateTo);

  const setPeriod = (p: Period, customFrom?: string, customTo?: string) => {
    const dates = computeDates(p, customFrom, customTo);
    setPeriodState(p);
    setDateFrom(dates.dateFrom);
    setDateTo(dates.dateTo);
  };

  return (
    <DateFilterContext.Provider value={{ period, dateFrom, dateTo, setPeriod }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export const useDateFilter = () => useContext(DateFilterContext);
