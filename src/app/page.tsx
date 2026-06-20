"use client";

import Link from "next/link";
import {
  Translate,
  Brain,
  Eye,
} from "@phosphor-icons/react";
import { useTranslation } from "@/contexts/UILanguageContext";

const featureTiles = [
  {
    icon: Translate,
    labelKey: "home.feature130",
    descKey: "home.featureDesc130",
  },
  {
    icon: Brain,
    labelKey: "home.featureCompanions",
    descKey: "home.featureDescCompanions",
  },
  {
    icon: Eye,
    labelKey: "home.featureFocus",
    descKey: "home.featureDescFocus",
  },
] as const;

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="-mt-24 bg-[var(--background)] text-[var(--foreground)]">
      <section className="flex min-h-[calc(100dvh+6rem)] items-center justify-center bg-white px-4 pb-20 pt-36 text-center">
        <div className="mx-auto max-w-5xl animate-slide-up">
          <p className="mb-5 text-sm font-semibold tracking-[0.24em] text-[var(--primary)]">
            ACTIVE VIDEO LEARNING
          </p>
          <h1 className="apple-display">
            Lumina.ai
          </h1>
          <p className="apple-lead mx-auto mt-6 max-w-3xl text-[var(--muted)]">
            {t("home.tagline")}
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-[1.47] text-[var(--muted)]">
            {t("home.heroDesc")}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/learn" className="apple-pill">
              {t("home.startLearning")}
            </Link>
            <Link href="/explore" className="apple-pill-secondary">
              {t("home.browsePaths")}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3">
        {featureTiles.map((feature, index) => {
          const dark = index === 1;
          const Icon = feature.icon;
          return (
            <article
              key={feature.labelKey}
              className={`min-h-[420px] px-8 py-20 text-center md:px-10 ${
                dark
                  ? "bg-[var(--surface-dark)] text-white"
                  : index === 2
                    ? "bg-[var(--surface-parchment)] text-[var(--foreground)]"
                    : "bg-white text-[var(--foreground)]"
              }`}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                <Icon size={30} weight="duotone" />
              </div>
              <h2 className="mx-auto mt-8 max-w-sm text-[40px] font-semibold leading-[1.08] tracking-[-0.04em]">
                {t(feature.labelKey)}
              </h2>
              <p className={`mx-auto mt-4 max-w-sm text-[17px] leading-[1.47] ${dark ? "text-white/70" : "text-[var(--muted)]"}`}>
                {t(feature.descKey)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="bg-black px-4 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm font-semibold tracking-[0.24em] text-[var(--primary-light)]">
            PRODUCT PREVIEW
          </p>
          <h2 className="apple-headline mx-auto mt-4 max-w-3xl">
            {t("home.projectDemo")}
          </h2>
          <div className="apple-product-shadow mx-auto mt-10 aspect-video max-w-5xl overflow-hidden rounded-[30px] bg-[var(--surface-dark)]">
            <video
              src="/LingoPromo.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
              onEnded={(e) => { (e.target as HTMLVideoElement).play(); }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
