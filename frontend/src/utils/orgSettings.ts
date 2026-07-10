/**
 * Lightweight helper for reading org identity from localStorage.
 * Configurations page writes here on every successful save then fires
 * ORG_UPDATE_EVENT so every mounted component re-renders with the new logo/name.
 */
import { useState, useEffect } from "react";

export const ORG_UPDATE_EVENT = "org-settings-updated";

const KEY = "org_settings";

export interface OrgSettings {
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_logo_url: string | null;
  company_registration_no: string;
  company_tin: string;
  currency_code: string;
  date_format: string;
  timezone: string;
  fiscal_year_start_month: number;
  brand_color: string;
  session_timeout_minutes: number;
}

const DEFAULTS: OrgSettings = {
  company_name: "Microfinance Management System",
  company_tagline: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_logo_url: null,
  company_registration_no: "",
  company_tin: "",
  currency_code: "TZS",
  date_format: "d/m/Y",
  timezone: "Africa/Dar_es_Salaam",
  fiscal_year_start_month: 1,
  brand_color: "#1e5fae",
  session_timeout_minutes: 30,
};

export function getOrgSettings(): OrgSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setOrgSettings(data: Partial<OrgSettings>): void {
  const current = getOrgSettings();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...data }));
}

/** Fire after every setOrgSettings() call so all mounted components re-render. */
export function dispatchOrgUpdate(): void {
  window.dispatchEvent(new CustomEvent(ORG_UPDATE_EVENT));
}

/**
 * React hook -- returns live org settings and re-renders whenever
 * dispatchOrgUpdate() is called anywhere in the app.
 */
export function useOrgSettings(): OrgSettings {
  const [settings, setSettings] = useState<OrgSettings>(getOrgSettings);
  useEffect(() => {
    const handler = () => setSettings(getOrgSettings());
    window.addEventListener(ORG_UPDATE_EVENT, handler);
    return () => window.removeEventListener(ORG_UPDATE_EVENT, handler);
  }, []);
  return settings;
}

/** Convenience -- just the company name, used in many places. */
export function getCompanyName(): string {
  return getOrgSettings().company_name || DEFAULTS.company_name;
}

/** Convenience -- logo URL or null if not set. */
export function getLogoUrl(): string | null {
  return getOrgSettings().company_logo_url || null;
}

/** Print-header HTML block -- call inside window.print() open-document sections. */
export function orgPrintHeader(): string {
  const s = getOrgSettings();
  const logo = s.company_logo_url
    ? `<img src="${s.company_logo_url}" alt="logo" style="height:56px;object-fit:contain;margin-bottom:6px;" /><br/>`
    : "";
  const tagline = s.company_tagline ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${s.company_tagline}</div>` : "";
  const address = s.company_address ? `<div style="font-size:11px;color:#475569;margin-top:4px;">${s.company_address}</div>` : "";
  const contacts = [s.company_phone, s.company_email].filter(Boolean).join("  ·  ");
  const contactLine = contacts ? `<div style="font-size:11px;color:#475569;">${contacts}</div>` : "";
  const reg = s.company_registration_no ? `<div style="font-size:10px;color:#94a3b8;">Reg No: ${s.company_registration_no}${s.company_tin ? "  ·  TIN: " + s.company_tin : ""}</div>` : "";

  return `
<div style="text-align:center;padding:16px 0 12px;border-bottom:2px solid #e2e8f0;margin-bottom:16px;">
  ${logo}
  <div style="font-size:18px;font-weight:900;color:#102a43;">${s.company_name}</div>
  ${tagline}${address}${contactLine}${reg}
</div>`;
}
