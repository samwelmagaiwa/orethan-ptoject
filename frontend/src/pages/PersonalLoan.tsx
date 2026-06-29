import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import LoanChecklist from "../components/LoanChecklist";
import CollateralDirectory, { type CollateralPhoto } from "../components/CollateralDirectory";

const PersonalLoan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isInitialized = useRef(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checklistResolved, setChecklistResolved] = useState(false);
  const [checklistState, setChecklistState] = useState<any>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState<{ form: any; step: number } | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info" | "warning">("info");
  const [alertOnAck, setAlertOnAck] = useState<(() => void) | null>(null);

  const [form, setForm] = useState({
    fomuNo: "",
    jinaKamiliLaMwombaji: "",
    jinsia: "",
    jinaMaarufu: "",
    tareheYaKuzaliwa: "",
    ainaYaKitambulisho: "",
    nambaYaKitambulisho: "",
    nambaYaSimu: "",
    baruaPepe: "",
    uraia: "",
    haliYaNdoa: "",
    mahaliUnapoishiMkoa: "",
    mahaliUnapoishiWilaya: "",
    mahaliUnapoishiKata: "",
    mahaliUnapoishiMtaa: "",
    umilikiWaMakazi: "",
    umilikiWaMakaziMengine: "",
    nambaYaNyumba: "",
    umeishiHapoTanguMiezi: "",
    jinaKamiliLaMumeMke: "",
    simuYaMumeMke: "",
    jinaMaarufuMtaani: "",
    ainaYaKitambulishoMumeMke: "",
    nambaYaKitambulishoMumeMke: "",
    kaziYaMumeMke: "",
    jinaLaMwajiriWaMumeMke: "",
    simuYaOfisiYaMumeMke: "",
    anuaniYaEneoLaKaziMumeMke: "",
    idadiYaUtegemezi: "",
    umeajiriwa: "", // New field for conditional Step 2


    // SEHEMU 2: TAARIFA ZA AJIRA (UOMBIAJI)
    jinaLaKampuniYaMwajiri: "",
    anuaniYaOfisiYaMwajiri: "",
    wadhifa: "",
    tareheYaKuanzaKazi: "",
    mshaharaKwaMwezi: "",
    ainaYaAjira: "",
    tareheYaKumalizaMkataba: "",
    tareheYaKustaafu: "",

    // SEHEMU 3: TAARIFA ZA BIASHARA
    jinaLaBiashara: "",
    ainaYaBiashara: "",
    mahaliBiasharaIlipo: "",
    umfanyaBiasharaTanguLini: "",
    jinaMmilikiEneoBiashara: "",
    nambaSimuMmilikiEneo: "",
    wastaniKipatoKwaMwezi: "",
    mudaMkatabaEneoBiashara: "",
    wastaniMatumiziKwaMwezi: "",
    kiasiMkopo: "",
    kwaManeno: "",
    mudaKulipaMkopo: "",
    kwaTarakimu: "",
    kiasiRejeshoBilaMatatizo: "",
    kiwakocha_Riba: "",
    ainaYaRiba: "",
    adaYaUchakataji: "",
    malengoMkopo: "",
    chanzoMapato: "",
    historia1JinaTaasisi: "", historia1UlichukuaLini: "", historia1KiasiMkopo: "", historia1KiasiMarejesho: "", historia1TareheMarejesho: "", historia1KiasiKilichobaki: "",
    historia2JinaTaasisi: "", historia2UlichukuaLini: "", historia2KiasiMkopo: "", historia2KiasiMarejesho: "", historia2TareheMarejesho: "", historia2KiasiKilichobaki: "",
    historia3JinaTaasisi: "", historia3UlichukuaLini: "", historia3KiasiMkopo: "", historia3KiasiMarejesho: "", historia3TareheMarejesho: "", historia3KiasiKilichobaki: "",
    dhamanaList: [{ aina: "", namba: "", umiliki: "", thamani: "", muonekano: "" }],
    wdhamini1JinaKamili: "", wdhamini1MahaliAnapoishi: "", wdhamini1AmepangaKwake: "", wdhamini1NambaNyumba: "", wdhamini1KaziAnayofanya: "", wdhamini1UhusianoWenu: "", wdhamini1MahaliOfisiYake: "", wdhamini1JinaKampuniBiashara: "", wdhamini1Simu: "",
    wdhamini2JinaKamili: "", wdhamini2MahaliAnapoishi: "", wdhamini2AmepangaKwake: "", wdhamini2NambaNyumba: "", wdhamini2KaziAnayofanya: "", wdhamini2UhusianoWenu: "", wdhamini2MahaliOfisiYake: "", wdhamini2JinaKampuniBiashara: "", wdhamini2Simu: "",
    tamkoLaMwombaji: false,
    mwombajiAmesainiFomuNgumu: false,
    mwombajiAmewekaDoleGumba: false,
    tamkoMdhamini1: false,
    mdhamini1AmesainiFomuNgumu: false,
    mdhamini1AmewekaDoleGumba: false,
    tamkoMdhamini2: false,
    mdhamini2AmesainiFomuNgumu: false,
    mdhamini2AmewekaDoleGumba: false,
    mwombajiAmewekaDoleGumba2: false,
    repaymentFrequency: "",

    // Photo URLs for Draft & Edit Persistence
    passportPhotoUrl: "",
    guarantor1PhotoUrl: "",
    guarantor2PhotoUrl: "",

    // Customer Collateral Directory (field photos of collateral items + notes)
    collateralPhotos: [] as CollateralPhoto[],

    // CHATTEL FORM (REHANI MALI)
    showChattelForm: false,
    chattelAinaYaDhamana: "",
    chattelItems: [{ id: Date.now(), jina: "", maelezo: "", thamaniSoko: "", thamaniDhamana: "" }],
    chattelOwnerName: "",
    chattelOwnerSigned: false,
    chattelSpouseName: "",
    chattelSpouseSigned: false,
    chattelWitnessName: "",
    chattelWitnessRelationship: "",
    chattelWitnessSigned: false,
    chattelOfficerName: "",
    chattelOfficerSigned: false,
    chattelOfficerDate: "",
    chattelChairmanName: "",
    chattelChairmanSigned: false,
    chattelChairmanDate: "",
    chattelChairmanStamp: false,
  });

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const isMoneyField = (name: string) => {
    const moneyKeys = [
      "mshaharaKwaMwezi",
      "wastaniKipatoKwaMwezi",
      "wastaniMatumiziKwaMwezi",
      "kiasiMkopo",
      "kiasiRejeshoBilaMatatizo",
      "thamani",
    ];
    return moneyKeys.includes(name) ||
      name.toLowerCase().includes("kiasi") ||
      name.toLowerCase().includes("thamani") ||
      name.toLowerCase().includes("mshahara");
  };

  const showAlert = (message: string, type: "success" | "error" | "info" | "warning" = "info", onAck?: () => void) => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
    setAlertOnAck(() => onAck ?? null);
  };

  // Scrolls to the first invalid/required field on the active step once it
  // has rendered, so the officer lands exactly where they need to fix it.
  const scrollToFirstError = () => {
    setTimeout(() => {
      const el = document.querySelector(".input-error");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo(0, 0);
      }
    }, 100);
  };
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [guarantor1Photo, setGuarantor1Photo] = useState<File | null>(null);
  const [guarantor2Photo, setGuarantor2Photo] = useState<File | null>(null);

  const getPhotoUrl = (url: string | undefined | null) => {
    if (!url) return "";
    if (url.startsWith('http')) return url;
    if (url.startsWith('blob:')) return url;
    const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'passport' | 'guarantor1' | 'guarantor2') => {

    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Show local preview if needed (optional since we'll use URL from server)
    if (type === 'passport') setPassportPhoto(file);
    else if (type === 'guarantor1') setGuarantor1Photo(file);
    else if (type === 'guarantor2') setGuarantor2Photo(file);

    // 2. Immediate Upload for Draft Persistence
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("photo", file, file.name);
      formData.append("applicant_name", `${form.jinaKamiliLaMwombaji || 'Applicant'}_${type}`);

      const res = await axios.post(`${API_BASE}/upload/passport`, formData, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      const url = res.data?.photo_url;
      if (url) {
        setForm(prev => ({
          ...prev,
          [`${type}PhotoUrl`]: url
        }));
      }
    } catch (error) {
      console.error(`Upload error for ${type}:`, error);
      showAlert("Imeshindwa kupakia picha. Tafadhali jaribu tena.", "error");
    }
  };

  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [streets, setStreets] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const DRAFT_TYPE = 'personal';
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

  // Persistence: Load draft from BACKEND on mount
  useEffect(() => {
    const token = localStorage.getItem('token');

    const loadDraft = async () => {
      // Priority 0: Edit Mode (Load submitted loan)
      if (editId) {
        setIsEditMode(true);
        setLoading(true);
        try {
          const res = await axios.get(`${API_BASE}/loans/${editId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const loan = res.data;
          if (loan && loan.details) {
            setForm(prev => ({
              ...prev,
              ...loan.details,
              jinaKamiliLaMwombaji: loan.name,
              nambaYaSimu: loan.phone,
              kiasiMkopo: loan.amount.toString(),
              passportPhotoUrl: loan.passport_photo || loan.details.passportPhotoUrl || "",
              guarantor1PhotoUrl: loan.guarantor_1_photo || loan.details.guarantor1PhotoUrl || "",
              guarantor2PhotoUrl: loan.guarantor_2_photo || loan.details.guarantor2PhotoUrl || "",
            }));
          }
          setLoading(false);
          isInitialized.current = true;
          return; // Skip normal draft loading
        } catch (e) {
          console.error("Error fetching loan for edit:", e);
          setLoading(false);
        }
      }

      // 1. Check localStorage for calculator return flag (fast path)
      const localStr = localStorage.getItem('personal_loan_draft');
      if (localStr) {
        try {
          const parsed = JSON.parse(localStr);
          if (parsed.isReturningFromCalculator) {
            // Merge calculator fields into backend draft or use as-is
            if (token) {
              // Fetch backend draft and deep-merge calculator values
              try {
                const res = await axios.get(`${API_BASE}/drafts/${DRAFT_TYPE}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.draft) {
                  const merged = { ...res.data.draft.form, ...parsed.form };
                  setForm(prev => ({ ...prev, ...merged }));
                  setCurrentStep(parsed.step ?? res.data.draft.step ?? 0);
                } else {
                  setForm(prev => ({ ...prev, ...parsed.form }));
                  setCurrentStep(parsed.step ?? 0);
                }
              } catch {
                setForm(prev => ({ ...prev, ...parsed.form }));
                setCurrentStep(parsed.step ?? 0);
              }
            } else {
              setForm(prev => ({ ...prev, ...parsed.form }));
              setCurrentStep(parsed.step ?? 0);
            }
            localStorage.removeItem('personal_loan_draft');
            isInitialized.current = true;

            // Auto-generate Fomu No if empty
            setForm(prev => {
              if (!prev.fomuNo) {
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                return { ...prev, fomuNo: `PSNL-${randomNum}` };
              }
              return prev;
            });
            fetchRegions();
            return;
          }
        } catch { /* ignore bad localStorage */ }
      }

      // 2. Load from backend
      if (token) {
        try {
          const res = await axios.get(`${API_BASE}/drafts/${DRAFT_TYPE}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.draft && res.data.draft.form &&
            Object.values(res.data.draft.form).some((v: any) => v !== '' && v !== false)) {
            setDraftData(res.data.draft);
            setShowDraftModal(true);
          } else {
            isInitialized.current = true;
          }
        } catch {
          isInitialized.current = true;
        }
      } else {
        isInitialized.current = true;
      }

      // Auto-generate Fomu No if empty
      setForm(prev => {
        if (!prev.fomuNo) {
          const randomNum = Math.floor(100000 + Math.random() * 900000);
          return { ...prev, fomuNo: `PSNL-${randomNum}` };
        }
        return prev;
      });
      fetchRegions();
    };

    loadDraft();
  }, []);

  // Persistence: Auto-save draft to BACKEND on change (debounced 2s)
  useEffect(() => {
    if (!isInitialized.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const timer = setTimeout(() => {
      axios.post(`${API_BASE}/drafts`, {
        type: DRAFT_TYPE,
        data: form,
        step: currentStep,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(e => console.error('Draft save error', e));
    }, 2000); // debounce 2s to avoid hammering the API

    return () => clearTimeout(timer);
  }, [form, currentStep]);

  // Sync Borrower/Spouse names and Dates to Chattel Form if empty
  useEffect(() => {
    if (form.showChattelForm) {
      setForm(prev => {
        const updates: any = {};
        const today = new Date().toISOString().split('T')[0];

        if (!prev.chattelOwnerName && prev.jinaKamiliLaMwombaji) {
          updates.chattelOwnerName = prev.jinaKamiliLaMwombaji;
        }
        if (!prev.chattelSpouseName && prev.jinaKamiliLaMumeMke) {
          updates.chattelSpouseName = prev.jinaKamiliLaMumeMke;
        }
        if (!prev.chattelOfficerName) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const u = JSON.parse(storedUser);
              if (u.name) updates.chattelOfficerName = u.name;
            } catch { /* ignore parsing errors */ }
          }
        }
        if (!prev.chattelOfficerDate) {
          updates.chattelOfficerDate = today;
        }
        if (!prev.chattelChairmanDate) {
          updates.chattelChairmanDate = today;
        }

        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [form.showChattelForm, form.jinaKamiliLaMwombaji, form.jinaKamiliLaMumeMke]);

  const handleRestoreDraft = () => {
    if (draftData) {
      setForm(prev => ({ ...prev, ...draftData.form }));
      setCurrentStep(draftData.step);
      isInitialized.current = true;
      setShowDraftModal(false);
    }
  };

  const handleDiscardDraft = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.delete(`${API_BASE}/drafts/${DRAFT_TYPE}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(e => console.error('Draft delete error', e));
    }
    isInitialized.current = true;
    setShowDraftModal(false);
  };

  const validateField = (name: string, value: any) => {
    let error = "";
    const optionalFields = [
      "jinaMaarufu",
      "simuYaMumeMke",
      "ainaYaKitambulishoMumeMke",
      "nambaYaKitambulishoMumeMke",
      "kaziYaMumeMke",
      "simuYaOfisiYaMumeMke",
      "anuaniYaEneoLaKaziMumeMke",
      "idadiYaUtegemezi",
      "nambaYaNyumba",
      "umilikiWaMakaziMengine",
      "uraia"
    ];

    if (!value && !optionalFields.includes(name) && !name.startsWith("historia")) {
      error = "Sehemu hii inahitajika";
    }

    if (name.toLowerCase().includes("simu") && value && !/^\d{10,12}$/.test(value)) {
      error = "Namba ya simu haijakamilika (Mshano: 07XXXXXXXX)";
    }

    if (name === "baruaPepe" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      error = "Barua pepe si sahihi";
    }

    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    let finalValue: any = type === "checkbox" ? checked : value;

    if (isMoneyField(name) && typeof finalValue === "string") {
      finalValue = finalValue.replace(/[^0-9]/g, '');
    }

    setForm({ ...form, [name]: finalValue });
    validateField(name, finalValue);
  };

  const handleAddCollateral = () => {
    setForm(prev => ({
      ...prev,
      dhamanaList: [...prev.dhamanaList, { aina: "", namba: "", umiliki: "", thamani: "", muonekano: "" }]
    }));
  };

  const handleRemoveCollateral = (index: number) => {
    if (form.dhamanaList.length <= 1) return;
    setForm(prev => ({
      ...prev,
      dhamanaList: prev.dhamanaList.filter((_, i) => i !== index)
    }));
  };

  const handleCollateralChange = (index: number, field: string, value: string) => {
    let finalValue = value;
    if (field === "thamani") {
      finalValue = value.replace(/[^0-9]/g, '');
    }
    setForm(prev => {
      const newList = [...prev.dhamanaList];
      newList[index] = { ...newList[index], [field]: finalValue };
      return { ...prev, dhamanaList: newList };
    });
  };

  const handleAddChattelItem = () => {
    setForm(prev => ({
      ...prev,
      chattelItems: [...prev.chattelItems, { id: Date.now(), jina: "", maelezo: "", thamaniSoko: "", thamaniDhamana: "" }]
    }));
  };

  const handleRemoveChattelItem = (id: number) => {
    if (form.chattelItems.length <= 1) return;
    setForm(prev => ({
      ...prev,
      chattelItems: prev.chattelItems.filter(item => item.id !== id)
    }));
  };

  const handleChattelChange = (id: number, field: string, value: string) => {
    setForm(prev => {
      const newItems = prev.chattelItems.map(item => {
        if (item.id === id) {
          let updatedItem = { ...item, [field]: value };
          if (field === "thamaniSoko") {
            const numericValue = Number(value.replace(/[^0-9]/g, ""));
            updatedItem.thamaniSoko = String(numericValue);
            updatedItem.thamaniDhamana = String(Math.round(numericValue * 0.7));
          }
          return updatedItem;
        }
        return item;
      });
      return { ...prev, chattelItems: newItems };
    });
  };

  const fetchRegions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/locations/regions`);
      setRegions(res.data);
    } catch (e) {
      console.error("Error fetching regions", e);
    }
  };

  const fetchDistricts = async (regionId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/locations/districts/${regionId}`);
      setDistricts(res.data);
      setWards([]);
      setStreets([]);
    } catch (e) {
      console.error("Error fetching districts", e);
    }
  };

  const fetchWards = async (districtId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/locations/wards/${districtId}`);
      setWards(res.data);
      setStreets([]);
    } catch (e) {
      console.error("Error fetching wards", e);
    }
  };

  const fetchStreets = async (wardId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/locations/streets/${wardId}`);
      setStreets(res.data);
    } catch (e) {
      console.error("Error fetching streets", e);
    }
  };

  const steps = [
    "1. TAARIFA ZA MWOMBAJI",
    "2. KAZI NA BIASHARA",
    "3. MKOPO NA HISTORIA",
    "4. DHAMANA NA WADHAMINI",
    "5. TAMKO NA PASSPORT",
    "6. ORODHA YA UHAKIKI WA NYARAKA",
    "7. DIRECTORI YA DHAMANA"
  ];

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById("navbar-portal"));
  }, []);

  const fieldLabels: Record<string, string> = {
    umeajiriwa: "Umeajiriwa?",
    jinaKamiliLaMwombaji: "Jina kamili la mwombaji",
    jinsia: "Jinsia",
    tareheYaKuzaliwa: "Tarehe ya kuzaliwa",
    nambaYaSimu: "Namba ya simu",
    nambaYaKitambulisho: "Namba ya kitambulisho",
    haliYaNdoa: "Hali ya ndoa",
    mahaliUnapoishiMkoa: "Mkoa",
    mahaliUnapoishiWilaya: "Wilaya",
    mahaliUnapoishiKata: "Kata",
    mahaliUnapoishiMtaa: "Mtaa",
    jinaLaKampuniYaMwajiri: "Jina la kampuni/mwajiri",
    anuaniYaOfisiYaMwajiri: "Anuani ya ofisi ya mwajiri",
    wadhifa: "Wadhifa wako",
    tareheYaKuanzaKazi: "Tarehe ya kuanza kazi",
    mshaharaKwaMwezi: "Mshahara kwa mwezi",
    ainaYaAjira: "Aina ya ajira",
    jinaLaBiashara: "Jina la biashara",
    ainaYaBiashara: "Aina ya biashara",
    mahaliBiasharaIlipo: "Mahali biashara ilipo",
    umfanyaBiasharaTanguLini: "Umefanya biashara tangu lini",
    kiasiMkopo: "Kiasi cha Mkopo",
    wastaniKipatoKwaMwezi: "Wastani wa mapato kwa mwezi",
    wastaniMatumiziKwaMwezi: "Wastani wa matumizi kwa mwezi",
    kwaManeno: "Kiasi kwa maneno",
    mudaKulipaMkopo: "Muda wa kulipa mkopo",
    kwaTarakimu: "Muda kwa tarakimu",
    kiasiRejeshoBilaMatatizo: "Rejesho unaloweza kulipa",
    chanzoMapato: "Chanzo cha Mapato",
    malengoMkopo: "Malengo ya Mkopo",
    wdhamini1JinaKamili: "Jina kamili la Mdhamini 1",
    wdhamini1Simu: "Simu ya Mdhamini 1",
    wdhamini2JinaKamili: "Jina kamili la Mdhamini 2",
    wdhamini2Simu: "Simu ya Mdhamini 2",
  };

  // Collateral cover check: the pledged security must exceed the requested loan.
  // - Dhamana list: total "Thamani yake kwa sasa" must be greater than the loan.
  // - Chattel form: total "THAMANI DHAMANA (70%)" must be greater than the loan.
  const collateralStatus = () => {
    const loanAmount = Number(form.kiasiMkopo) || 0;
    const totalDhamana = form.dhamanaList.reduce((sum, d) => sum + (Number(d.thamani) || 0), 0);
    const totalChattel = form.chattelItems.reduce((sum, i) => sum + (Number(i.thamaniDhamana) || 0), 0);
    return {
      loanAmount,
      totalDhamana,
      totalChattel,
      hasDhamana: totalDhamana > 0,
      hasChattel: totalChattel > 0,
      dhamanaCovers: totalDhamana > loanAmount,
      chattelCovers: totalChattel > loanAmount,
    };
  };

  // Returns the list of missing/invalid field labels for a given wizard step,
  // and records the per-field error state as a side effect (so navigating the
  // officer back to that step highlights exactly which fields need attention.
  const getMissingFieldsForStep = (step: number): string[] => {
    const stepFields: Record<number, string[]> = {
      0: ["jinaKamiliLaMwombaji", "jinsia", "tareheYaKuzaliwa", "nambaYaSimu", "nambaYaKitambulisho", "haliYaNdoa", "mahaliUnapoishiMkoa", "mahaliUnapoishiWilaya", "mahaliUnapoishiKata", "mahaliUnapoishiMtaa"],
      1: ["umeajiriwa"],
      2: ["kiasiMkopo", "wastaniKipatoKwaMwezi", "wastaniMatumiziKwaMwezi", "kwaManeno", "mudaKulipaMkopo", "kwaTarakimu", "kiasiRejeshoBilaMatatizo", "chanzoMapato", "malengoMkopo"],
      3: ["wdhamini1JinaKamili", "wdhamini1Simu", "wdhamini2JinaKamili", "wdhamini2Simu"]
    };

    if (step === 1) {
      if (form.umeajiriwa === "Ndio") {
        stepFields[1].push("jinaLaKampuniYaMwajiri", "anuaniYaOfisiYaMwajiri", "wadhifa", "tareheYaKuanzaKazi", "mshaharaKwaMwezi", "ainaYaAjira");
      } else if (form.umeajiriwa === "Hapana") {
        stepFields[1].push("jinaLaBiashara", "ainaYaBiashara", "mahaliBiasharaIlipo", "umfanyaBiasharaTanguLini");
      }
    }

    const currentFields = stepFields[step] || [];
    const missingFields: string[] = [];

    currentFields.forEach(field => {
      const error = validateField(field, (form as any)[field]);
      if (error && error !== "Barua pepe si sahihi" && error !== "Namba ya simu haijakamilika (Mshano: 07XXXXXXXX)") {
        missingFields.push(fieldLabels[field] || field);
      }
    });

    // Step 2: Validate dhamanaList — only critical fields
    if (step === 2) {
      form.dhamanaList.forEach((dhamana, index) => {
        if (!dhamana.aina) {
          setErrors(prev => ({ ...prev, [`dhamanaList.${index}.aina`]: "Sehemu hii inahitajika" }));
          if (!missingFields.includes("Aina ya Dhamana")) missingFields.push("Aina ya Dhamana");
        }
        if (!dhamana.thamani) {
          setErrors(prev => ({ ...prev, [`dhamanaList.${index}.thamani`]: "Sehemu hii inahitajika" }));
          if (!missingFields.includes("Thamani ya Dhamana")) missingFields.push("Thamani ya Dhamana");
        }
      });

      // Validate Chattel Form items if the form is open
      if (form.showChattelForm) {
        const hasEmptyChattelItem = form.chattelItems.some(item => !item.jina || !item.thamaniSoko);
        if (hasEmptyChattelItem) {
          missingFields.push("Jina au Thamani ya Mali katika Fomu ya Rehani");
        }
      }

      // Collateral must be worth MORE than the loan being requested.
      const cs = collateralStatus();
      if (cs.loanAmount > 0 && cs.hasDhamana && !cs.dhamanaCovers) {
        missingFields.push(`Thamani ya dhamana (TZS ${formatMoney(cs.totalDhamana)}) lazima izidi kiasi cha mkopo (TZS ${formatMoney(cs.loanAmount)})`);
      }
      if (form.showChattelForm && cs.loanAmount > 0 && cs.hasChattel && !cs.chattelCovers) {
        missingFields.push(`Thamani ya dhamana (70%) ya rehani (TZS ${formatMoney(cs.totalChattel)}) lazima izidi kiasi cha mkopo (TZS ${formatMoney(cs.loanAmount)})`);
      }
    }

    // Step 4: Declarations (tamko) must be accepted
    if (step === 4) {
      if (!form.tamkoLaMwombaji) missingFields.push("Tamko la Mwombaji");
      if (!form.tamkoMdhamini1) missingFields.push("Tamko la Mdhamini 1");
      if (!form.tamkoMdhamini2) missingFields.push("Tamko la Mdhamini 2");
    }

    // Step 5: Documentation checklist must be resolved
    if (step === 5 && !checklistResolved) {
      missingFields.push("Orodha ya Uhakiki wa Nyaraka");
    }

    return missingFields;
  };

  const nextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const missingFields = getMissingFieldsForStep(currentStep);

    if (missingFields.length === 0 && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else if (missingFields.length > 0) {
      showAlert(`Tafadhali jaza sehemu hizi zinazohitajika:\n• ${missingFields.join("\n• ")}`, "error", scrollToFirstError);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < steps.length - 1) return;

    // Full validation sweep across every step — catches anything missed or
    // changed after the officer moved past that step, and returns them to
    // the exact step with the problem instead of failing silently.
    for (let step = 0; step <= 5; step++) {
      const missingFields = getMissingFieldsForStep(step);
      if (missingFields.length > 0) {
        showAlert(
          `Tafadhali jaza/kamilisha sehemu hizi kwenye "${steps[step]}" kabla ya kuwasilisha:\n• ${missingFields.join("\n• ")}`,
          "error",
          () => {
            setCurrentStep(step);
            scrollToFirstError();
          }
        );
        return;
      }
    }

    const cleanNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      return Number(String(val).replace(/[^0-9.-]+/g, ""));
    };

    try {
      setLoading(true);

      const token = localStorage.getItem("token");


      // Prepare cleaned data for backend
      const cleanedDhamanaList = form.dhamanaList.map(d => ({
        ...d,
        thamani: cleanNumber(d.thamani)
      }));

      const cleanedChattelItems = form.chattelItems.map(item => ({
        ...item,
        thamaniSoko: cleanNumber(item.thamaniSoko),
        thamaniDhamana: cleanNumber(item.thamaniDhamana)
      }));

      const cleanedCollateralPhotos = form.collateralPhotos.map(photo => ({
        ...photo,
        items: photo.items.filter(item => item.jina)
      }));

      const payload = {
        name: form.jinaKamiliLaMwombaji,
        phone: form.nambaYaSimu,
        amount: cleanNumber(form.kiasiMkopo),
        type: "personal",
        passport_photo: form.passportPhotoUrl,
        guarantor_1_photo: form.guarantor1PhotoUrl,
        guarantor_2_photo: form.guarantor2PhotoUrl,
        details: {
          ...form,
          documentation_checklist: checklistState,
          // redundant but kept for safety with existing logic
          passportPhotoUrl: form.passportPhotoUrl,
          guarantor1PhotoUrl: form.guarantor1PhotoUrl,
          guarantor2PhotoUrl: form.guarantor2PhotoUrl,
          wastaniKipatoKwaMwezi: cleanNumber(form.wastaniKipatoKwaMwezi),
          wastaniMatumiziKwaMwezi: cleanNumber(form.wastaniMatumiziKwaMwezi),
          dhamanaList: cleanedDhamanaList,
          chattelItems: cleanedChattelItems,
          collateralPhotos: cleanedCollateralPhotos
        },
      };

      const successMessage = isEditMode ? "OMBI LA MKOPO LIMEREKEBISHWA KWA MAFANIKIO!" : "OMBI LA MKOPO LIMEWASILISHWA KWA MAFANIKIO!";
      const method = isEditMode ? "put" : "post";
      const url = isEditMode ? `${API_BASE}/loans/${editId}` : `${API_BASE}/loans`;

      await axios({
        method,
        url,
        data: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      localStorage.removeItem("personal_loan_draft");
      showAlert(successMessage, "success");
      setTimeout(() => {
        navigate("/my-applications");
      }, 2000);
    } catch (error: any) {
      showAlert(error.response?.data?.message || "Imeshindwa kuwasilisha ombi", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {showDraftModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="modal-content" style={{ background: '#fffcf8', padding: '30px', borderRadius: '15px', maxWidth: '450px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', border: '2px solid #e2bc8a', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📝</div>
            <h3 style={{ color: '#5c4033', marginBottom: '15px', fontSize: '1.5rem' }}>Draft Imepatikana!</h3>
            <p style={{ color: '#8b735b', marginBottom: '25px', lineHeight: '1.6' }}>
              Tumeshaona kuwa ulikuwa umeanza kujaza fomu hii hapo awali. Je, ungependa kuendelea ulikoishia au kuanza upya?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleRestoreDraft}
                style={{ background: 'linear-gradient(135deg, #e2bc8a 0%, #c19a6b 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
              >
                Endelea ulikoishia
              </button>
              <button
                onClick={handleDiscardDraft}
                style={{ background: 'transparent', color: '#8b735b', border: '1px solid #e2bc8a', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Anza upya
              </button>
            </div>
          </div>
        </div>
      )}
      {portalTarget && createPortal(
        <div className="form-portal-content">
          <div className="fomu-no" style={{ opacity: 0.7 }}>
            <span style={{ color: '#64748b' }}>Fomu No:</span>
            <input type="text" name="fomuNo" value={form.fomuNo} readOnly className="fomu-no-input" style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }} />
          </div>
          <div className="step-indicators">
            {steps.map((_, idx) => (
              <button key={idx} type="button" className={`step-btn ${idx === currentStep ? "active" : ""} ${idx < currentStep ? "completed" : ""}`} onClick={() => idx < currentStep && setCurrentStep(idx)}>
                {idx + 1}
              </button>
            ))}
          </div>
        </div>,
        portalTarget
      )}

      <div className="form-container">
        <div className="step-title" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <span>{steps[currentStep]}</span>
          {currentStep === 1 && (
            <div className="title-toggle" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              background: '#fff',
              padding: '4px 15px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem',
              fontWeight: 'normal',
              textTransform: 'none'
            }}>
              <span style={{ fontWeight: 'bold', color: '#64748b' }}>Umeajiriwa?</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#102a43' }}>
                <input type="radio" name="umeajiriwa" value="Ndio" checked={form.umeajiriwa === "Ndio"} onChange={handleChange} style={{ width: 'auto', margin: 0 }} />
                Ndio
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#102a43' }}>
                <input type="radio" name="umeajiriwa" value="Hapana" checked={form.umeajiriwa === "Hapana"} onChange={handleChange} style={{ width: 'auto', margin: 0 }} />
                Hapana
              </label>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-scroll">

            {/* STEP 1: TAARIFA ZA MWOMBAJI */}
            {currentStep === 0 && (
              <div className="form-section">
                <div className="section-divider">SEHEMU 1: TAARIFA ZA MWOMBAJI</div>

                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={4}><strong>Jina kamili la mwombaji</strong><br />
                        <input type="text" name="jinaKamiliLaMwombaji" placeholder="Mfano: John Joseph Doe" className={errors.jinaKamiliLaMwombaji ? "input-error" : ""} value={form.jinaKamiliLaMwombaji} onChange={handleChange} />
                        {errors.jinaKamiliLaMwombaji && <span className="error-text">{errors.jinaKamiliLaMwombaji}</span>}
                      </td>
                      <td colSpan={2}><strong>Jinsia</strong><br />
                        <select name="jinsia" className={errors.jinsia ? "input-error" : ""} value={form.jinsia} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option value="Me">Me</option>
                          <option value="Ke">Ke</option>
                        </select>
                        {errors.jinsia && <span className="error-text">{errors.jinsia}</span>}
                      </td>
                      <td colSpan={3}><strong>Jina maarufu</strong><br /><input type="text" name="jinaMaarufu" placeholder="Jina la utani / umaarufu" value={form.jinaMaarufu} onChange={handleChange} /></td>
                      <td colSpan={3}><strong>Tarehe ya kuzaliwa</strong><br />
                        <input type="date" name="tareheYaKuzaliwa" className={errors.tareheYaKuzaliwa ? "input-error" : ""} value={form.tareheYaKuzaliwa} onChange={handleChange} />
                        {errors.tareheYaKuzaliwa && <span className="error-text">{errors.tareheYaKuzaliwa}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Aina ya kitambulisho</strong><br />
                        <select name="ainaYaKitambulisho" className={errors.ainaYaKitambulisho ? "input-error" : ""} value={form.ainaYaKitambulisho} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option value="Kitambulisho cha Taifa">Kitambulisho cha Taifa</option>
                          <option value="Pasipoti">Pasipoti</option>
                          <option value="Leseni ya kuendesha">Leseni ya kuendesha</option>
                        </select>
                        {errors.ainaYaKitambulisho && <span className="error-text">{errors.ainaYaKitambulisho}</span>}
                      </td>
                      <td colSpan={4}><strong>Namba ya kitambulisho</strong><br />
                        <input type="text" name="nambaYaKitambulisho" placeholder="Namba ya kitambulisho ulichochagua" className={errors.nambaYaKitambulisho ? "input-error" : ""} value={form.nambaYaKitambulisho} onChange={handleChange} />
                        {errors.nambaYaKitambulisho && <span className="error-text">{errors.nambaYaKitambulisho}</span>}
                      </td>
                      <td colSpan={4}><strong>Namba ya simu</strong><br />
                        <input type="tel" name="nambaYaSimu" placeholder="Mfano: 07XXXXXXXX" className={errors.nambaYaSimu ? "input-error" : ""} value={form.nambaYaSimu} onChange={handleChange} />
                        {errors.nambaYaSimu && <span className="error-text">{errors.nambaYaSimu}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Barua pepe (Email)</strong><br />
                        <input type="email" name="baruaPepe" placeholder="Mfano: jina@mfano.com" className={errors.baruaPepe ? "input-error" : ""} value={form.baruaPepe} onChange={handleChange} />
                        {errors.baruaPepe && <span className="error-text">{errors.baruaPepe}</span>}
                      </td>
                      <td colSpan={4}><strong>Uraia (Nationality)</strong><br />
                        <input type="text" name="uraia" placeholder="Mfano: Mtanzania" className={errors.uraia ? "input-error" : ""} value={form.uraia} onChange={handleChange} />
                        {errors.uraia && <span className="error-text">{errors.uraia}</span>}
                      </td>
                      <td colSpan={4}><strong>Hali ya ndoa</strong><br />
                        <select name="haliYaNdoa" className={errors.haliYaNdoa ? "input-error" : ""} value={form.haliYaNdoa} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option value="Nimeoa/Olewa">1. Nimeoa/Olewa</option>
                          <option value="Sijaoa/Olewa">2. Sijaoa/Olewa</option>
                          <option value="Nimeachika">3. Nimeachika</option>
                          <option value="Mjane">4. Mjane</option>
                        </select>
                        {errors.haliYaNdoa && <span className="error-text">{errors.haliYaNdoa}</span>}
                      </td>
                    </tr>
                    <tr><td colSpan={12} className="sub-header" style={{ background: "#f0f0f0", fontWeight: "bold" }}>MAHALI UNAPOISHI KWA SASA</td></tr>
                    <tr>
                      <td colSpan={3}><strong>Mkoa</strong><br />
                        <select name="mahaliUnapoishiMkoa" className={errors.mahaliUnapoishiMkoa ? "input-error" : ""} value={regions.find(r => r.name === form.mahaliUnapoishiMkoa)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = regions.find(r => String(r.id) === id)?.name || "";
                          setForm({ ...form, mahaliUnapoishiMkoa: name, mahaliUnapoishiWilaya: "", mahaliUnapoishiKata: "", mahaliUnapoishiMtaa: "" });
                          if (id) fetchDistricts(id);
                          validateField("mahaliUnapoishiMkoa", name);
                        }}>
                          <option value="">Chagua Mkoa</option>
                          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        {errors.mahaliUnapoishiMkoa && <span className="error-text">{errors.mahaliUnapoishiMkoa}</span>}
                      </td>
                      <td colSpan={3}><strong>Wilaya</strong><br />
                        <select name="mahaliUnapoishiWilaya" className={errors.mahaliUnapoishiWilaya ? "input-error" : ""} value={districts.find(d => d.name === form.mahaliUnapoishiWilaya)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = districts.find(d => String(d.id) === id)?.name || "";
                          setForm({ ...form, mahaliUnapoishiWilaya: name, mahaliUnapoishiKata: "", mahaliUnapoishiMtaa: "" });
                          if (id) fetchWards(id);
                          validateField("mahaliUnapoishiWilaya", name);
                        }}>
                          <option value="">Chagua Wilaya</option>
                          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {errors.mahaliUnapoishiWilaya && <span className="error-text">{errors.mahaliUnapoishiWilaya}</span>}
                      </td>
                      <td colSpan={3}><strong>Kata</strong><br />
                        <select name="mahaliUnapoishiKata" className={errors.mahaliUnapoishiKata ? "input-error" : ""} value={wards.find(w => w.name === form.mahaliUnapoishiKata)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = wards.find(w => String(w.id) === id)?.name || "";
                          setForm({ ...form, mahaliUnapoishiKata: name, mahaliUnapoishiMtaa: "" });
                          if (id) fetchStreets(id);
                          validateField("mahaliUnapoishiKata", name);
                        }}>
                          <option value="">Chagua Kata</option>
                          {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        {errors.mahaliUnapoishiKata && <span className="error-text">{errors.mahaliUnapoishiKata}</span>}
                      </td>
                      <td colSpan={3}><strong>Mtaa / Kijiji</strong><br />
                        {streets.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <select name="mahaliUnapoishiMtaa" className={errors.mahaliUnapoishiMtaa ? "input-error" : ""} value={form.mahaliUnapoishiMtaa} onChange={handleChange}>
                              <option value="">Chagua Mtaa</option>
                              {streets.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                              <option value="OTHER">HAKIPO KWENYE ORODHA</option>
                            </select>
                            {(form.mahaliUnapoishiMtaa === "OTHER" || (form.mahaliUnapoishiMtaa && !streets.find(s => s.name === form.mahaliUnapoishiMtaa))) && (
                              <input type="text" placeholder="Andika Mtaa hapa..." className={errors.mahaliUnapoishiMtaa ? "input-error" : ""} value={form.mahaliUnapoishiMtaa === "OTHER" ? "" : form.mahaliUnapoishiMtaa} onChange={(e) => {
                                const val = e.target.value;
                                setForm({ ...form, mahaliUnapoishiMtaa: val });
                                validateField("mahaliUnapoishiMtaa", val);
                              }} />
                            )}
                          </div>
                        ) : (
                          <input type="text" name="mahaliUnapoishiMtaa" className={errors.mahaliUnapoishiMtaa ? "input-error" : ""} value={form.mahaliUnapoishiMtaa} onChange={handleChange} placeholder="Andika Mtaa..." />
                        )}
                        {errors.mahaliUnapoishiMtaa && <span className="error-text">{errors.mahaliUnapoishiMtaa}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Umiliki wa makazi</strong><br />
                        <select name="umilikiWaMakazi" className={errors.umilikiWaMakazi ? "input-error" : ""} value={form.umilikiWaMakazi} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option value="Kwake">Kwake</option>
                          <option value="Umepanga">Umepanga</option>
                          <option value="Mengine">Mengine (eleza)</option>
                        </select>
                        {errors.umilikiWaMakazi && <span className="error-text">{errors.umilikiWaMakazi}</span>}
                        {form.umilikiWaMakazi === "Mengine" && <input type="text" name="umilikiWaMakaziMengine" value={form.umilikiWaMakaziMengine} onChange={handleChange} style={{ marginTop: "5px" }} placeholder="Eleza hapa..." />}
                      </td>
                      <td colSpan={3}><strong>Namba ya nyumba</strong><br /><input type="text" name="nambaYaNyumba" placeholder="Mfano: 123" value={form.nambaYaNyumba} onChange={handleChange} /></td>
                      <td colSpan={3}><strong>Umeishi hapo tangu (miezi)</strong><br /><input type="text" name="umeishiHapoTanguMiezi" placeholder="Mfano: 24" value={form.umeishiHapoTanguMiezi} onChange={handleChange} /></td>
                    </tr>
                    <tr><td colSpan={12} className="sub-header" style={{ background: "#f0f0f0", fontWeight: "bold" }}>TAARIFA ZA MUME/MKE</td></tr>
                    <tr>
                      <td colSpan={4}><strong>Jina kamili la mume/mke</strong><br /><input type="text" name="jinaKamiliLaMumeMke" placeholder="Mfano: Jane John Doe" value={form.jinaKamiliLaMumeMke} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Simu</strong><br /><input type="tel" name="simuYaMumeMke" placeholder="Mfano: 07XXXXXXXX" value={form.simuYaMumeMke} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Jina maarufu mtaani</strong><br /><input type="text" name="jinaMaarufuMtaani" placeholder="Jina la umaarufu" value={form.jinaMaarufuMtaani} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Aina ya kitambulisho</strong><br /><select name="ainaYaKitambulishoMumeMke" value={form.ainaYaKitambulishoMumeMke} onChange={handleChange}><option value="">Chagua</option><option value="Kitambulisho cha Taifa">Kitambulisho cha Taifa</option><option value="Pasipoti">Pasipoti</option></select></td>
                      <td colSpan={4}><strong>Namba ya kitambulisho</strong><br /><input type="text" name="nambaYaKitambulishoMumeMke" value={form.nambaYaKitambulishoMumeMke} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Kazi anayofanya</strong><br /><input type="text" name="kaziYaMumeMke" value={form.kaziYaMumeMke} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Jina la mwajiri</strong><br /><input type="text" name="jinaLaMwajiriWaMumeMke" value={form.jinaLaMwajiriWaMumeMke} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Simu ya ofisi</strong><br /><input type="tel" name="simuYaOfisiYaMumeMke" value={form.simuYaOfisiYaMumeMke} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Anuani ya eneo la kazi</strong><br /><input type="text" name="anuaniYaEneoLaKaziMumeMke" placeholder="Mfano: Posta mpya" value={form.anuaniYaEneoLaKaziMumeMke} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Idadi ya utegemezi</strong><br /><input type="number" name="idadiYaUtegemezi" placeholder="Mfano: 3" value={form.idadiYaUtegemezi} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* STEP 2: KAZI NA BIASHARA */}
            {currentStep === 1 && (
              <div className="form-section">
                {errors.umeajiriwa && <div className="error-text" style={{ marginBottom: '20px', textAlign: 'center', background: '#fee2e2', padding: '8px', borderRadius: '6px' }}>Tafadhali chagua kama umeajiriwa au la kwenye kichwa cha ukurasa hapo juu</div>}

                {/* SEHEMU 2: AJIRA */}
                <div style={{ opacity: form.umeajiriwa === "Ndio" ? 1 : 0.5, pointerEvents: form.umeajiriwa === "Ndio" ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
                  <div className="section-subtitle" style={{ background: '#f1f5f9', padding: '8px 15px', fontWeight: 'bold', marginBottom: '10px', borderRadius: '4px' }}>SEHEMU 2: TAARIFA ZA AJIRA</div>




                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                    background: '#fff',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    marginTop: '10px'
                  }}>
                    <div className="grid-field">
                      <strong>Jina la kampuni/mwajiri</strong>
                      <input type="text" name="jinaLaKampuniYaMwajiri" placeholder="Mfano: Wizara ya Afya" disabled={form.umeajiriwa !== "Ndio"} className={errors.jinaLaKampuniYaMwajiri ? "input-error" : ""} value={form.jinaLaKampuniYaMwajiri} onChange={handleChange} />
                      {errors.jinaLaKampuniYaMwajiri && <span className="error-text">{errors.jinaLaKampuniYaMwajiri}</span>}
                    </div>
                    <div className="grid-field">
                      <strong>Anuani ya ofisi ya mwajiri</strong>
                      <input type="text" name="anuaniYaOfisiYaMwajiri" placeholder="Mfano: Posta, Dar es Salaam" disabled={form.umeajiriwa !== "Ndio"} className={errors.anuaniYaOfisiYaMwajiri ? "input-error" : ""} value={form.anuaniYaOfisiYaMwajiri} onChange={handleChange} />
                      {errors.anuaniYaOfisiYaMwajiri && <span className="error-text">{errors.anuaniYaOfisiYaMwajiri}</span>}
                    </div>
                    <div className="grid-field">
                      <strong>Wadhifa wako</strong>
                      <input type="text" name="wadhifa" placeholder="Mfano: Afisa Utumishi" disabled={form.umeajiriwa !== "Ndio"} className={errors.wadhifa ? "input-error" : ""} value={form.wadhifa} onChange={handleChange} />
                      {errors.wadhifa && <span className="error-text">{errors.wadhifa}</span>}
                    </div>
                    <div className="grid-field">
                      <strong>Umefanya kazi hapo toka lini</strong>
                      <input type="text" name="tareheYaKuanzaKazi" placeholder="Mfano: Januari 2020" disabled={form.umeajiriwa !== "Ndio"} className={errors.tareheYaKuanzaKazi ? "input-error" : ""} value={form.tareheYaKuanzaKazi} onChange={handleChange} />
                      {errors.tareheYaKuanzaKazi && <span className="error-text">{errors.tareheYaKuanzaKazi}</span>}
                    </div>
                    <div className="grid-field">
                      <strong>Mshahara kwa mwezi (Tsh)</strong>
                      <input type="text" name="mshaharaKwaMwezi" placeholder="Mfano: 800,000" disabled={form.umeajiriwa !== "Ndio"} className={errors.mshaharaKwaMwezi ? "input-error" : ""} value={form.mshaharaKwaMwezi ? formatMoney(Number(form.mshaharaKwaMwezi)) : ""} onChange={handleChange} />
                      {errors.mshaharaKwaMwezi && <span className="error-text">{errors.mshaharaKwaMwezi}</span>}
                    </div>
                    <div className="grid-field">
                      <strong>Aina ya ajira</strong>
                      <select name="ainaYaAjira" disabled={form.umeajiriwa !== "Ndio"} className={errors.ainaYaAjira ? "input-error" : ""} value={form.ainaYaAjira} onChange={handleChange}>
                        <option value="">Chagua</option>
                        <option value="Kudumu">Kudumu</option>
                        <option value="Mkataba">Mkataba</option>
                        <option value="Ya muda mfupi">Ya muda mfupi</option>
                      </select>
                      {errors.ainaYaAjira && <span className="error-text">{errors.ainaYaAjira}</span>}
                    </div>
                  </div>
                </div>

                {/* SEHEMU 3: BIASHARA */}
                <div style={{ opacity: form.umeajiriwa === "Hapana" ? 1 : 0.5, pointerEvents: form.umeajiriwa === "Hapana" ? 'auto' : 'none', transition: 'opacity 0.3s', marginTop: '40px' }}>
                  <div className="section-subtitle" style={{ background: '#f1f5f9', padding: '8px 15px', fontWeight: 'bold', marginBottom: '10px', borderRadius: '4px' }}>SEHEMU 3: TAARIFA ZA BIASHARA</div>




                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                    background: '#fff',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    marginTop: '10px'
                  }}>
                    <div className="grid-field">
                      <strong>Jina la Biashara</strong>
                      <input type="text" name="jinaLaBiashara" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: John Hardware" value={form.jinaLaBiashara} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Aina ya Biashara</strong>
                      <input type="text" name="ainaYaBiashara" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: Uuzaji wa vifaa vya ujenzi" value={form.ainaYaBiashara} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Mahali Biashara Ilipo</strong>
                      <input type="text" name="mahaliBiasharaIlipo" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: Kariakoo, Mtaa wa Aggrey" value={form.mahaliBiasharaIlipo} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Umfanya Biashara hii tangu lini</strong>
                      <input type="text" name="umfanyaBiasharaTanguLini" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: Mwaka 2018" value={form.umfanyaBiasharaTanguLini} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Jina la mmiliki wa eneo la biashara</strong>
                      <input type="text" name="jinaMmilikiEneoBiashara" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: Hassan Khamis" value={form.jinaMmilikiEneoBiashara} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Namba zake za simu</strong>
                      <input type="tel" name="nambaSimuMmilikiEneo" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: 07XXXXXXXX" value={form.nambaSimuMmilikiEneo} onChange={handleChange} />
                    </div>
                    <div className="grid-field">
                      <strong>Muda wa mkataba wa eneo la biashara</strong>
                      <input type="text" name="mudaMkatabaEneoBiashara" disabled={form.umeajiriwa !== "Hapana"} placeholder="Mfano: Miaka 2" value={form.mudaMkatabaEneoBiashara} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: MKOPO NA HISTORIA */}
            {currentStep === 2 && (
              <div className="form-section">
                {/* SEHEMU 4: KIASI */}
                <div className="section-divider">SEHEMU 4: KIASI CHA MKOPO NA MALENGO</div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  background: '#fff',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginTop: '10px'
                }}>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <strong>Kiasi cha Mkopo (Tsh)</strong>
                      <button
                        type="button"
                        onClick={() => navigate('/?fromLoan=true')}
                        style={{
                          background: '#102a43',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: '800'
                        }}
                      >
                        CALCULATOR
                      </button>
                    </div>
                    <input type="text" name="kiasiMkopo" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kiasiMkopo ? formatMoney(Number(form.kiasiMkopo)) : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Wastani wa kipato kwa mwezi</strong>
                    <input type="text" name="wastaniKipatoKwaMwezi" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.wastaniKipatoKwaMwezi ? formatMoney(Number(form.wastaniKipatoKwaMwezi)) : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Wastani wa matumizi kwa mwezi</strong>
                    <input type="text" name="wastaniMatumiziKwaMwezi" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.wastaniMatumiziKwaMwezi ? formatMoney(Number(form.wastaniMatumiziKwaMwezi)) : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field">
                    <strong>Kwa maneno</strong>
                    <input type="text" name="kwaManeno" placeholder="Mfano: Milioni Moja" className={errors.kwaManeno ? "input-error" : ""} value={form.kwaManeno} onChange={handleChange} />
                    {errors.kwaManeno && <span className="error-text">{errors.kwaManeno}</span>}
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Muda wa kulipa Mkopo</strong>
                    <input type="text" name="mudaKulipaMkopo" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.mudaKulipaMkopo} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Muda kwa tarakimu</strong>
                    <input type="text" name="kwaTarakimu" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kwaTarakimu} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Rejesho unaloweza kulipa ({form.repaymentFrequency === "Daily" ? "Kila Siku" : form.repaymentFrequency === "Weekly" ? "Kila Wiki" : "Kila Mwezi"})</strong>
                    <input type="text" name="kiasiRejeshoBilaMatatizo" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kiasiRejeshoBilaMatatizo ? formatMoney(Number(form.kiasiRejeshoBilaMatatizo)) : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Kiwango cha Riba (% kwa mwezi)</strong>
                    <input type="text" name="kiwakocha_Riba" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kiwakocha_Riba ? `${form.kiwakocha_Riba}%` : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Aina ya Riba</strong>
                    <input type="text" name="ainaYaRiba" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.ainaYaRiba} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <strong>Ada ya Uchakataji (%)</strong>
                    <input type="text" name="adaYaUchakataji" readOnly style={{ backgroundColor: '#ffffff', color: '#1e293b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.adaYaUchakataji ? `${form.adaYaUchakataji}%` : ""} />
                    <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                  </div>
                  <div className="grid-field">
                    <strong>Chanzo cha Mapato</strong>
                    <input type="text" name="chanzoMapato" placeholder="Mfano: Biashara / Mshahara" className={errors.chanzoMapato ? "input-error" : ""} value={form.chanzoMapato} onChange={handleChange} />
                    {errors.chanzoMapato && <span className="error-text">{errors.chanzoMapato}</span>}
                  </div>
                  <div className="grid-field" style={{ gridColumn: '1 / -1' }}>
                    <strong>Malengo ya Mkopo</strong>
                    <textarea name="malengoMkopo" rows={3} placeholder="Eleza kwa ufupi malengo ya mkopo huu..." className={errors.malengoMkopo ? "input-error" : ""} value={form.malengoMkopo} onChange={handleChange}></textarea>
                    {errors.malengoMkopo && <span className="error-text">{errors.malengoMkopo}</span>}
                  </div>
                </div>

                <div className="section-divider" style={{ marginTop: '40px' }}>SEHEMU 5: HISTORIA YA MIKOPO (HIARI)</div>
                <table className="form-table">
                  <tbody>
                    <tr><td colSpan={12}>Anza kwa mikopo ya karibuni zaidi (Wacha wazi kama huna):</td></tr>
                    {[1, 2].map(i => (
                      <tr key={i}>
                        <td colSpan={4}><strong className="optional">Taasisi {i} (Hiari)</strong><br /><input type="text" name={`historiaTaasisi${i}`} placeholder="Mfano: Hakuna" value={(form as any)[`historiaTaasisi${i}`]} onChange={handleChange} /></td>
                        <td colSpan={4}><strong className="optional">Kiasi {i} (Hiari)</strong><br /><input type="text" name={`historiaKiasi${i}`} placeholder="Mfano: TSh 0" value={(form as any)[`historiaKiasi${i}`] ? formatMoney(Number((form as any)[`historiaKiasi${i}`])) : ""} onChange={handleChange} /></td>
                        <td colSpan={4}><strong className="optional">Hali {i} (Hiari)</strong><br /><input type="text" name={`historiaHali${i}`} placeholder="Mfano: 0 / Nimemaliza" value={(form as any)[`historiaHali${i}`]} onChange={handleChange} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* SEHEMU 6: DHAMANA list */}
                <div style={{ marginTop: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div className="section-subtitle" style={{ background: '#f1f5f9', padding: '8px 15px', fontWeight: 'bold', borderRadius: '4px', margin: 0 }}>SEHEMU 6: DHAMANA YA MKOPO</div>
                    <button
                      type="button"
                      onClick={handleAddCollateral}
                      style={{
                        background: '#102a43',
                        color: 'white',
                        border: 'none',
                        padding: '8px 15px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>+</span> ONGEZA DHAMANA
                    </button>
                  </div>

                  {form.dhamanaList.map((dhamana, index) => (
                    <div key={index} style={{
                      background: '#fff',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      marginTop: index === 0 ? '0' : '20px',
                      position: 'relative'
                    }}>
                      {form.dhamanaList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCollateral(index)}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ONDOA
                        </button>
                      )}
                      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '15px', textTransform: 'uppercase' }}>Dhamana Na. {index + 1}</div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '20px'
                      }}>
                        <div className="grid-field">
                          <strong>Aina ya dhamana</strong>
                          <input
                            type="text"
                            placeholder="Mfano: Gari / Kiwanja"
                            className={errors[`dhamanaList.${index}.aina`] ? "input-error" : ""}
                            value={dhamana.aina}
                            onChange={(e) => handleCollateralChange(index, "aina", e.target.value)}
                          />
                          {errors[`dhamanaList.${index}.aina`] && <span className="error-text">Sehemu hii inahitajika</span>}
                        </div>
                        <div className="grid-field">
                          <strong>Namba za usajili</strong>
                          <input
                            type="text"
                            placeholder="Mfano: T 123 ABC"
                            className={errors[`dhamanaList.${index}.namba`] ? "input-error" : ""}
                            value={dhamana.namba}
                            onChange={(e) => handleCollateralChange(index, "namba", e.target.value)}
                          />
                          {errors[`dhamanaList.${index}.namba`] && <span className="error-text">Sehemu hii inahitajika</span>}
                        </div>
                        <div className="grid-field">
                          <strong>Umiliki</strong>
                          <input
                            type="text"
                            placeholder="Mfano: Jina langu / Kadi ya gari"
                            className={errors[`dhamanaList.${index}.umiliki`] ? "input-error" : ""}
                            value={dhamana.umiliki}
                            onChange={(e) => handleCollateralChange(index, "umiliki", e.target.value)}
                          />
                          {errors[`dhamanaList.${index}.umiliki`] && <span className="error-text">Sehemu hii inahitajika</span>}
                        </div>
                        <div className="grid-field">
                          <strong>Thamani yake kwa sasa</strong>
                          <input
                            type="text"
                            placeholder="Mfano: 5,000,000"
                            className={errors[`dhamanaList.${index}.thamani`] ? "input-error" : ""}
                            value={dhamana.thamani ? formatMoney(Number(dhamana.thamani)) : ""}
                            onChange={(e) => handleCollateralChange(index, "thamani", e.target.value)}
                          />
                          {errors[`dhamanaList.${index}.thamani`] && <span className="error-text">Sehemu hii inahitajika</span>}
                        </div>
                        <div className="grid-field">
                          <strong>Muonekano wa dhamana</strong>
                          <select
                            className={errors[`dhamanaList.${index}.muonekano`] ? "input-error" : ""}
                            value={dhamana.muonekano}
                            onChange={(e) => handleCollateralChange(index, "muonekano", e.target.value)}
                          >
                            <option value="">Chagua</option>
                            <option>Nzuri sana</option>
                            <option>Nzuri</option>
                            <option>Kuridhisha</option>
                            <option>Inahitaji matengenezo</option>
                          </select>
                          {errors[`dhamanaList.${index}.muonekano`] && <span className="error-text">Sehemu hii inahitajika</span>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Live collateral-cover check: total dhamana value vs requested loan */}
                  {(() => {
                    const cs = collateralStatus();
                    if (cs.loanAmount <= 0 || !cs.hasDhamana) return null;
                    return cs.dhamanaCovers ? (
                      <div style={{ marginTop: '15px', padding: '12px 16px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.85rem', fontWeight: 600 }}>
                        ✓ Jumla ya thamani ya dhamana (TZS {formatMoney(cs.totalDhamana)}) inazidi kiasi cha mkopo (TZS {formatMoney(cs.loanAmount)}). Dhamana inatosha.
                      </div>
                    ) : (
                      <div style={{ marginTop: '15px', padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700 }}>
                        ⚠ Jumla ya thamani ya dhamana (TZS {formatMoney(cs.totalDhamana)}) HAITOSHI. Lazima izidi kiasi cha mkopo (TZS {formatMoney(cs.loanAmount)}). Tafadhali ongeza thamani ya dhamana.
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, showChattelForm: !prev.showChattelForm }))}
                      style={{
                        background: form.showChattelForm ? '#ef4444' : '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '12px 25px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {form.showChattelForm ? "FUNGA FOMU YA REHANI" : "REHANI MALI"}
                    </button>
                  </div>

                  {form.showChattelForm && (
                    <div style={{ marginTop: '30px', borderLeft: '8px solid #102a43', background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h3 style={{ color: '#102a43', fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', margin: 0 }}>FOMU YA KUWEKA REHANI MALI (CHATTEL FORM)</h3>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '5px' }}>Tafadhali orodhesha mali unazoweka kama dhamana hapa chini</p>
                      </div>

                      <div className="grid-field" style={{ marginBottom: '20px' }}>
                        <strong>Aina ya Dhamana (Vifaa vya Biashara/Nyumbani/Stock/Gari)</strong>
                        <input
                          type="text"
                          name="chattelAinaYaDhamana"
                          placeholder="Mfano: Gari na Vifaa vya Ndani"
                          value={form.chattelAinaYaDhamana}
                          onChange={handleChange}
                        />
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                          <thead style={{ background: '#102a43', color: 'white' }}>
                            <tr>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>S/N</th>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>JINA LA MALI</th>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>MAELEZO YA MALI</th>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>THAMANI SOKO KWA SASA(TZS)</th>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>THAMANI DHAMANA (70%)</th>
                              <th style={{ padding: '10px', fontSize: '0.75rem', border: '1px solid #102a43' }}>Ondoa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.chattelItems.map((item, idx) => (
                              <tr key={item.id}>
                                <td style={{ textAlign: 'center', padding: '5px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>
                                  <input type="text" value={item.jina} onChange={(e) => handleChattelChange(item.id, "jina", e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', width: '100%' }} placeholder="Jina la mali" />
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>
                                  <input type="text" value={item.maelezo} onChange={(e) => handleChattelChange(item.id, "maelezo", e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', width: '100%' }} placeholder="Mfano: Inatumika tangu 2022" />
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>
                                  <input type="text" value={item.thamaniSoko ? formatMoney(Number(item.thamaniSoko)) : ""} onChange={(e) => handleChattelChange(item.id, "thamaniSoko", e.target.value)} style={{ margin: 0, border: 'none', background: 'transparent', fontWeight: 'bold', width: '100%' }} placeholder="Tsh 0" />
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', background: '#f0fdf4' }}>
                                  <input type="text" readOnly value={item.thamaniDhamana ? formatMoney(Number(item.thamaniDhamana)) : ""} style={{ margin: 0, border: 'none', background: 'transparent', fontWeight: 'bold', color: '#16a34a', width: '100%' }} />
                                </td>
                                <td style={{ textAlign: 'center', padding: '5px', border: '1px solid #cbd5e1' }}>
                                  <button type="button" onClick={() => handleRemoveChattelItem(item.id)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                        <button type="button" onClick={handleAddChattelItem} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>+ ONGEZA MSTARI MWINGINE</button>
                      </div>

                      {/* Live collateral-cover check: total THAMANI DHAMANA (70%) vs requested loan */}
                      {(() => {
                        const cs = collateralStatus();
                        if (cs.loanAmount <= 0 || !cs.hasChattel) return null;
                        return cs.chattelCovers ? (
                          <div style={{ marginBottom: '25px', padding: '12px 16px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✓ Jumla ya THAMANI DHAMANA (70%) (TZS {formatMoney(cs.totalChattel)}) inazidi kiasi cha mkopo (TZS {formatMoney(cs.loanAmount)}). Dhamana inatosha.
                          </div>
                        ) : (
                          <div style={{ marginBottom: '25px', padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700 }}>
                            ⚠ Jumla ya THAMANI DHAMANA (70%) (TZS {formatMoney(cs.totalChattel)}) HAITOSHI. Lazima izidi kiasi cha mkopo (TZS {formatMoney(cs.loanAmount)}). Tafadhali ongeza thamani ya mali.
                          </div>
                        );
                      })()}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        <div className="grid-field">
                          <strong>Jina la mmiliki wa mali</strong>
                          <input type="text" name="chattelOwnerName" value={form.chattelOwnerName} onChange={handleChange} placeholder="Jina kamili la mmiliki" />
                          <label className="checkbox-label" style={{ marginTop: '10px' }}>
                            <input type="checkbox" name="chattelOwnerSigned" checked={form.chattelOwnerSigned} onChange={handleChange} /> Sahihi ya Mmiliki
                          </label>
                        </div>
                        <div className="grid-field">
                          <strong>Jina la mume/mke wa mmiliki</strong>
                          <input type="text" name="chattelSpouseName" value={form.chattelSpouseName} onChange={handleChange} placeholder="Jina la mume au mke" />
                        </div>
                        <div className="grid-field">
                          <strong>Shahidi (Jina na Uhusiano)</strong>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" name="chattelWitnessName" value={form.chattelWitnessName} onChange={handleChange} placeholder="Jina" style={{ flex: 2 }} />
                            <input type="text" name="chattelWitnessRelationship" value={form.chattelWitnessRelationship} onChange={handleChange} placeholder="Uhusiano" style={{ flex: 1 }} />
                          </div>
                        </div>
                        <div className="grid-field">
                          <strong>Afisa Mikopo (Jina na Tarehe)</strong>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" name="chattelOfficerName" value={form.chattelOfficerName} onChange={handleChange} placeholder="Jina la Afisa" style={{ flex: 2 }} />
                            <input type="date" name="chattelOfficerDate" value={form.chattelOfficerDate} onChange={handleChange} style={{ flex: 1.5 }} />
                          </div>
                        </div>
                      </div>

                      {/* Signature confirmations in one row */}
                      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', marginTop: '16px', padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, fontSize: '0.75rem', fontWeight: '600', color: '#166534', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" name="chattelSpouseSigned" checked={form.chattelSpouseSigned} onChange={handleChange} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }} /> Je, Mke/Mume amesaini?
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, fontSize: '0.75rem', fontWeight: '600', color: '#166534', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" name="chattelWitnessSigned" checked={form.chattelWitnessSigned} onChange={handleChange} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }} /> Je, Shahidi amesaini?
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, fontSize: '0.75rem', fontWeight: '600', color: '#166534', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" name="chattelOfficerSigned" checked={form.chattelOfficerSigned} onChange={handleChange} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }} /> Je, Afisa amesaini?
                        </label>
                      </div>

                      <div style={{ marginTop: '30px', padding: '20px', background: '#f1f5f9', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                          <strong style={{ fontSize: '0.9rem', color: '#1e293b', textTransform: 'uppercase' }}>USHAHIDI WA SERIKALI YA MTAA</strong>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#444', marginBottom: '20px', textAlign: 'center' }}>
                          Nimejiridhisha kuwa maelezo yaliyoainishwa ni sahihi na fomu hii inakubaliwa rasmi kwa ajili ya kumbukumbu.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                          <div className="grid-field" style={{ flex: '2 1 180px', margin: 0 }}>
                            <strong>Jina la Mwenyekiti</strong>
                            <input type="text" name="chattelChairmanName" value={form.chattelChairmanName} onChange={handleChange} placeholder="Mfano: Mwenyekiti wa Mtaa" style={{ marginBottom: 0 }} />
                          </div>
                          <div className="grid-field" style={{ flex: '1 1 130px', margin: 0 }}>
                            <strong>Tarehe</strong>
                            <input type="date" name="chattelChairmanDate" value={form.chattelChairmanDate} onChange={handleChange} style={{ marginBottom: 0 }} />
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: '1 1 auto', fontSize: '0.75rem', fontWeight: '600', color: '#1e293b', cursor: 'pointer', background: '#fff', padding: '8px 14px', borderRadius: '30px', whiteSpace: 'nowrap', border: '1px solid #e2e8f0' }}>
                            <input type="checkbox" name="chattelChairmanSigned" checked={form.chattelChairmanSigned} onChange={handleChange} style={{ width: '17px', height: '17px', accentColor: '#102a43', cursor: 'pointer', flexShrink: 0 }} /> Sahihi ya Mwenyekiti
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: '1 1 auto', fontSize: '0.75rem', fontWeight: '600', color: '#1e293b', cursor: 'pointer', background: '#fff', padding: '8px 14px', borderRadius: '30px', whiteSpace: 'nowrap', border: '1px solid #e2e8f0' }}>
                            <input type="checkbox" name="chattelChairmanStamp" checked={form.chattelChairmanStamp} onChange={handleChange} style={{ width: '17px', height: '17px', accentColor: '#102a43', cursor: 'pointer', flexShrink: 0 }} /> Muhuri wa Serikali ya Mtaa
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: DHAMANA NA WADHAMINI */}
            {currentStep === 3 && (
              <div className="form-section">
                {/* SEHEMU 7: WADHAMINI */}
                <div style={{ marginTop: '40px' }}>

                  {/* MDHAMINI 1 */}
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>MDHAMINI WA KWANZA</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '20px'
                    }}>
                      <div className="grid-field">
                        <strong>Jina kamili</strong>
                        <input type="text" name="wdhamini1JinaKamili" placeholder="Jina la Mdhamini wa kwanza" className={errors.wdhamini1JinaKamili ? "input-error" : ""} value={form.wdhamini1JinaKamili} onChange={handleChange} />
                        {errors.wdhamini1JinaKamili && <span className="error-text">{errors.wdhamini1JinaKamili}</span>}
                      </div>
                      <div className="grid-field">
                        <strong>Mahali Anapoishi</strong>
                        <input type="text" name="wdhamini1MahaliAnapoishi" placeholder="Mfano: Kimara, Dar es Salaam" value={form.wdhamini1MahaliAnapoishi} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Amepanga / Kwake</strong>
                        <select name="wdhamini1AmepangaKwake" value={form.wdhamini1AmepangaKwake} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option>Amepanga</option>
                          <option>Kwake</option>
                        </select>
                      </div>
                      <div className="grid-field">
                        <strong>Kazi anayofanya</strong>
                        <input type="text" name="wdhamini1KaziAnayofanya" placeholder="Mfano: Mwalimu" value={form.wdhamini1KaziAnayofanya} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Uhusiano wenu</strong>
                        <input type="text" name="wdhamini1UhusianoWenu" placeholder="Mfano: Kaka / Rafiki" value={form.wdhamini1UhusianoWenu} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Namba ya simu</strong>
                        <input type="tel" name="wdhamini1Simu" placeholder="Mfano: 07XXXXXXXX" className={errors.wdhamini1Simu ? "input-error" : ""} value={form.wdhamini1Simu} onChange={handleChange} />
                        {errors.wdhamini1Simu && <span className="error-text">{errors.wdhamini1Simu}</span>}
                      </div>
                    </div>
                  </div>

                  {/* MDHAMINI 2 */}
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>MDHAMINI WA PILI</div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '20px'
                    }}>
                      <div className="grid-field">
                        <strong>Jina kamili</strong>
                        <input type="text" name="wdhamini2JinaKamili" placeholder="Jina la Mdhamini wa pili" className={errors.wdhamini2JinaKamili ? "input-error" : ""} value={form.wdhamini2JinaKamili} onChange={handleChange} />
                        {errors.wdhamini2JinaKamili && <span className="error-text">{errors.wdhamini2JinaKamili}</span>}
                      </div>
                      <div className="grid-field">
                        <strong>Mahali Anapoishi</strong>
                        <input type="text" name="wdhamini2MahaliAnapoishi" placeholder="Mfano: Mbezi, Dar es Salaam" value={form.wdhamini2MahaliAnapoishi} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Amepanga / Kwake</strong>
                        <select name="wdhamini2AmepangaKwake" value={form.wdhamini2AmepangaKwake} onChange={handleChange}>
                          <option value="">Chagua</option>
                          <option>Amepanga</option>
                          <option>Kwake</option>
                        </select>
                      </div>
                      <div className="grid-field">
                        <strong>Kazi anayofanya</strong>
                        <input type="text" name="wdhamini2KaziAnayofanya" placeholder="Mfano: Mfanyabiashara" value={form.wdhamini2KaziAnayofanya} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Uhusiano wenu</strong>
                        <input type="text" name="wdhamini2UhusianoWenu" placeholder="Mfano: Baba / Mdogo wangu" value={form.wdhamini2UhusianoWenu} onChange={handleChange} />
                      </div>
                      <div className="grid-field">
                        <strong>Namba ya simu</strong>
                        <input type="tel" name="wdhamini2Simu" placeholder="Mfano: 07XXXXXXXX" className={errors.wdhamini2Simu ? "input-error" : ""} value={form.wdhamini2Simu} onChange={handleChange} />
                        {errors.wdhamini2Simu && <span className="error-text">{errors.wdhamini2Simu}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: TAMKO NA WASILISHA */}
            {currentStep === 4 && (
              <div className="form-section">
                <div className="section-divider">TAMKO NA PASSPORT</div>

                <div className="tamko-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  {/* Triple Photo Upload Row */}
                  <div className="tamko-card" style={{ borderLeftColor: '#10b981', padding: '12px' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '8px' }}><strong>PAKIA PICHA YA MUOMBAJI</strong></p>
                    <div className="passport-upload" style={{ flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                      <div className="passport-preview" style={{ width: '220px', height: '140px', margin: '0 auto' }}>
                        {form.passportPhotoUrl ? (
                          <img src={getPhotoUrl(form.passportPhotoUrl)} alt="Passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : passportPhoto ? (
                          <img src={URL.createObjectURL(passportPhoto)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="preview-placeholder">View Photo</div>
                        )}
                      </div>
                      <label className="upload-btn" style={{ width: '100%', textAlign: 'center', padding: '6px' }}>
                        {form.passportPhotoUrl || passportPhoto ? 'BADILISHA PICHA' : 'CHAGUA PICHA'}
                        <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoSelect(e, 'passport')} onClick={(e) => (e.target as any).value = null} />
                      </label>
                    </div>
                  </div>

                  <div className="tamko-card" style={{ borderLeftColor: '#f59e0b', padding: '12px' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '8px' }}><strong>PICHA YA MDHAMINI 1</strong></p>
                    <div className="passport-upload" style={{ flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                      <div className="passport-preview" style={{ width: '220px', height: '140px', margin: '0 auto' }}>
                        {form.guarantor1PhotoUrl ? (
                          <img src={getPhotoUrl(form.guarantor1PhotoUrl)} alt="Guarantor 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : guarantor1Photo ? (
                          <img src={URL.createObjectURL(guarantor1Photo)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="preview-placeholder">View Photo</div>
                        )}
                      </div>
                      <label className="upload-btn" style={{ width: '100%', textAlign: 'center', padding: '6px', backgroundColor: '#f59e0b' }}>
                        {form.guarantor1PhotoUrl || guarantor1Photo ? 'BADILISHA PICHA' : 'CHAGUA PICHA'}
                        <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoSelect(e, 'guarantor1')} onClick={(e) => (e.target as any).value = null} />
                      </label>
                    </div>
                  </div>

                  <div className="tamko-card" style={{ borderLeftColor: '#f59e0b', padding: '12px' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '8px' }}><strong>PICHA YA MDHAMINI 2</strong></p>
                    <div className="passport-upload" style={{ flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                      <div className="passport-preview" style={{ width: '220px', height: '140px', margin: '0 auto' }}>
                        {form.guarantor2PhotoUrl ? (
                          <img src={getPhotoUrl(form.guarantor2PhotoUrl)} alt="Guarantor 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : guarantor2Photo ? (
                          <img src={URL.createObjectURL(guarantor2Photo)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="preview-placeholder">View Photo</div>
                        )}
                      </div>
                      <label className="upload-btn" style={{ width: '100%', textAlign: 'center', padding: '6px', backgroundColor: '#f59e0b' }}>
                        {form.guarantor2PhotoUrl || guarantor2Photo ? 'BADILISHA PICHA' : 'CHAGUA PICHA'}
                        <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoSelect(e, 'guarantor2')} onClick={(e) => (e.target as any).value = null} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="tamko-content" style={{ marginTop: '20px' }}>

                  <div className="tamko-card" style={{ borderLeft: '5px solid #3b82f6' }}>
                    <p style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>TAMKO LA MWOMBAJI</strong>
                      <span style={{ marginLeft: '10px', color: '#3b82f6', fontWeight: 'bold' }}>({form.jinaKamiliLaMwombaji || "...................................................."})</span>
                    </p>
                    <p style={{ lineHeight: '1.8', color: '#334155', fontSize: '0.95rem', textAlign: 'justify' }}>
                      Mimi <strong style={{ color: '#3b82f6' }}>{form.jinaKamiliLaMwombaji || "...................................................."}</strong> nimeomba mkopo wa
                      <strong style={{ margin: '0 5px', color: '#3b82f6' }}>{form.kiasiMkopo ? formatMoney(Number(form.kiasiMkopo)) : "Tsh 0"}</strong>
                      kutoka <strong style={{ color: '#102a43', fontWeight: '800' }}>Orethan Microfinance</strong>. Nakiri kwamba taarifa zote nilizozitoa hapo juu ni sahihi kadiri ya ufahamu wangu.
                      Nakubali kutembelewa na Afisa mikopo sehemu ya biashara yangu na nyumbani kwangu na kupata taarifa muhimu kutoka kwa watu wengine
                      kwa ajili ya uhakiki wa taarifa zangu.
                      <br /><br />
                      Pia Kwa kujaza fomu hii natoa ridhaa kwa mkopeshaji kutoa taarifa zangu kwenye Taasisi za Kuchakata Taarifa za Wakopaji (CRB)
                      na wadau wengine kama ilivyoanishwa kwenye sheria na miongozo inayotolewa na Benki Kuu Ya Tanzania pamoja na Tume ya Ulinzi wa Taarifa Binafsi.
                    </p>
                    <div className="tamko-checkbox-group">
                      <label className="checkbox-label"><input type="checkbox" name="mwombajiAmesainiFomuNgumu" checked={form.mwombajiAmesainiFomuNgumu} onChange={handleChange} /> Mwombaji amesaini fomu ngumu?</label>
                      <label className="checkbox-label"><input type="checkbox" name="mwombajiAmewekaDoleGumba" checked={form.mwombajiAmewekaDoleGumba} onChange={handleChange} /> Mwombaji ameweka dole gumba?</label>
                      <label className="checkbox-label" style={{ background: '#eff6ff', borderColor: '#3b82f6', fontWeight: 'bold' }}><input type="checkbox" name="tamkoLaMwombaji" checked={form.tamkoLaMwombaji} onChange={handleChange} /> Nimeisoma na nakubaliana na vigezo vyote</label>
                    </div>
                  </div>

                  <div className="guarantor-declaration-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                    marginTop: '20px'
                  }}>
                    <div className="tamko-card" style={{ borderLeft: '5px solid #10b981' }}>
                      <p style={{ marginBottom: '15px' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>TAMKO LA MDHAMINI 1</strong>
                        <span style={{ marginLeft: '10px', color: '#10b981', fontWeight: 'bold' }}>({form.wdhamini1JinaKamili || "...................."})</span>
                      </p>
                      <div className="tamko-checkbox-group">
                        <label className="checkbox-label"><input type="checkbox" name="mdhamini1AmesainiFomuNgumu" checked={form.mdhamini1AmesainiFomuNgumu} onChange={handleChange} /> Mdhamini 1 amesaini?</label>
                        <label className="checkbox-label"><input type="checkbox" name="mdhamini1AmewekaDoleGumba" checked={form.mdhamini1AmewekaDoleGumba} onChange={handleChange} /> Mdhamini 1 dole gumba?</label>
                        <label className="checkbox-label" style={{ background: '#ecfdf5', borderColor: '#10b981' }}><input type="checkbox" name="tamkoMdhamini1" checked={form.tamkoMdhamini1} onChange={handleChange} /> Nakubali udhamini huu</label>
                      </div>
                    </div>
                    <div className="tamko-card" style={{ borderLeft: '5px solid #10b981' }}>
                      <p style={{ marginBottom: '15px' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>TAMKO LA MDHAMINI 2</strong>
                        <span style={{ marginLeft: '10px', color: '#10b981', fontWeight: 'bold' }}>({form.wdhamini2JinaKamili || "...................."})</span>
                      </p>
                      <div className="tamko-checkbox-group">
                        <label className="checkbox-label"><input type="checkbox" name="mdhamini2AmesainiFomuNgumu" checked={form.mdhamini2AmesainiFomuNgumu} onChange={handleChange} /> Mdhamini 2 amesaini?</label>
                        <label className="checkbox-label"><input type="checkbox" name="mdhamini2AmewekaDoleGumba" checked={form.mdhamini2AmewekaDoleGumba} onChange={handleChange} /> Mdhamini 2 dole gumba?</label>
                        <label className="checkbox-label" style={{ background: '#ecfdf5', borderColor: '#10b981' }}><input type="checkbox" name="tamkoMdhamini2" checked={form.tamkoMdhamini2} onChange={handleChange} /> Nakubali udhamini huu</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="form-section">
                <div className="section-divider">ORODHA YA UHAKIKI WA NYARAKA (DOCUMENTATION CHECKLIST)</div>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 18px' }}>
                  Hakiki nyaraka zote kabla ya kuwasilisha ombi kwa Meneja wa Mikopo. Vipengele vilivyojazwa tayari vimethibitishwa moja kwa moja; kwa nyaraka zinazokosekana tumia kitufe cha <strong>“Proceed without”</strong>.
                </p>
                <LoanChecklist
                  category={form.umeajiriwa === 'Ndio' ? 'employee' : 'business'}
                  verified={{
                    id_doc: !!(form.nambaYaKitambulisho || (form as any).nambaYaNida),
                    passport_photo: !!form.passportPhotoUrl,
                    proof_residence: !!(form.mahaliUnapoishiMtaa || form.mahaliUnapoishiKata),
                    guarantor_id: !!form.wdhamini1JinaKamili,
                    guarantor_residence: !!form.wdhamini1MahaliAnapoishi,
                    guarantor_photos: !!(form.guarantor1PhotoUrl || form.guarantor2PhotoUrl),
                    application_form: true,
                    two_guarantors_signed: !!(form.tamkoMdhamini1 && form.tamkoMdhamini2),
                    loan_agreement: !!form.mwombajiAmesainiFomuNgumu,
                    credit_consent: !!form.tamkoLaMwombaji,
                    terms_ack: !!form.tamkoLaMwombaji,
                  }}
                  onChange={(r) => { setChecklistResolved(r.allResolved); setChecklistState(r.state); }}
                />
              </div>
            )}

            {currentStep === 6 && (
              <div className="form-section">
                <CollateralDirectory
                  clientName={form.jinaKamiliLaMwombaji}
                  photos={form.collateralPhotos}
                  onChange={(photos) => setForm({ ...form, collateralPhotos: photos })}
                  chattelOptions={form.chattelItems
                    .filter((item) => item.jina)
                    .map((item) => ({ jina: item.jina, thamaniSoko: item.thamaniSoko, thamaniDhamana: item.thamaniDhamana }))}
                />
              </div>
            )}
          </div>

          <div className="nav-buttons">
            {currentStep > 0 && (
              <button type="button" className="btn-prev" onClick={prevStep}>◄ NYUMA</button>
            )}
            {currentStep < steps.length - 1 ? (
              <button type="button" className="btn-next" onClick={(e) => nextStep(e)}>ENDELEA ►</button>
            ) : (
              <button type="submit" className="btn-submit" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
                {loading ? "INAWASILISHA..." : "WASILISHA OMBI"}
              </button>
            )}
          </div>
        </form>
      </div>

      <style>{`
        .page-container {
          background: #e8f0fe;
          padding: 16px;
          margin-top: -24px;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          font-family: 'Inter', sans-serif;
        }
        .form-container {
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .form-portal-content { display: flex; align-items: center; gap: 24px; }
        .fomu-no { font-size: 14px; font-weight: 600; color: #0f172a; display: flex; align-items: center; }
        .fomu-no-input { width: 120px; padding: 6px 10px; margin-left: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .step-indicators { display: flex; gap: 10px; }
        .step-btn {
          width: 34px; height: 34px; border-radius: 50%; border: 2px solid #e2e8f0;
          background: white; color: #64748b; cursor: pointer; font-weight: 700;
          display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .step-btn.completed { background: #10b981; color: white; border-color: #10b981; }
        .step-btn.active { background: #102a43; color: white; border-color: #102a43; transform: scale(1.1); box-shadow: 0 4px 10px rgba(16, 42, 67, 0.2); }
        
        .step-title { background: #f8fafc; padding: 12px 24px; font-weight: 800; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
        .form-scroll { padding: 20px 30px; max-height: calc(100vh - 280px); overflow-y: auto; }
        
        .section-divider {
          background: #102a43; color: white; padding: 8px 16px; border-radius: 6px;
          font-weight: 700; font-size: 13px; margin-bottom: 15px; margin-top: 5px;
        }
        .form-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .form-table td { border: 1px solid #e2e8f0; padding: 8px 12px; vertical-align: top; }
        .form-table strong { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* Unified Input Styling (inherits from index.css) */
        .form-container input, .form-container select, .form-container textarea {
          width: 100%; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px;
          font-size: 13px; margin-top: 4px; transition: all 0.2s;
        }
        
        .grid-field { display: flex; flex-direction: column; }
        .grid-field strong { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        
        .history-table th { background: #f1f5f9; padding: 8px; font-size: 10px; text-align: left; color: #64748b; text-transform: uppercase; }
        .tamko-card { background: #fff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; border-left: 5px solid #3b82f6; }
        .tamko-checkbox-group { display: flex; flexDirection: column; gap: 8px; margin-top: 12px; }
        
        /* Guarantor Card Styling */
        .guarantor-card { border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background: #f8fafc; transition: all 0.2s; }
        .guarantor-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .guarantor-card label { display: block; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; }
        .guarantor-card p { font-size: 14px; font-weight: 800; color: #102a43; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        
        .passport-upload { display: flex; gap: 20px; align-items: center; margin-top: 10px; }
        .passport-preview { width: 100px; height: 120px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .passport-preview img { width: 100%; height: 100%; object-fit: cover; }
        .upload-btn { background: #102a43; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }

        .nav-buttons { padding: 15px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 20px; }
        .btn-prev { flex: 1; padding: 12px; background: #94a3b8; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-next { flex: 1; padding: 12px; background: #102a43; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-submit { flex: 1; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-prev:hover, .btn-next:hover, .btn-submit:hover { opacity: 0.9; transform: translateY(-1px); }
        
        @media (max-width: 800px) {
          .nav-buttons { flex-direction: column; }
          .tamko-content > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <AlertModal
        isOpen={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => {
          setShowModal(false);
          if (alertOnAck) {
            alertOnAck();
            setAlertOnAck(null);
          }
        }}
      />
    </div >
  );
}

export default PersonalLoan;