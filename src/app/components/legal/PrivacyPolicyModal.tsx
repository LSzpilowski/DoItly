import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PrivacyPolicyModal({ children }: { children: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild className='hover:cursor-pointer'>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Privacy Policy</AlertDialogTitle>
          <AlertDialogDescription>
            Last updated: {new Date().toLocaleDateString('en-US')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="h-[50vh] w-full pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Data Controller</h3>
              <p className="text-muted-foreground">
                The data controller is the owner of the DoItly application. Contact: via the contact form at lszpilowski.com.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">2. What Data We Collect</h3>
              <p className="text-muted-foreground mb-2">
                During registration and use of the application, we collect the following data:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Email address (required for login via Google or GitHub)</li>
                <li>User identifier (automatically generated UUID)</li>
                <li>Content of tasks created by the user</li>
                <li>Creation and modification dates of tasks</li>
                <li>Task statuses (active, completed, deleted, archived)</li>
              </ul>
              <p className="text-muted-foreground mt-2 text-sm">
                Note: Your username and profile picture from Google or GitHub are handled by Supabase Auth for display purposes only and are not stored in our database.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Purpose of Data Processing</h3>
              <p className="text-muted-foreground mb-2">
                Your data is processed exclusively for the following purposes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Enabling user login and authentication</li>
                <li>Displaying and managing the user&apos;s task list</li>
                <li>Generating statistics about user productivity</li>
                <li>Ensuring synchronization functionality between devices</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                <strong>We do not share</strong> your personal data with third parties. We do not use it for marketing purposes, nor do we sell it.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Legal Basis for Processing</h3>
              <p className="text-muted-foreground">
                Data is processed primarily for the performance of a contract (Art. 6(1)(b) GDPR), i.e. enabling use of the DoItly application.
                In limited cases, data may also be processed to comply with legal obligations (Art. 6(1)(c)) or based on the controller’s legitimate interests (Art. 6(1)(f)), such as ensuring application security and preventing abuse.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">5. Data Storage</h3>
              <p className="text-muted-foreground">
                Data is stored on Supabase servers (backend infrastructure provider). Data is stored for the duration of use of the application. After account deletion, user data is deleted without undue delay, unless retention is required by law.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Your Rights</h3>
              <p className="text-muted-foreground mb-2">
                Under GDPR, you have the following rights:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Right of access</strong> to your personal data</li>
                <li><strong>Right to rectification</strong> (correction) of inaccurate data</li>
                <li><strong>Right to erasure</strong> (&ldquo;right to be forgotten&rdquo;)</li>
                <li><strong>Right to restriction of processing</strong></li>
                <li><strong>Right to data portability</strong> to another service</li>
                <li><strong>Right to object</strong> to data processing</li>
                <li><strong>Right to withdraw consent</strong> at any time</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Cookies</h3>
              <p className="text-muted-foreground">
                The application uses cookies solely to maintain the user&apos;s login session. We do not use marketing or tracking cookies.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">8. Data Security</h3>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect personal data against unauthorized access, loss, or destruction. All connections are encrypted with HTTPS protocol.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">9. Contact</h3>
              <p className="text-muted-foreground">
                For matters regarding personal data protection, please contact via the contact form at lszpilowski.com.
              </p>
            </section>
          </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
