"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type Period = "today" | "week" | "month" | "3m" | "6m" | "year" | "all" | "custom";

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

    case "week": {
      const d = new Date(today);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // rewind to Monday
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }

    case "month": {
      const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      return { dateFrom: first, dateTo: fmt(today) };
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
