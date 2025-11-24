"use client"

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BotCard } from '@/components/bot-card';
import { AddAccountDialog } from '@/components/add-account-dialog';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Dashboard() {
  const { data: accounts, error, mutate } = useSWR('/api/accounts', fetcher, { refreshInterval: 5000 });

  const sendCommand = async (accountId: string, type: string) => {
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, type })
      });
      // Optionally mutate/refresh
    } catch (e) {
      console.error('Command failed', e);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      mutate(); // Refresh list
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  if (error) return <div>Failed to load</div>;
  if (!accounts) return <div>Loading...</div>;
  if (!Array.isArray(accounts)) return <div>Error loading accounts</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Lamentosa Bot Dashboard</h1>
        <AddAccountDialog onAccountAdded={() => mutate()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account: any) => (
          <BotCard
            key={account.id}
            account={account}
            onCommand={(type) => sendCommand(account.id, type)}
            onDelete={() => deleteAccount(account.id)}
          />
        ))}
      </div>
    </div>
  );
}
