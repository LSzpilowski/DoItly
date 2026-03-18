import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AuthComponent } from './AuthComponent';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface AuthSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthSheet({ open: controlledOpen, onOpenChange }: AuthSheetProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { user } = useAuthStore();

  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  if (user && open) {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className='hover:bg-accent'>
            Log in
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className='bg-background'>
        <SheetHeader>
          <SheetTitle>Welcome to DoItly</SheetTitle>
          <SheetDescription>
            Sign in to sync your tasks across devices
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <AuthComponent />
        </div>
      </SheetContent>
    </Sheet>
  );
}
