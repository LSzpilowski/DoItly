import React from "react";
import { PrivacyPolicyModal } from "./legal/PrivacyPolicyModal";
import { GDPRModal } from "./legal/GDPRModal";

export const Footer = () => {
  return (
    <footer className="pt-6 mt-auto border-t border-border/40">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
        <div className="flex flex-col items-center md:items-start gap-1">
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
        </div>
        <div className="flex items-center gap-3 text-xs">
          <p className="text-xs">
            © {new Date().getFullYear()} DoItly. All rights reserved.
          </p>
          <span>•</span>
          <PrivacyPolicyModal>
            <button className="text-primary hover:underline transition-all">
              Privacy Policy
            </button>
          </PrivacyPolicyModal>
          <span>•</span>
          <GDPRModal>
            <button className="text-primary hover:underline transition-all">
              GDPR
            </button>
          </GDPRModal>
        </div>
      </div>
    </footer>
  );
};
