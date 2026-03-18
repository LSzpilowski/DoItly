
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

export function GDPRModal({ children }: { children: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild className='hover:cursor-pointer'> 
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle>GDPR Information</AlertDialogTitle>
          <AlertDialogDescription>
            Information on personal data processing under GDPR
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="h-[50vh] w-full pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-foreground mb-2">GDPR Information Clause</h3>
              <p className="text-muted-foreground">
                In accordance with Article 13(1) and (2) of Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data (General Data Protection Regulation - GDPR), we inform you that:
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Data Controller</h3>
              <p className="text-muted-foreground">
                The controller of your personal data is the owner of the DoItly application.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">2. Purpose and Legal Basis for Processing</h3>
              <p className="text-muted-foreground mb-2">
                Your personal data will be processed for the purpose of:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Providing services within the DoItly application (Art. 6(1)(b) GDPR)</li>
                <li>Fulfilling the controller&apos;s legal obligations (Art. 6(1)(c) GDPR)</li>
                <li>Pursuing the controller&apos;s legitimate interests (Art. 6(1)(f) GDPR)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Data Recipients</h3>
              <p className="text-muted-foreground mb-2">
                Your data may be transferred to the following categories of recipients:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Supabase Inc. - backend infrastructure and database provider</li>
                <li>Vercel Inc. - application hosting provider</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Data may be transferred outside the EEA (e.g. to the United States) in connection with the use of infrastructure providers such as Supabase and Vercel.
                Such transfers are carried out in accordance with applicable GDPR safeguards, including Standard Contractual Clauses approved by the European Commission.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Data Retention Period</h3>
              <p className="text-muted-foreground">
                Your personal data will be stored for the duration of use of the application. After account deletion, user data is deleted without undue delay, unless retention is required by law.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">5. Your Rights</h3>
              <p className="text-muted-foreground mb-2">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Access to data</strong> - you can obtain information about what data we process</li>
                <li><strong>Rectification of data</strong> - you can correct inaccurate or incomplete data</li>
                <li><strong>Erasure of data</strong> - you can request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
                <li><strong>Restriction of processing</strong> - in certain cases, you can request restriction of data processing</li>
                <li><strong>Data portability</strong> - you can receive your data in a structured format and transfer it to another controller</li>
                <li><strong>Object</strong> - you can object to data processing for specific purposes</li>
                <li><strong>Withdraw consent</strong> - if processing is based on consent, you can withdraw it at any time</li>
                <li><strong>Lodge a complaint</strong> - you can lodge a complaint with a supervisory authority (in Poland: President of the Personal Data Protection Office)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Information on Data Provision Requirement</h3>
              <p className="text-muted-foreground">
                Providing personal data (email address) is voluntary but necessary to use the application. Failure to provide data prevents registration and use of the application&apos;s full functionality.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Automated Decision-Making and Profiling</h3>
              <p className="text-muted-foreground">
                Your data will not be processed in an automated manner, including profiling.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">8. Contact Regarding Personal Data</h3>
              <p className="text-muted-foreground">
                To exercise your rights or for matters regarding personal data processing, please contact via the contact form at lszpilowski.com.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">9. Supervisory Authority</h3>
              <p className="text-muted-foreground mb-2">
                The supervisory authority for personal data protection in Poland is:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>President of the Personal Data Protection Office</strong><br />
                ul. Stawki 2<br />
                00-193 Warsaw, Poland<br />
                Tel: +48 22 531 03 00<br />
                Email: kancelaria@uodo.gov.pl
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
