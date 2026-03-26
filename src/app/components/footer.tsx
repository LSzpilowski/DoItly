import { PrivacyPolicyModal } from "./legal/PrivacyPolicyModal";
import { GDPRModal } from "./legal/GDPRModal";

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-border/40">
      <div className="mt-8 pt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-1">
            DoItly by
            <a
              className="font-semibold text-primary hover:underline transition-all hover:opacity-80"
              target="_blank"
              rel="noopener noreferrer"
              href="https://lszpilowski.com"
            >
              LSzpilowski
            </a>
          </p>
          <div className="flex items-center gap-3 text-xs">
            <p>© {new Date().getFullYear()} DoItly. All rights reserved.</p>
            <PrivacyPolicyModal>
              <button className="text-primary hover:underline transition-all">Privacy Policy</button>
            </PrivacyPolicyModal>
            <GDPRModal>
              <button className="text-primary hover:underline transition-all">GDPR</button>
            </GDPRModal>
          </div>
        </div>
    </footer>
  );
};
