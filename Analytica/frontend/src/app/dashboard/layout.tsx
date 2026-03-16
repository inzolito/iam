import DashboardShell from "../../components/dashboard/DashboardShell";
import { DateFilterProvider } from "../../contexts/DateFilterContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DateFilterProvider>
      <DashboardShell>{children}</DashboardShell>
    </DateFilterProvider>
  );
}
