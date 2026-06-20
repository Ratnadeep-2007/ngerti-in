"use client";

import React, { useState } from "react";
import {
  Info,
  Translate,
  YoutubeLogo,
  Lightning,
  BracketsCurly,
  Palette,
  RocketLaunch,
} from "@phosphor-icons/react";
import { useTranslation } from "@/contexts/UILanguageContext";

const credits = [
  { title: "Lingo.dev", descKey: "footer.magic", icon: Translate },
  { title: "YouTube", descKey: "footer.library", icon: YoutubeLogo },
  { title: "Gemini", descKey: "footer.inference", icon: Lightning },
  { title: "DeepMind", descKey: "footer.vibes", icon: BracketsCurly },
  { title: "Design", descKey: "footer.collaborators", icon: Palette },
  { title: "Vercel", descKey: "footer.delivery", icon: RocketLaunch },
] as const;

const Footer = () => {
  const { t } = useTranslation();
  const [showCredits, setShowCredits] = useState(false);

  return (
    <footer className="relative border-t border-[var(--hairline)] bg-[var(--surface-parchment)] px-4 py-8 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-base font-semibold tracking-[-0.03em]">
              {t("footer.builtBy")}
            </p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--muted)]">
              {t("footer.poweredBy")}
            </p>
          </div>

          <button
            onClick={() => setShowCredits(!showCredits)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Info size={16} weight="duotone" />
            {t("footer.credits")}
          </button>
        </div>

        {showCredits && (
          <div className="animate-slide-up rounded-[24px] border border-[var(--hairline)] bg-white p-4">
            <h4 className="mb-3 text-base font-semibold tracking-[-0.035em]">
              {t("footer.specialThanks")}
            </h4>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {credits.map((credit) => (
                <CreditItem
                  key={credit.title}
                  title={credit.title}
                  desc={t(credit.descKey)}
                  icon={credit.icon}
                />
              ))}
            </div>

            <div className="mt-4 border-t border-[var(--hairline)] pt-3 text-xs text-[var(--muted)]">
              {t("footer.madeWithLove")}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

const CreditItem = ({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; weight?: "duotone" | "regular" | "bold" | "fill" | "light" | "thin" }>;
}) => (
  <div className="flex items-start gap-2 rounded-2xl bg-[var(--surface-parchment)] p-3">
    <span className="mt-0.5 text-[var(--primary)]">
      {React.createElement(icon, { size: 18, weight: "duotone" })}
    </span>
    <div>
      <h5 className="text-xs font-semibold text-[var(--foreground)]">
        {title}
      </h5>
      <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
        {desc}
      </p>
    </div>
  </div>
);

export default Footer;
