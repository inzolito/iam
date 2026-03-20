"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE } from "../config";

export interface Account {
  id: string;
  name: string;
  platform: string;
  currency: string;
  connection_type: string;
  broker_server?: string | null;
  mt5_login?: string | null;
  sync_error?: string | null;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account) => void;
  reloadAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  selectedAccount: null,
  setSelectedAccount: () => {},
  reloadAccounts: async () => {},
});

function dedup(raw: Account[]): Account[] {
  return raw.filter((a, i, arr) => {
    const key = a.platform && a.broker_server && a.mt5_login
      ? `${a.platform}:${a.broker_server}:${a.mt5_login}`
      : a.id;
    return arr.findIndex((b) => {
      const k = b.platform && b.broker_server && b.mt5_login
        ? `${b.platform}:${b.broker_server}:${b.mt5_login}`
        : b.id;
      return k === key;
    }) === i;
  });
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts]             = useState<Account[]>([]);
  const [selectedAccount, setSelectedState] = useState<Account | null>(null);

  const reloadAccounts = useCallback(async () => {
    const token = localStorage.getItem("analytica_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = dedup(await res.json());
      setAccounts(data);
      setSelectedState((prev) => {
        const defaultId = localStorage.getItem("analytica_default_account");
        const preferred = data.find((a) => a.id === (prev?.id ?? defaultId)) ?? data[0] ?? null;
        return preferred;
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { reloadAccounts(); }, [reloadAccounts]);

  const setSelectedAccount = (account: Account) => {
    setSelectedState(account);
  };

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, setSelectedAccount, reloadAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}

export const useAccount = () => useContext(AccountContext);
