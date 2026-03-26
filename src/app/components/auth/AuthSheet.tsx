import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AuthComponent } from './AuthComponent';
import { Footer } from "@/app/components/footer";
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
      <SheetContent side="right" className="max-h-screen w-full sm:max-w-lg overflow-y-auto bg-background flex flex-col">
        <SheetHeader className="text-center">
          <SheetTitle>Welcome to DoItly</SheetTitle>
          <SheetDescription>
            Sign in to sync your tasks across devices
          </SheetDescription>
          <div className="flex-1 flex items-center justify-center py-8">
          <AuthComponent />
          </div>
        </SheetHeader>
        
        <Footer />
      </SheetContent>
    </Sheet>
  );
}
