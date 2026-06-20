"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslation } from "@/contexts/UILanguageContext";
import { LANGUAGE_REGIONS, searchLanguages, type Language } from "@/lib/languages";
import { BUNDLED_LOCALES } from "@/lib/ui-translation-bundles";

export default function LanguageDropdown() {
  const { language, isLoading, setLanguage, t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isEditing]);

  const results = query.trim() ? searchLanguages(query) : null;
  const currentCode = language.toUpperCase().slice(0, 4);

  async function handleSelect(lang: Language) {
    setIsEditing(false);
    setQuery("");
    await setLanguage(lang.code);
  }

  function collapse() {
    setIsEditing(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-60"
          title={t("langDropdown.changeLanguage")}
        >
          {isLoading ? (
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : (
            <Globe size={16} weight="duotone" />
          )}
          <span>{isLoading ? "" : currentCode}</span>
        </button>
      ) : (
        <div className="flex min-w-[180px] items-center rounded-full border border-white/12 bg-white/10 px-3 text-white">
          <MagnifyingGlass size={16} weight="bold" className="shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={collapse}
            onKeyDown={(e) => {
              if (e.key === "Escape") collapse();
            }}
            placeholder={t("langDropdown.searchPlaceholder")}
            className="w-full bg-transparent px-2 py-2 text-sm text-white placeholder-white/45 outline-none"
          />
          {isLoading && (
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      )}

      {isEditing && (
        <div
          className="absolute right-0 top-full z-[200] mt-2 flex max-h-[340px] min-w-[260px] flex-col overflow-hidden rounded-3xl border border-border bg-[var(--surface-solid)] shadow-[var(--product-shadow)]"
        >
          <div className="flex-1 overflow-y-auto">
            {results !== null ? (
              results.length === 0 ? (
                <p className="px-4 py-3 text-center text-sm text-[var(--muted)]">
                  {t("langDropdown.noResults")}
                </p>
              ) : (
                results.map((lang) => (
                  <LanguageRow
                    key={lang.code}
                    lang={lang}
                    isCurrent={lang.code === language}
                    isBundled={BUNDLED_LOCALES.has(lang.code)}
                    onSelect={handleSelect}
                  />
                ))
              )
            ) : (
              Object.entries(LANGUAGE_REGIONS).map(([region, langs]) => (
                <div key={region}>
                  <p className="px-3 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {region}
                  </p>
                  {langs.map((lang) => (
                    <LanguageRow
                      key={lang.code}
                      lang={lang}
                      isCurrent={lang.code === language}
                      isBundled={BUNDLED_LOCALES.has(lang.code)}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageRow({
  lang,
  isCurrent,
  isBundled,
  onSelect,
}: {
  lang: Language;
  isCurrent: boolean;
  isBundled: boolean;
  onSelect: (lang: Language) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(lang)}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-light)]"
      style={
        isCurrent
          ? { background: "rgba(0,102,204,0.1)", color: "var(--primary-text)" }
          : { color: "var(--foreground)" }
      }
    >
      <span className="flex-1 font-medium">{lang.name}</span>
      <span className="text-xs text-[var(--muted)]">{lang.nativeName}</span>
      <span
        title={isBundled ? t("langDropdown.instant") : t("langDropdown.onDemand")}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          flexShrink: 0,
          background: isBundled ? "var(--accent)" : "transparent",
          border: isBundled ? "none" : "1.5px solid var(--muted)",
        }}
      />
    </button>
  );
}
