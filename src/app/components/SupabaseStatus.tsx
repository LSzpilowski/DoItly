import { useEffect, useState } from 'react';
import { testSupabaseConnection } from '@/lib/supabase';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SupabaseStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    const result = await testSupabaseConnection();
    setIsConnected(result);
    setIsChecking(false);
  };

  useEffect(() => {
    let mounted = true;
    
    const runCheck = async () => {
      const result = await testSupabaseConnection();
      if (mounted) {
        setIsConnected(result);
      }
    };
    
    runCheck();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (isConnected === null || isConnected === true) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 max-w-md bg-destructive/10 border-destructive z-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive">Database Schema Outdated</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your Supabase tasks table is missing required columns (status, is_template, etc.)
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Quick Fix:</strong>
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside mt-1 space-y-1">
            <li>Open Supabase Dashboard</li>
            <li>Go to SQL Editor</li>
            <li>Copy and run <code className="bg-black/20 px-1 rounded">supabase-migration.sql</code></li>
            <li>This will add missing columns to your existing table</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={checkConnection}
              disabled={isChecking}
            >
              {isChecking ? 'Checking...' : 'Retry'}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              Open Supabase
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
