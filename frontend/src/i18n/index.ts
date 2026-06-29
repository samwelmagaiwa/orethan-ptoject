import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "./locales/en/common.json";
import customersEn from "./locales/en/customers.json";
import generalManagerEn from "./locales/en/generalManager.json";
import managingDirectorEn from "./locales/en/managingDirector.json";
import myLoansEn from "./locales/en/myLoans.json";
import repaymentTrackerEn from "./locales/en/repaymentTracker.json";
import loanManagerEn from "./locales/en/loanManager.json";
import dashboardEn from "./locales/en/dashboard.json";
import loanModalsEn from "./locales/en/loanModals.json";
import historyModalsEn from "./locales/en/historyModals.json";
import miscModalsEn from "./locales/en/miscModals.json";

import commonSw from "./locales/sw/common.json";
import customersSw from "./locales/sw/customers.json";
import generalManagerSw from "./locales/sw/generalManager.json";
import managingDirectorSw from "./locales/sw/managingDirector.json";
import myLoansSw from "./locales/sw/myLoans.json";
import repaymentTrackerSw from "./locales/sw/repaymentTracker.json";
import loanManagerSw from "./locales/sw/loanManager.json";
import dashboardSw from "./locales/sw/dashboard.json";
import loanModalsSw from "./locales/sw/loanModals.json";
import historyModalsSw from "./locales/sw/historyModals.json";
import miscModalsSw from "./locales/sw/miscModals.json";

export const LANGUAGE_STORAGE_KEY = "lang";

const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
const defaultLanguage = storedLanguage === "sw" ? "sw" : "en";

i18n.use(initReactI18next).init({
  lng: defaultLanguage,
  fallbackLng: "en",
  defaultNS: "common",
  ns: [
    "common", "customers", "generalManager", "managingDirector", "myLoans",
    "repaymentTracker", "loanManager", "dashboard", "loanModals", "historyModals", "miscModals",
  ],
  resources: {
    en: {
      common: commonEn,
      customers: customersEn,
      generalManager: generalManagerEn,
      managingDirector: managingDirectorEn,
      myLoans: myLoansEn,
      repaymentTracker: repaymentTrackerEn,
      loanManager: loanManagerEn,
      dashboard: dashboardEn,
      loanModals: loanModalsEn,
      historyModals: historyModalsEn,
      miscModals: miscModalsEn,
    },
    sw: {
      common: commonSw,
      customers: customersSw,
      generalManager: generalManagerSw,
      managingDirector: managingDirectorSw,
      myLoans: myLoansSw,
      repaymentTracker: repaymentTrackerSw,
      loanManager: loanManagerSw,
      dashboard: dashboardSw,
      loanModals: loanModalsSw,
      historyModals: historyModalsSw,
      miscModals: miscModalsSw,
    },
  },
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

document.documentElement.lang = defaultLanguage;

export default i18n;
