import DashboardShell from "../../components/dashboard/DashboardShell";
import { DateFilterProvider } from "../../contexts/DateFilterContext";
import { AccountProvider } from "../../contexts/AccountContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <DateFilterProvider>
        <DashboardShell>{children}</DashboardShell>
      </DateFilterProvider>
    </AccountProvider>
  );
}
