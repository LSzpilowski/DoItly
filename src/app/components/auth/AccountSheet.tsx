import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { User, TrendingUp, CheckCircle, ListTodo, Archive, FileText, Calendar, LogOut, Trash2, Download } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/authStore";
import { useTasksStore } from "@/store/tasksStore";
import { supabase } from "@/lib/supabase";

export const AccountSheet: React.FC = () => {
  const { user, signOut, deleteAccount } = useAuthStore();
  const { getStats, tasks } = useTasksStore();
  const [mounted, setMounted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'month' | 'year'>('month');

  useEffect(() => {
    React.startTransition(() => {
      setMounted(true);
    });
  }, []);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const { error } = await deleteAccount();
    
    if (error) {
      alert(`Error deleting account: ${error.message}`);
      setIsDeleting(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        alert('Error fetching data for export');
        console.error(error);
        return;
      }

      const exportData = {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        tasks: data || [],
        statistics: stats,
        exported_at: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `doitly-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting data');
      console.error(error);
    }
  };

  const stats = mounted ? getStats() : {
    totalTasksCreated: 0,
    activeTasksCount: 0,
    completedTasksCount: 0,
    deletedTasksCount: 0,
    archivedTasksCount: 0,
    templatesCount: 0,
    completionRate: 0,
    activeVsCompletedRatio: 0,
  };

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 hover:bg-white/10" aria-label="Open account">
          <User className="h-5 w-5" />
          Account
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="max-h-screen w-full sm:max-w-lg overflow-y-auto bg-gradient-to-br from-black to-gray-900">
        <SheetHeader>
          <SheetTitle>Account & Statistics</SheetTitle>
          <SheetDescription>
            View your productivity stats and manage your account.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* User Info */}
          <Card className="border-2">
            <CardHeader className="py-3">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    width={64}
                    height={64}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">
                    {user.user_metadata?.full_name || 'User'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  className="gap-2 shrink-0 hover:bg-white/10"
                  title="Export your data (GDPR)"
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Your Statistics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Created</p>
                      <p className="text-3xl font-bold">{stats.totalTasksCreated}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-blue-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Active Tasks</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.activeTasksCount}</p>
                    </div>
                    <ListTodo className="h-8 w-8 text-blue-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-3xl font-bold text-green-600">{stats.completedTasksCount}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="text-3xl font-bold text-purple-600">{(stats.completionRate * 100).toFixed(0)}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Archived</p>
                      <p className="text-3xl font-bold text-gray-600">{stats.archivedTasksCount}</p>
                    </div>
                    <Archive className="h-8 w-8 text-gray-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Templates</p>
                      <p className="text-3xl font-bold text-orange-600">{stats.templatesCount}</p>
                    </div>
                    <FileText className="h-8 w-8 text-orange-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly/Yearly Stats */}
            {stats.monthlyTasksCreated && Object.keys(stats.monthlyTasksCreated).length > 0 && (
              <Card className="border-2">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant='outline'
                      size="sm"
                      onClick={() => setTimePeriod('month')}
                      className={timePeriod === 'year' ? 'hover:bg-white/10' :'bg-white text-black'}
                    >
                      This Month
                    </Button>
                    <Button
                      variant='outline'
                      size="sm"
                      onClick={() => setTimePeriod('year')}
                      className={timePeriod === 'year' ? 'bg-white text-black' : 'hover:bg-white/10'}
                    >
                      This Year
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {timePeriod === 'month' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-2xl font-bold">
                          {stats.currentMonth ? (stats.monthlyTasksCreated[stats.currentMonth] ?? 0) : 0}
                        </p>
                      </div>
                      {stats.monthlyTasksCompleted && (
                        <div>
                          <p className="text-sm text-muted-foreground">Completed</p>
                          <p className="text-2xl font-bold">
                            {stats.currentMonth ? (stats.monthlyTasksCompleted[stats.currentMonth] ?? 0) : 0}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-2xl font-bold">
                          {Object.values(stats.monthlyTasksCreated).reduce((a: number, b: number) => a + b, 0)}
                        </p>
                      </div>
                      {stats.monthlyTasksCompleted && (
                        <div>
                          <p className="text-sm text-muted-foreground">Completed</p>
                          <p className="text-2xl font-bold">
                            {Object.values(stats.monthlyTasksCompleted).reduce((a: number, b: number) => a + b, 0)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Sign Out Button */}
            <Button 
              onClick={signOut} 
              variant="outline" 
              className="w-full gap-2 hover:bg-white/10"
              size="lg"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>

            {/* Delete Account Button with Confirmation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full gap-2 hover:bg-red-600/50"
                  size="lg"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                    </p>
                    <div>
                      <p className="font-semibold text-foreground mb-2">
                        The following will be permanently deleted:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{stats.activeTasksCount} active task{stats.activeTasksCount !== 1 ? 's' : ''}</li>
                        <li>{stats.completedTasksCount} completed task{stats.completedTasksCount !== 1 ? 's' : ''}</li>
                        <li>{stats.archivedTasksCount} archived task{stats.archivedTasksCount !== 1 ? 's' : ''}</li>
                        <li>{stats.templatesCount} template{stats.templatesCount !== 1 ? 's' : ''}</li>
                        <li>Your account information and email</li>
                        <li>All statistics and history</li>
                      </ul>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This complies with GDPR &quot;Right to be Forgotten&quot; regulations and will be processed immediately.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="hover:bg-white/10">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground  hover:bg-red-600/50"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
