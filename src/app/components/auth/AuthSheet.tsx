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

export function AuthSheet() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  if (user && open) {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className='hover:bg-white/10'>
          Log in
        </Button>
      </SheetTrigger>
      <SheetContent className='bg-gradient-to-br from-black to-gray-900'>
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
