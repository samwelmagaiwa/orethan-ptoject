import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import AlertModal from "../components/AlertModal";
import LoanChecklist from "../components/LoanChecklist";
import CollateralDirectory, { type CollateralPhoto } from "../components/CollateralDirectory";

const GroupLoan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isInitialized = useRef(false);
  const DRAFT_TYPE = 'group';
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

  const [form, setForm] = useState({
    fomuNo: "",
    jinaKamiliLaMwombaji: "",
    jinsia: "",
    jinaMaarufu: "",
    ainaYaKitambulisho: "",
    nambaYaKitambulisho: "",
    tareheYaKuzaliwa: "",
    simu: "",
    haliYaNdoa: "",
    eneoUnaioishi: "",
    umeishiHapoTanguLini: "",
    umilikiWaMakazi: "",
    jinaKamiliLaMumeMke: "",
    maarufuMtaani: "",
    tareheYaKuzaliwaMumeMke: "",
    idadiYaUtegemezi: "",
    simuYaMumeMke: "",

    // SEHEMU 2: TAARIFA ZA KIKUNDI
    jinaLaMwenyekiti: "",
    jinaLaKatibu: "",
    anuaniYaMakaziYaKikundi: "",
    nambaYaUsajiliWaKikundi: "",
    mkoa: "",
    wilaya: "",
    kata: "",
    kijijiMtaa: "",
    idadiYaWanachamaMe: "",
    idadiYaWanachamaKe: "",
    mudaKikundiKimekaaKatikaAnuaniHii: "",
    tareheYaUsajiri: "",
    simu1: "",
    simu2: "",
    jinaLaMradi: "",
    ainaYaMradi: "",
    mahaliMradiUpoMkoa: "",
    mahaliMradiUpoKata: "",
    mahaliMradiUpoWilaya: "",
    wastaniWaKipatoKwaMwezi: "",
    wastaniWaMatumiziKwaMwezi: "",
    mradiUmeanzaLini: "",
    kiasiChaMkopo: "",
    mudaWaLipaMkopo: "",
    kiasiGaniChaRejesho: "",
    malengoYaMkopo: "",
    kiasiKikundiKinadaiwa: "",
    kikundiKimewahiKukopa: "",
    chanzoChaMapato: "",
    mdhamini1JinaKamili: "",
    mdhamini1MahaliAnapoishi: "",
    mdhamini1NambaYaNyumba: "",
    mdhamini1AmepangaKwake: "",
    mdhamini1KaziAnayofanya: "",
    mdhamini1MahaliIlipoOfisi: "",
    mdhamini1JinaLaKampuni: "",
    mdhamini1Simu: "",

    // SEHEMU 4B: MDHAMINI NO. 2 (MME, MKE AU NDUGU)
    mdhamini2Uhusiano: "",
    mdhamini2JinaKamili: "",
    mdhamini2MahaliAnapoishi: "",
    mdhamini2NambaYaNyumba: "",
    mdhamini2AmepangaKwake: "",
    mdhamini2KaziAnayofanya: "",
    mdhamini2MahaliIlipoOfisi: "",
    mdhamini2JinaLaKampuni: "",
    mdhamini2Simu: "",

    // SEHEMU 6: TAARIFA ZA DHAMANA (repeatable — ONGEZA DHAMANA)
    dhamanaList: [{ aina: "", namba: "", umiliki: "", thamaniYaDhamana: "", thamaniYaSasa: "", umri: "", mmilikiWamiliki: "", muonekano: "", mahaliIlipo: "" }] as { aina: string; namba: string; umiliki: string; thamaniYaDhamana: string; thamaniYaSasa: string; umri: string; mmilikiWamiliki: string; muonekano: string; mahaliIlipo: string }[],
    tamkoLaMwombaji: false,
    mwombajiAmesainiFomuNgumu: false,
    mwombajiAmewekaDoleGumba: false,

    tamkoLaMdhaminiUhusiano: "",
    tamkoLaMdhamini: false,
    mdhaminiAmesainiFomuNgumu: false,
    mdhaminiAmewekaDoleGumba: false,

    tamkoLaMdhaminiWajibika: false,
    kikundiKimesainiFomuNgumu: false,
    kikundiKimewekaDoleGumba: false,

    // Photo URLs for Draft & Edit Persistence
    passportPhotoUrl: "",
    guarantor1PhotoUrl: "",
    guarantor2PhotoUrl: "",

    // Customer Collateral Directory (field photos of collateral items + notes)
    collateralPhotos: [] as CollateralPhoto[],
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
      "wastaniWaKipatoKwaMwezi",
      "wastaniWaMatumiziKwaMwezi",
      "kiasiChaMkopo",
      "kiasiGaniChaRejesho",
      "kiasiKikundiKinadaiwa",
    ];
    return moneyKeys.includes(name) || name.toLowerCase().includes("kiasi") || name.toLowerCase().includes("thamani");
  };

  const showAlert = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
  };

  const cleanNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.-]+/g, ""));
  };

  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [streets, setStreets] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'passport' | 'guarantor1' | 'guarantor2' = 'passport') => {

    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    if (type === 'passport') setPassportPhoto(file);
    else if (type === 'guarantor1') setGuarantor1Photo(file);
    else if (type === 'guarantor2') setGuarantor2Photo(file);

    // Immediate upload for draft persistence
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
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


  // Persistence: Load draft from BACKEND on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

    const loadDraft = async () => {
      // Priority 0: Edit Mode (load a submitted loan)
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
              simu: loan.phone,
              kiasiChaMkopo: loan.amount.toString(),
              passportPhotoUrl: loan.passport_photo || loan.details.passportPhotoUrl || "",
              guarantor1PhotoUrl: loan.guarantor_1_photo || loan.details.guarantor1PhotoUrl || "",
              guarantor2PhotoUrl: loan.guarantor_2_photo || loan.details.guarantor2PhotoUrl || "",
            }));
          }
        } catch (e) {
          console.error("Error fetching loan for edit:", e);
        } finally {
          setLoading(false);
          isInitialized.current = true;
        }
        return; // Skip normal draft loading
      }

      // Priority 1: Check localStorage for calculator return flag (fast path)
      const localStr = localStorage.getItem('group_loan_draft');
      if (localStr) {
        try {
          const parsed = JSON.parse(localStr);
          if (parsed.isReturningFromCalculator) {
            if (token) {
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
            localStorage.removeItem('group_loan_draft');
            isInitialized.current = true;

            // Auto-generate Fomu No if empty
            setForm(prev => {
              if (!prev.fomuNo) {
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                return { ...prev, fomuNo: `GRP-${randomNum}` };
              }
              return prev;
            });
            fetchRegions();
            return;
          }
        } catch { /* ignore bad localStorage */ }
      }

      // Load an existing backend draft (offer to resume)
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
          return { ...prev, fomuNo: `GRP-${randomNum}` };
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
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

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
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
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
      "simu2"
    ];

    if (!value && !optionalFields.includes(name) && !name.startsWith("historia") && !name.includes("Mengine") && !name.includes("Maarufu")) {
      error = "Sehemu hii inahitajika";
    }

    if (name.toLowerCase().includes("simu") && value && !/^\d{10,12}$/.test(value)) {
      error = "Namba ya simu haijakamilika (Mshano: 07XXXXXXXX)";
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

  // Selecting the guarantor's relationship in SEHEMU 4B also fills the
  // "Uhusiano wako na mwombaji" field used in TAMKO LA MDHAMINI (MUME/MKE/NDUGU).
  const handleMdhamini2UhusianoChange = (value: string) => {
    setForm(prev => ({ ...prev, mdhamini2Uhusiano: value, tamkoLaMdhaminiUhusiano: value }));
  };

  const handleAddCollateral = () => {
    setForm(prev => ({
      ...prev,
      dhamanaList: [...prev.dhamanaList, { aina: "", namba: "", umiliki: "", thamaniYaDhamana: "", thamaniYaSasa: "", umri: "", mmilikiWamiliki: "", muonekano: "", mahaliIlipo: "" }]
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
    if (field === "thamaniYaDhamana" || field === "thamaniYaSasa") {
      finalValue = value.replace(/[^0-9]/g, '');
    }
    setForm(prev => {
      const newList = [...prev.dhamanaList];
      newList[index] = { ...newList[index], [field]: finalValue };
      return { ...prev, dhamanaList: newList };
    });
  };

  const fetchRegions = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/locations/regions`);
      setRegions(res.data);
    } catch (e) {
      console.error("Error fetching regions", e);
    }
  };

  const fetchDistricts = async (regionId: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
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
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/locations/wards/${districtId}`);
      setWards(res.data);
      setStreets([]);
    } catch (e) {
      console.error("Error fetching wards", e);
    }
  };

  const fetchStreets = async (wardId: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const res = await axios.get(`${API_BASE}/locations/streets/${wardId}`);
      setStreets(res.data);
    } catch (e) {
      console.error("Error fetching streets", e);
    }
  };

  const steps = [
    "SEHEMU 1: TAARIFA ZA MWOMBAJI",
    "SEHEMU 2: TAARIFA ZA KIKUNDI",
    "SEHEMU 3: TAARIFA ZA MIRADI NA MKOPO",
    "SEHEMU 4: MDHAMINI NA DHAMANA",
    "TAMKO NA PASSPORT",
    "ORODHA YA UHAKIKI WA NYARAKA",
    "DIRECTORI YA DHAMANA"
  ];

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById("navbar-portal"));
  }, []);

  const fieldLabels: Record<string, string> = {
    jinaKamiliLaMwombaji: "Jina kamili la mwombaji",
    jinsia: "Jinsia",
    tareheYaKuzaliwa: "Tarehe ya kuzaliwa",
    simu: "Simu",
    nambaYaKitambulisho: "Namba ya Kitambulisho",
    haliYaNdoa: "Hali ya Ndoa",
    eneoUnaioishi: "Eneo unaioishi",
    jinaLaMwenyekiti: "Jina la Mwenyekiti",
    jinaLaKatibu: "Jina la Katibu",
    anuaniYaMakaziYaKikundi: "Anuani ya Makazi ya kikundi",
    nambaYaUsajiliWaKikundi: "Namba ya usajili wa kikundi",
    mkoa: "Mkoa",
    wilaya: "Wilaya",
    kata: "Kata",
    kijijiMtaa: "Kijiji/mtaa",
    idadiYaWanachamaMe: "Idadi ya wanachama (ME)",
    idadiYaWanachamaKe: "Idadi ya wanachama (KE)",
    jinaLaMradi: "Jina la Mradi",
    ainaYaMradi: "Aina ya Mradi",
    mahaliMradiUpoMkoa: "Mkoa wa Mradi",
    mahaliMradiUpoWilaya: "Wilaya ya Mradi",
    mahaliMradiUpoKata: "Kata ya Mradi",
    wastaniWaKipatoKwaMwezi: "Wastani wa kipato kwa mwezi",
    wastaniWaMatumiziKwaMwezi: "Wastani wa matumizi kwa mwezi",
    kiasiChaMkopo: "Kiasi cha Mkopo",
    mudaWaLipaMkopo: "Muda wa kulipa Mkopo",
    kiasiGaniChaRejesho: "Kiasi cha rejesho",
    mdhamini1JinaKamili: "Jina kamili la Mdhamini (Mwenyekiti)",
    mdhamini1Simu: "Simu ya Mdhamini"
  };

  // Returns the list of missing/invalid field labels for a given wizard step,
  // and records the per-field error state as a side effect so navigating the
  // officer back to that step highlights exactly which fields need attention.
  const getMissingFieldsForStep = (step: number): string[] => {
    const stepFields: Record<number, string[]> = {
      0: ["jinaKamiliLaMwombaji", "jinsia", "tareheYaKuzaliwa", "simu", "nambaYaKitambulisho", "haliYaNdoa", "eneoUnaioishi"],
      1: ["jinaLaMwenyekiti", "jinaLaKatibu", "anuaniYaMakaziYaKikundi", "nambaYaUsajiliWaKikundi", "mkoa", "wilaya", "kata", "kijijiMtaa", "idadiYaWanachamaMe", "idadiYaWanachamaKe"],
      2: ["jinaLaMradi", "ainaYaMradi", "mahaliMradiUpoMkoa", "mahaliMradiUpoWilaya", "mahaliMradiUpoKata", "wastaniWaKipatoKwaMwezi", "wastaniWaMatumiziKwaMwezi", "kiasiChaMkopo", "mudaWaLipaMkopo", "kiasiGaniChaRejesho"],
      3: ["mdhamini1JinaKamili", "mdhamini1Simu"]
    };

    const currentFields = stepFields[step] || [];
    const missingFields: string[] = [];
    currentFields.forEach(field => {
      const error = validateField(field, (form as any)[field]);
      if (error && error !== "Namba ya simu haijakamilika (Mshano: 07XXXXXXXX)") {
        missingFields.push(fieldLabels[field] || field);
      }
    });

    // Step 3: Validate dhamanaList — only critical fields, across all entries
    if (step === 3) {
      form.dhamanaList.forEach((dhamana, index) => {
        if (!dhamana.aina) {
          setErrors(prev => ({ ...prev, [`dhamanaList.${index}.aina`]: "Sehemu hii inahitajika" }));
          if (!missingFields.includes("Aina ya Dhamana")) missingFields.push("Aina ya Dhamana");
        }
        if (!dhamana.thamaniYaSasa) {
          setErrors(prev => ({ ...prev, [`dhamanaList.${index}.thamaniYaSasa`]: "Sehemu hii inahitajika" }));
          if (!missingFields.includes("Thamani ya dhamana")) missingFields.push("Thamani ya dhamana");
        }
      });
    }

    // Step 4: Declarations + passport photo
    if (step === 4) {
      if (!form.tamkoLaMwombaji) missingFields.push("Tamko la Mwombaji");
      if (!form.tamkoLaMdhamini) missingFields.push("Tamko la Mdhamini");
      if (!form.tamkoLaMdhaminiWajibika) missingFields.push("Tamko la Mdhamini Kuwajibika");
      if (!form.passportPhotoUrl) missingFields.push("Picha ya Passport");
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
      showAlert(`Tafadhali jaza sehemu hizi zinazohitajika: ${missingFields.join(", ")}`, "error");
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
        setCurrentStep(step);
        window.scrollTo(0, 0);
        showAlert(`Tafadhali jaza/kamilisha sehemu hizi kwenye "${steps[step]}" kabla ya kuwasilisha:\n• ${missingFields.join("\n• ")}`, "error");
        return;
      }
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
      const successMessage = isEditMode ? "OMBI LA MKOPO WA KIKUNDI LIMEREKEBISHWA KWA MAFANIKIO!" : "OMBI LA MKOPO WA KIKUNDI LIMEWASILISHWA KWA MAFANIKIO!";
      const method = isEditMode ? "put" : "post";
      const url = isEditMode ? `${API_BASE}/loans/${editId}` : `${API_BASE}/loans`;

      const cleanedDhamanaList = form.dhamanaList.map(d => ({
        ...d,
        thamaniYaDhamana: cleanNumber(d.thamaniYaDhamana),
        thamaniYaSasa: cleanNumber(d.thamaniYaSasa),
      }));

      const cleanedCollateralPhotos = form.collateralPhotos.map(photo => ({
        ...photo,
        items: photo.items.filter(item => item.jina)
      }));

      const payload = {
        name: form.jinaKamiliLaMwombaji,
        phone: form.simu,
        amount: cleanNumber(form.kiasiChaMkopo),
        type: "group",
        passport_photo: form.passportPhotoUrl,
        guarantor_1_photo: form.guarantor1PhotoUrl,
        guarantor_2_photo: form.guarantor2PhotoUrl,
        details: {
          ...form,
          documentation_checklist: checklistState,
          passportPhotoUrl: form.passportPhotoUrl,
          guarantor1PhotoUrl: form.guarantor1PhotoUrl,
          guarantor2PhotoUrl: form.guarantor2PhotoUrl,
          dhamanaList: cleanedDhamanaList,
          collateralPhotos: cleanedCollateralPhotos,
        },
      };

      await axios({
        method,
        url,
        data: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      // Clear the saved draft after a successful submission
      if (!isEditMode && token) {
        axios.delete(`${API_BASE}/drafts/${DRAFT_TYPE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => { /* non-blocking */ });
      }

      showAlert(successMessage, "success");
      setTimeout(() => {
        navigate("/my-applications");
      }, 2000);
    } catch (error: any) {
      console.log(error.response?.data || error.message);
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
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📦</div>
            <h3 style={{ color: '#5c4033', marginBottom: '15px', fontSize: '1.5rem' }}>Draft Imepatikana!</h3>
            <p style={{ color: '#8b735b', marginBottom: '25px', lineHeight: '1.6' }}>
              Tumeshaona kuwa ulikuwa umeanza kujaza fomu hii ya kikundi hapo awali. Je, ungependa kuendelea ulikoishia au kuanza upya?
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
        <div className="step-title">{steps[currentStep]}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-scroll">

            {/* SEHEMU 1: TAARIFA ZA MWOMBAJI */}
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
                          <option value="">Chagua</option><option value="Me">Me</option><option value="Ke">Ke</option>
                        </select>
                        {errors.jinsia && <span className="error-text">{errors.jinsia}</span>}
                      </td>
                      <td colSpan={3}><strong>Jina maarufu</strong><br /><input type="text" name="jinaMaarufu" placeholder="Jina la utani" value={form.jinaMaarufu} onChange={handleChange} /></td>
                      <td colSpan={3}><strong>Tarehe ya kuzaliwa</strong><br />
                        <input type="date" name="tareheYaKuzaliwa" className={errors.tareheYaKuzaliwa ? "input-error" : ""} value={form.tareheYaKuzaliwa} onChange={handleChange} />
                        {errors.tareheYaKuzaliwa && <span className="error-text">{errors.tareheYaKuzaliwa}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Aina ya Kitambulisho</strong><br />
                        <select name="ainaYaKitambulisho" className={errors.ainaYaKitambulisho ? "input-error" : ""} value={form.ainaYaKitambulisho} onChange={handleChange}>
                          <option value="">Chagua</option><option>Kitambulisho cha Taifa</option><option>Pasipoti</option><option>Leseni</option>
                        </select>
                        {errors.ainaYaKitambulisho && <span className="error-text">{errors.ainaYaKitambulisho}</span>}
                      </td>
                      <td colSpan={4}><strong>Namba ya Kitambulisho</strong><br />
                        <input type="text" name="nambaYaKitambulisho" placeholder="Namba ya kitambulisho" className={errors.nambaYaKitambulisho ? "input-error" : ""} value={form.nambaYaKitambulisho} onChange={handleChange} />
                        {errors.nambaYaKitambulisho && <span className="error-text">{errors.nambaYaKitambulisho}</span>}
                      </td>
                      <td colSpan={4}><strong>Simu</strong><br />
                        <input type="tel" name="simu" placeholder="Mfano: 07XXXXXXXX" className={errors.simu ? "input-error" : ""} value={form.simu} onChange={handleChange} />
                        {errors.simu && <span className="error-text">{errors.simu}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Hali ya Ndoa</strong><br />
                        <select name="haliYaNdoa" className={errors.haliYaNdoa ? "input-error" : ""} value={form.haliYaNdoa} onChange={handleChange}>
                          <option value="">Chagua</option><option>Hajaoa/Olewa</option><option>Ameoa/Olewa</option><option>Ameachika</option><option>Mjane/Mgane</option>
                        </select>
                        {errors.haliYaNdoa && <span className="error-text">{errors.haliYaNdoa}</span>}
                      </td>
                      <td colSpan={6}><strong>Eneo unaioishi</strong><br /><input type="text" name="eneoUnaioishi" placeholder="Mfano: Sinza, Dar es Salaam" value={form.eneoUnaioishi} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Umeishi hapo tangu lini</strong><br /><input type="text" name="umeishiHapoTanguLini" placeholder="Mfano: Mwaka 2015" value={form.umeishiHapoTanguLini} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Umiliki wa Makazi</strong><br /><select name="umilikiWaMakazi" value={form.umilikiWaMakazi} onChange={handleChange}><option value="">Chagua</option><option>Kwako</option><option>Umepanga</option><option>Mengine (Eleza)</option></select></td>
                      <td colSpan={4}><strong>Idadi ya utegemezi</strong><br /><input type="number" name="idadiYaUtegemezi" placeholder="Mfano: 3" value={form.idadiYaUtegemezi} onChange={handleChange} /></td>
                    </tr>
                    <tr><td colSpan={12} className="sub-header" style={{ background: "#f0f0f0", fontWeight: "bold" }}>TAARIFA ZA MUME/MKE</td></tr>
                    <tr>
                      <td colSpan={4}><strong>Jina kamili la mume/mke</strong><br /><input type="text" name="jinaKamiliLaMumeMke" placeholder="Mfano: Jane Doe" value={form.jinaKamiliLaMumeMke} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Maarufu mtaani</strong><br /><input type="text" name="maarufuMtaani" placeholder="Jina la umaarufu" value={form.maarufuMtaani} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Simu ya mume/mke</strong><br /><input type="tel" name="simuYaMumeMke" placeholder="Mfano: 07XXXXXXXX" value={form.simuYaMumeMke} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={12}><strong>Tarehe ya kuzaliwa (mume/mke)</strong><br /><input type="date" name="tareheYaKuzaliwaMumeMke" value={form.tareheYaKuzaliwaMumeMke} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* SEHEMU 2: TAARIFA ZA KIKUNDI */}
            {currentStep === 1 && (
              <div className="form-section">
                <div className="section-divider">SEHEMU 2: TAARIFA ZA KIKUNDI</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={6}><strong>Jina la Mwenyekiti</strong><br /><input type="text" name="jinaLaMwenyekiti" value={form.jinaLaMwenyekiti} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Jina la Katibu</strong><br /><input type="text" name="jinaLaKatibu" value={form.jinaLaKatibu} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={12}><strong>Anuani ya Makazi ya kikundi</strong><br /><input type="text" name="anuaniYaMakaziYaKikundi" value={form.anuaniYaMakaziYaKikundi} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Namba ya usajili wa kikundi</strong><br /><input type="text" name="nambaYaUsajiliWaKikundi" value={form.nambaYaUsajiliWaKikundi} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Mkoa</strong><br />
                        <select name="mkoa" value={regions.find(r => r.name === form.mkoa)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = regions.find(r => String(r.id) === id)?.name || "";
                          setForm({ ...form, mkoa: name, wilaya: "", kata: "", kijijiMtaa: "" });
                          if (id) fetchDistricts(id);
                        }}>
                          <option value="">Chagua Mkoa</option>
                          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td colSpan={4}><strong>Wilaya</strong><br />
                        <select name="wilaya" value={districts.find(d => d.name === form.wilaya)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = districts.find(d => String(d.id) === id)?.name || "";
                          setForm({ ...form, wilaya: name, kata: "", kijijiMtaa: "" });
                          if (id) fetchWards(id);
                        }}>
                          <option value="">Chagua Wilaya</option>
                          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Kata</strong><br />
                        <select name="kata" value={wards.find(w => w.name === form.kata)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = wards.find(w => String(w.id) === id)?.name || "";
                          setForm({ ...form, kata: name, kijijiMtaa: "" });
                          if (id) fetchStreets(id);
                        }}>
                          <option value="">Chagua Kata</option>
                          {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </td>
                      <td colSpan={4}><strong>Kijiji/mtaa</strong><br />
                        {streets.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <select name="kijijiMtaa" value={form.kijijiMtaa} onChange={handleChange}>
                              <option value="">Chagua Mtaa</option>
                              {streets.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                              <option value="OTHER">HAKIPO KWENYE ORODHA</option>
                            </select>
                            {(form.kijijiMtaa === "OTHER" || (form.kijijiMtaa && !streets.find(s => s.name === form.kijijiMtaa))) && (
                              <input type="text" placeholder="Andika Mtaa hapa..." value={form.kijijiMtaa === "OTHER" ? "" : form.kijijiMtaa} onChange={(e) => setForm({ ...form, kijijiMtaa: e.target.value })} />
                            )}
                          </div>
                        ) : (
                          <input type="text" name="kijijiMtaa" value={form.kijijiMtaa} onChange={handleChange} placeholder="Andika Mtaa..." />
                        )}
                      </td>
                      <td colSpan={2}><strong>IDADI (ME)</strong><br />
                        <input type="number" name="idadiYaWanachamaMe" className={errors.idadiYaWanachamaMe ? "input-error" : ""} value={form.idadiYaWanachamaMe} onChange={handleChange} />
                        {errors.idadiYaWanachamaMe && <span className="error-text">{errors.idadiYaWanachamaMe}</span>}
                      </td>
                      <td colSpan={2}><strong>IDADI (KE)</strong><br />
                        <input type="number" name="idadiYaWanachamaKe" className={errors.idadiYaWanachamaKe ? "input-error" : ""} value={form.idadiYaWanachamaKe} onChange={handleChange} />
                        {errors.idadiYaWanachamaKe && <span className="error-text">{errors.idadiYaWanachamaKe}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Muda kikundi kimekaa katika Anuani hii</strong><br /><input type="text" name="mudaKikundiKimekaaKatikaAnuaniHii" placeholder="Mfano: Miaka 3" value={form.mudaKikundiKimekaaKatikaAnuaniHii} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Tarehe ya usajiri</strong><br /><input type="date" name="tareheYaUsajiri" className={errors.tareheYaUsajiri ? "input-error" : ""} value={form.tareheYaUsajiri} onChange={handleChange} />{errors.tareheYaUsajiri && <span className="error-text">{errors.tareheYaUsajiri}</span>}</td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Simu 1</strong><br /><input type="tel" name="simu1" placeholder="Mfano: 07XXXXXXXX" className={errors.simu1 ? "input-error" : ""} value={form.simu1} onChange={handleChange} />{errors.simu1 && <span className="error-text">{errors.simu1}</span>}</td>
                      <td colSpan={6}><strong>Simu 2</strong><br /><input type="tel" name="simu2" placeholder="Namba ya pili (hiari)" value={form.simu2} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* SEHEMU 3: TAARIFA ZA MIRADI + KIASI CHA MKOPO (merged) */}
            {currentStep === 2 && (
              <div className="form-section">
                <div className="section-divider">SEHEMU 3A: TAARIFA ZA MRADI</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={4}><strong>Jina la Mradi</strong><br /><input type="text" name="jinaLaMradi" placeholder="Mfano: Ufugaji wa kuku" value={form.jinaLaMradi} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Aina ya Mradi</strong><br /><input type="text" name="ainaYaMradi" placeholder="Mfano: Kilimo / Biashara" value={form.ainaYaMradi} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Mkoa wa Mradi</strong><br />
                        <select name="mahaliMradiUpoMkoa" className={errors.mahaliMradiUpoMkoa ? "input-error" : ""} value={regions.find(r => r.name === form.mahaliMradiUpoMkoa)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = regions.find(r => String(r.id) === id)?.name || "";
                          setForm({ ...form, mahaliMradiUpoMkoa: name, mahaliMradiUpoWilaya: "", mahaliMradiUpoKata: "" });
                          if (id) fetchDistricts(id);
                          validateField("mahaliMradiUpoMkoa", name);
                        }}>
                          <option value="">Chagua Mkoa</option>
                          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        {errors.mahaliMradiUpoMkoa && <span className="error-text">{errors.mahaliMradiUpoMkoa}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Wilaya ya Mradi</strong><br />
                        <select name="mahaliMradiUpoWilaya" className={errors.mahaliMradiUpoWilaya ? "input-error" : ""} value={districts.find(d => d.name === form.mahaliMradiUpoWilaya)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = districts.find(d => String(d.id) === id)?.name || "";
                          setForm({ ...form, mahaliMradiUpoWilaya: name, mahaliMradiUpoKata: "" });
                          if (id) fetchWards(id);
                          validateField("mahaliMradiUpoWilaya", name);
                        }}>
                          <option value="">Chagua Wilaya</option>
                          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {errors.mahaliMradiUpoWilaya && <span className="error-text">{errors.mahaliMradiUpoWilaya}</span>}
                      </td>
                      <td colSpan={4}><strong>Kata ya Mradi</strong><br />
                        <select name="mahaliMradiUpoKata" className={errors.mahaliMradiUpoKata ? "input-error" : ""} value={wards.find(w => w.name === form.mahaliMradiUpoKata)?.id || ""} onChange={(e) => {
                          const id = e.target.value;
                          const name = wards.find(w => String(w.id) === id)?.name || "";
                          setForm({ ...form, mahaliMradiUpoKata: name });
                          validateField("mahaliMradiUpoKata", name);
                        }}>
                          <option value="">Chagua Kata</option>
                          {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        {errors.mahaliMradiUpoKata && <span className="error-text">{errors.mahaliMradiUpoKata}</span>}
                      </td>
                      <td colSpan={4}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Wastani wa kipato kwa mwezi (TZS)</strong>
                          <button
                            type="button"
                            onClick={() => navigate('/?fromLoan=true&type=group')}
                            style={{ background: '#102a43', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}
                          >
                            CALCULATOR
                          </button>
                        </div>
                        <input type="text" name="wastaniWaKipatoKwaMwezi" readOnly placeholder="Mfano: 1,500,000" className={errors.wastaniWaKipatoKwaMwezi ? "input-error" : ""} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.wastaniWaKipatoKwaMwezi ? formatMoney(Number(form.wastaniWaKipatoKwaMwezi)) : ""} onChange={handleChange} />
                        <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                        {errors.wastaniWaKipatoKwaMwezi && <span className="error-text">{errors.wastaniWaKipatoKwaMwezi}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Wastani wa matumizi kwa mwezi (TZS)</strong><br />
                        <input type="text" name="wastaniWaMatumiziKwaMwezi" readOnly placeholder="Mfano: 600,000" className={errors.wastaniWaMatumiziKwaMwezi ? "input-error" : ""} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.wastaniWaMatumiziKwaMwezi ? formatMoney(Number(form.wastaniWaMatumiziKwaMwezi)) : ""} onChange={handleChange} />
                        <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                        {errors.wastaniWaMatumiziKwaMwezi && <span className="error-text">{errors.wastaniWaMatumiziKwaMwezi}</span>}
                      </td>
                      <td colSpan={6}><strong>Mradi umeanza lini</strong><br /><input type="text" name="mradiUmeanzaLini" placeholder="Mfano: Januari 2022" value={form.mradiUmeanzaLini} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-divider" style={{ marginTop: "20px" }}>SEHEMU 3B: KIASI CHA MKOPO</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={4}><strong>Kiasi cha Mkopo (TZS)</strong><br />
                        <input type="text" name="kiasiChaMkopo" readOnly placeholder="Mfano: 3,000,000" className={errors.kiasiChaMkopo ? "input-error" : ""} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kiasiChaMkopo ? formatMoney(Number(form.kiasiChaMkopo)) : ""} onChange={handleChange} />
                        <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                        {errors.kiasiChaMkopo && <span className="error-text">{errors.kiasiChaMkopo}</span>}
                      </td>
                      <td colSpan={4}><strong>Muda wa kulipa Mkopo</strong><br />
                        <input type="text" name="mudaWaLipaMkopo" readOnly placeholder="Mfano: Miezi 12" className={errors.mudaWaLipaMkopo ? "input-error" : ""} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.mudaWaLipaMkopo} onChange={handleChange} />
                        <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                        {errors.mudaWaLipaMkopo && <span className="error-text">{errors.mudaWaLipaMkopo}</span>}
                      </td>
                      <td colSpan={4}><strong>Kiasi cha rejesho bila matatizo (TZS)</strong><br />
                        <input type="text" name="kiasiGaniChaRejesho" readOnly placeholder="Mfano: 250,000" className={errors.kiasiGaniChaRejesho ? "input-error" : ""} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} value={form.kiasiGaniChaRejesho ? formatMoney(Number(form.kiasiGaniChaRejesho)) : ""} onChange={handleChange} />
                        <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Tumia Calculator hapo juu</small>
                        {errors.kiasiGaniChaRejesho && <span className="error-text">{errors.kiasiGaniChaRejesho}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Kiasi kikundi kinadaiwa</strong><br /><input type="text" name="kiasiKikundiKinadaiwa" placeholder="0" value={form.kiasiKikundiKinadaiwa ? formatMoney(Number(form.kiasiKikundiKinadaiwa)) : ""} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Kikundi kimewahi kukopa?</strong><br />
                        <select name="kikundiKimewahiKukopa" value={form.kikundiKimewahiKukopa} onChange={handleChange}>
                          <option value="">Chagua</option><option value="NDIYO">NDIYO</option><option value="HAPANA">HAPANA</option>
                        </select>
                      </td>
                      <td colSpan={4}><strong>Chanzo cha mapato</strong><br /><input type="text" name="chanzoChaMapato" placeholder="Mfano: Biashara ya maziwa" value={form.chanzoChaMapato} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={12}><strong>Malengo ya Mkopo</strong><br /><textarea name="malengoYaMkopo" rows={2} placeholder="Eleza malengo ya mkopo huu..." value={form.malengoYaMkopo} onChange={handleChange}></textarea></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* SEHEMU 4: MDHAMINI (MWENYEKITI) + DHAMANA (merged) */}
            {currentStep === 3 && (
              <div className="form-section">
                {/* SEHEMU 4: MDHAMINI (MWENYEKITI) + DHAMANA (merged) */}
                <div className="section-divider">SEHEMU 4A: MDHAMINI (MWENYEKITI)</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={4}><strong>Jina kamili la Mwenyekiti</strong><br />
                        <input type="text" name="mdhamini1JinaKamili" placeholder="Jina la Mwenyekiti" className={errors.mdhamini1JinaKamili ? "input-error" : ""} value={form.mdhamini1JinaKamili} onChange={handleChange} />
                        {errors.mdhamini1JinaKamili && <span className="error-text">{errors.mdhamini1JinaKamili}</span>}
                      </td>
                      <td colSpan={4}><strong>Mahali Anapoishi</strong><br /><input type="text" name="mdhamini1MahaliAnapoishi" placeholder="Mfano: Sinza, Mtaa wa Palestina" value={form.mdhamini1MahaliAnapoishi} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Namba ya nyumba</strong><br /><input type="text" name="mdhamini1NambaYaNyumba" placeholder="Mfano: 123" value={form.mdhamini1NambaYaNyumba} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Amepanga kwake</strong><br />
                        <select name="mdhamini1AmepangaKwake" value={form.mdhamini1AmepangaKwake} onChange={handleChange}>
                          <option value="">Chagua</option><option value="Amepanga">Amepanga</option><option value="Kwake">Kwake</option>
                        </select>
                      </td>
                      <td colSpan={4}><strong>Kazi Anayofanya</strong><br /><input type="text" name="mdhamini1KaziAnayofanya" placeholder="Mfano: Mwalimu / Mfanyabiashara" value={form.mdhamini1KaziAnayofanya} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Simu</strong><br />
                        <input type="tel" name="mdhamini1Simu" placeholder="Mfano: 07XXXXXXXX" className={errors.mdhamini1Simu ? "input-error" : ""} value={form.mdhamini1Simu} onChange={handleChange} />
                        {errors.mdhamini1Simu && <span className="error-text">{errors.mdhamini1Simu}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Mahali ilipo Ofisi</strong><br /><input type="text" name="mdhamini1MahaliIlipoOfisi" placeholder="Mfano: Posta mpya" value={form.mdhamini1MahaliIlipoOfisi} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Jina la kampuni/biashara</strong><br /><input type="text" name="mdhamini1JinaLaKampuni" placeholder="Mfano: Mama Ntilie" value={form.mdhamini1JinaLaKampuni} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-divider" style={{ marginTop: "20px" }}>SEHEMU 4B: MDHAMINI NO. 2 (MME, MKE AU NDUGU)</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td colSpan={12}><strong>Uhusiano na Mwombaji</strong><br />
                        <div className="mdhamini2-uhusiano-radios">
                          {["Mume", "Mke", "Ndugu"].map((opt) => (
                            <label key={opt} className="mdhamini2-uhusiano-radio">
                              <input
                                type="radio"
                                name="mdhamini2Uhusiano"
                                value={opt}
                                checked={form.mdhamini2Uhusiano === opt}
                                onChange={() => handleMdhamini2UhusianoChange(opt)}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Jina kamili la Mdhamini</strong><br />
                        <input type="text" name="mdhamini2JinaKamili" placeholder="Jina la Mdhamini (Mume/Mke/Ndugu)" className={errors.mdhamini2JinaKamili ? "input-error" : ""} value={form.mdhamini2JinaKamili} onChange={handleChange} />
                        {errors.mdhamini2JinaKamili && <span className="error-text">{errors.mdhamini2JinaKamili}</span>}
                      </td>
                      <td colSpan={4}><strong>Mahali Anapoishi</strong><br /><input type="text" name="mdhamini2MahaliAnapoishi" placeholder="Mfano: Sinza, Mtaa wa Palestina" value={form.mdhamini2MahaliAnapoishi} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Namba ya nyumba</strong><br /><input type="text" name="mdhamini2NambaYaNyumba" placeholder="Mfano: 123" value={form.mdhamini2NambaYaNyumba} onChange={handleChange} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4}><strong>Amepanga kwake</strong><br />
                        <select name="mdhamini2AmepangaKwake" value={form.mdhamini2AmepangaKwake} onChange={handleChange}>
                          <option value="">Chagua</option><option value="Amepanga">Amepanga</option><option value="Kwake">Kwake</option>
                        </select>
                      </td>
                      <td colSpan={4}><strong>Kazi Anayofanya</strong><br /><input type="text" name="mdhamini2KaziAnayofanya" placeholder="Mfano: Mwalimu / Mfanyabiashara" value={form.mdhamini2KaziAnayofanya} onChange={handleChange} /></td>
                      <td colSpan={4}><strong>Simu</strong><br />
                        <input type="tel" name="mdhamini2Simu" placeholder="Mfano: 07XXXXXXXX" className={errors.mdhamini2Simu ? "input-error" : ""} value={form.mdhamini2Simu} onChange={handleChange} />
                        {errors.mdhamini2Simu && <span className="error-text">{errors.mdhamini2Simu}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}><strong>Mahali ilipo Ofisi</strong><br /><input type="text" name="mdhamini2MahaliIlipoOfisi" placeholder="Mfano: Posta mpya" value={form.mdhamini2MahaliIlipoOfisi} onChange={handleChange} /></td>
                      <td colSpan={6}><strong>Jina la kampuni/biashara</strong><br /><input type="text" name="mdhamini2JinaLaKampuni" placeholder="Mfano: Mama Ntilie" value={form.mdhamini2JinaLaKampuni} onChange={handleChange} /></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: "20px" }}>
                  <div className="section-divider" style={{ margin: 0 }}>SEHEMU 4C: TAARIFA ZA DHAMANA</div>
                  <button
                    type="button"
                    onClick={handleAddCollateral}
                    style={{ background: '#102a43', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span>+</span> ONGEZA DHAMANA
                  </button>
                </div>

                {form.dhamanaList.map((dhamana, index) => (
                  <div key={index} style={{ position: 'relative', marginTop: '12px' }}>
                    {form.dhamanaList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCollateral(index)}
                        style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 1, background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        ONDOA
                      </button>
                    )}
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 6px', textTransform: 'uppercase' }}>Dhamana Na. {index + 1}</div>
                    <table className="form-table">
                      <tbody>
                        <tr>
                          <td colSpan={4}><strong>Aina ya Dhamana</strong><br />
                            <input type="text" placeholder="Mfano: Pikipiki" className={errors[`dhamanaList.${index}.aina`] ? "input-error" : ""} value={dhamana.aina} onChange={(e) => handleCollateralChange(index, "aina", e.target.value)} />
                            {errors[`dhamanaList.${index}.aina`] && <span className="error-text">{errors[`dhamanaList.${index}.aina`]}</span>}
                          </td>
                          <td colSpan={4}><strong>Namba ya usajili</strong><br /><input type="text" placeholder="Mfano: MC 123 ABC" value={dhamana.namba} onChange={(e) => handleCollateralChange(index, "namba", e.target.value)} /></td>
                          <td colSpan={4}><strong>Thamani ya Dhamana</strong><br /><input type="text" placeholder="Mfano: 2,000,000" value={dhamana.thamaniYaDhamana ? formatMoney(Number(dhamana.thamaniYaDhamana)) : ""} onChange={(e) => handleCollateralChange(index, "thamaniYaDhamana", e.target.value)} /></td>
                        </tr>
                        <tr>
                          <td colSpan={4}><strong>Thamani yake kwa sasa</strong><br />
                            <input type="text" placeholder="Mfano: 1,500,000" className={errors[`dhamanaList.${index}.thamaniYaSasa`] ? "input-error" : ""} value={dhamana.thamaniYaSasa ? formatMoney(Number(dhamana.thamaniYaSasa)) : ""} onChange={(e) => handleCollateralChange(index, "thamaniYaSasa", e.target.value)} />
                            {errors[`dhamanaList.${index}.thamaniYaSasa`] && <span className="error-text">{errors[`dhamanaList.${index}.thamaniYaSasa`]}</span>}
                          </td>
                          <td colSpan={4}><strong>Umri</strong><br /><input type="text" placeholder="Mfano: Miaka 2" value={dhamana.umri} onChange={(e) => handleCollateralChange(index, "umri", e.target.value)} /></td>
                          <td colSpan={4}><strong>Umiliki</strong><br /><input type="text" placeholder="Mfano: Kwangu" value={dhamana.umiliki} onChange={(e) => handleCollateralChange(index, "umiliki", e.target.value)} /></td>
                        </tr>
                        <tr>
                          <td colSpan={4}><strong>Mmiliki/Wamiliki</strong><br /><input type="text" placeholder="Majina ya wamiliki" value={dhamana.mmilikiWamiliki} onChange={(e) => handleCollateralChange(index, "mmilikiWamiliki", e.target.value)} /></td>
                          <td colSpan={4}><strong>Rangi/Muonekano wa Dhamana</strong><br /><input type="text" placeholder="Mfano: Nyeusi, safi" value={dhamana.muonekano} onChange={(e) => handleCollateralChange(index, "muonekano", e.target.value)} /></td>
                          <td colSpan={4}><strong>Mahali Ilipo</strong><br /><input type="text" placeholder="Mfano: Nyumbani" value={dhamana.mahaliIlipo} onChange={(e) => handleCollateralChange(index, "mahaliIlipo", e.target.value)} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* SEHEMU 5: TAMKO NA WASILISHA */}
            {currentStep === 4 && (
              <div className="tamko-container">
                {/* Triple Photo Upload Row — applicant + both guarantors (mirrors personal loan) */}
                <div className="tamko-card">
                  <p style={{ marginBottom: '4px' }}><strong>PAKIA PICHA ZA PASSPORT *</strong></p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px' }}>Picha ya mwombaji na za wadhamini wawili zinahitajika kwa ajili ya utambulisho kwenye mfumo.</p>
                  <div className="group-photo-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                    {[
                      { type: 'passport', url: form.passportPhotoUrl, file: passportPhoto, title: 'PICHA YA MWOMBAJI', color: '#102a43' },
                      { type: 'guarantor1', url: form.guarantor1PhotoUrl, file: guarantor1Photo, title: 'MDHAMINI (MUME/MKE/NDUGU)', color: '#f59e0b' },
                      { type: 'guarantor2', url: form.guarantor2PhotoUrl, file: guarantor2Photo, title: 'MDHAMINI (MWENYEKITI)', color: '#10b981' },
                    ].map((p) => (
                      <div key={p.type} style={{ border: '1px solid #e2e8f0', borderTop: `4px solid ${p.color}`, borderRadius: '8px', padding: '12px', background: '#fff' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px', textAlign: 'center', letterSpacing: '0.3px' }}>{p.title}</p>
                        <div style={{ width: '100%', height: '150px', border: '2px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', marginBottom: '10px' }}>
                          {p.url ? (
                            <img src={getPhotoUrl(p.url)} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : p.file ? (
                            <img src={URL.createObjectURL(p.file)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Hakuna Picha</span>
                          )}
                        </div>
                        <label className="upload-btn" style={{ display: 'block', textAlign: 'center', background: p.color, color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                          {p.url || p.file ? 'Badilisha Picha' : 'Pakia Picha'}
                          <input type="file" hidden accept="image/*" onChange={(e) => handlePhotoSelect(e, p.type as 'passport' | 'guarantor1' | 'guarantor2')} onClick={(e) => (e.target as any).value = null} />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tamko-card">
                  <p><strong>TAMKO LA MWOMBAJI</strong></p>
                  <p>Mimi <strong>{form.jinaKamiliLaMwombaji || "_________________________"}</strong> nimeomba mkopo wa Tsh <strong>{form.kiasiChaMkopo || "______________"}</strong> kutoka Orethan Microfinance. Nakiri kwamba taarifa zote nilizozitoa hapo juu ni sahihi kadiri ya ufahamu wangu.</p>
                  <p>Pia nakubali kutembelewa na Afisa mikopo sehemu ya biashara yangu na nyumbani kwangu na kupata taarifa muhimu kutoka kwa watu wengine kwa ajili ya uhakiki wa taarifa zangu kwa matumizi ya ofisi.</p>
                  <p>Pia Kwa kujaza fomu hii natoa ridhaa kwa mkopeshaji kutoa taarifa zangu kwenye Taasisi za Kuchakata Taarifa za Wakopaji (CRB) na wadau wengine kama ilivyoanishwa kwenye sheria na miongozo inayotolewa na Benki Kuu Ya Tanzania pamoja na Tume ya Ulinzi wa Taarifa Binafsi.</p>

                  <div className="tamko-checkbox-group tamko-checkbox-group--2col">
                    <label className="checkbox-label"><input type="checkbox" name="mwombajiAmesainiFomuNgumu" checked={form.mwombajiAmesainiFomuNgumu} onChange={handleChange} /> Je MWOMBAJI amesaini kwenye fomu ngumu ya mkopo?</label>
                    <label className="checkbox-label"><input type="checkbox" name="mwombajiAmewekaDoleGumba" checked={form.mwombajiAmewekaDoleGumba} onChange={handleChange} /> Je MWOMBAJI ameweka dole gumba kwenye karatasi ngumu ya mkopo?</label>
                  </div>
                </div>

                <div className="tamko-card">
                  <p><strong>TAMKO LA MDHAMINI (MUME/ MKE/ NDUGU)</strong></p>
                  <div className="input-box" style={{ marginBottom: "4px" }}>
                    <input type="text" name="tamkoLaMdhaminiUhusiano" placeholder=" " readOnly value={form.tamkoLaMdhaminiUhusiano} style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.25)' }} />
                    <label>Uhusiano wako na mwombaji</label>
                  </div>
                  <small style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block', marginBottom: '15px' }}>Chagua Uhusiano katika SEHEMU 4B hapo juu</small>
                  <p>Mimi <strong>{form.mdhamini1JinaKamili || "_________________________"}</strong> Uhusiano <strong>{form.tamkoLaMdhaminiUhusiano || "________"}</strong> ninakiri kuwa na taarifa juu ya mkopo wa Tsh <strong>{form.kiasiChaMkopo ? formatMoney(Number(form.kiasiChaMkopo)) : "___________"}</strong> uliyoombwa na <strong>{form.jinaKamiliLaMwombaji || "______________"}</strong> kutoka Orethan Microfinance. Dhamana tajwa hapo juu nazifahamu na nipo tayari zitolewe kama dhamana kwa mujibu wa masharti na taratibu zilizokubaliwa na mkopaji na mkopeshaji.</p>

                  <div className="tamko-checkbox-group tamko-checkbox-group--2col">
                    <label className="checkbox-label"><input type="checkbox" name="mdhaminiAmesainiFomuNgumu" checked={form.mdhaminiAmesainiFomuNgumu} onChange={handleChange} /> Je MDHAMINI amesaini kwenye fomu ngumu ya mkopo?</label>
                    <label className="checkbox-label"><input type="checkbox" name="mdhaminiAmewekaDoleGumba" checked={form.mdhaminiAmewekaDoleGumba} onChange={handleChange} /> Je MDHAMINI ameweka dole gumba kwenye karatasi ngumu ya mkopo?</label>
                  </div>
                </div>

                <div className="tamko-card">
                  <p><strong>TAMKO LA MDHAMINI ( MWENYEKITI)</strong></p>
                  <p>1. Mimi <strong>{form.jinaLaMwenyekiti || "_______________________"}</strong> nakubali kumdhamini <strong>{form.jinaKamiliLaMwombaji || "________________________"}</strong> aliyeomba mkopo wa Tsh <strong>{form.kiasiChaMkopo || "____________"}</strong> kutoka Orethan Microfinance. Nakiri kwamba taarifa zote nilizozitoa hapo juu ni sahihi kadiri ya ufahamu wangu. Pia, ninatambua na kukubali kwamba nitawajibika kulipa mkopo Pamoja na wajumbe wote wa kikundi endapo mkopaji atashindwa kulipa kama ilivyoainishwa kwenye mkataba.</p>

                  <div className="tamko-checkbox-group tamko-checkbox-group--2col">
                    <label className="checkbox-label"><input type="checkbox" name="kikundiKimesainiFomuNgumu" checked={form.kikundiKimesainiFomuNgumu} onChange={handleChange} /> Je MWENYEKITI amesaini kwenye fomu ngumu ya mkopo?</label>
                    <label className="checkbox-label"><input type="checkbox" name="kikundiKimewekaDoleGumba" checked={form.kikundiKimewekaDoleGumba} onChange={handleChange} /> Je MWENYEKITI ameweka dole gumba kwenye karatasi ngumu ya mkopo?</label>
                  </div>
                </div>

              </div>
            )}

            {currentStep === 5 && (
              <div className="tamko-container">
                <div className="tamko-card" style={{ borderLeft: 'none' }}>
                  <p><strong>ORODHA YA UHAKIKI WA NYARAKA (DOCUMENTATION CHECKLIST)</strong></p>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 14px' }}>
                    Hakiki nyaraka zote kabla ya kuwasilisha ombi kwa Meneja wa Mikopo. Vipengele vilivyojazwa tayari vimethibitishwa moja kwa moja; kwa nyaraka zinazokosekana tumia kitufe cha <strong>“Proceed without”</strong>.
                  </p>
                  <LoanChecklist
                    category="group"
                    verified={{
                      id_doc: !!(form.nambaYaKitambulisho || (form as any).nambaYaNida),
                      passport_photo: !!form.passportPhotoUrl,
                      proof_residence: !!form.eneoUnaioishi,
                      guarantor_id: !!(form.mdhamini1JinaKamili || form.jinaLaMwenyekiti),
                      guarantor_residence: !!form.mdhamini1MahaliAnapoishi,
                      guarantor_photos: !!(form.guarantor1PhotoUrl || form.guarantor2PhotoUrl),
                      application_form: true,
                      two_guarantors_signed: !!(form.tamkoLaMdhamini && form.tamkoLaMdhaminiWajibika),
                      loan_agreement: !!(form.kikundiKimesainiFomuNgumu || form.mwombajiAmesainiFomuNgumu),
                      credit_consent: !!form.tamkoLaMwombaji,
                      terms_ack: !!form.tamkoLaMwombaji,
                    }}
                    onChange={(r) => { setChecklistResolved(r.allResolved); setChecklistState(r.state); }}
                  />
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="tamko-container">
                <div className="tamko-card" style={{ borderLeft: 'none' }}>
                  <CollateralDirectory
                    clientName={form.jinaKamiliLaMwombaji}
                    photos={form.collateralPhotos}
                    onChange={(photos) => setForm({ ...form, collateralPhotos: photos })}
                  />
                </div>
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
          margin-top: -24px; /* Pull up to sit flush with the Navbar */
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          font-family: 'Times New Roman', 'Arial', sans-serif;
        }

        .form-table input, .form-table select, .form-table textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #ffffff !important;
          color: #1e293b !important;
          font-size: 14px;
          transition: all 0.2s;
        }
        .form-table input:focus, .form-table select:focus, .form-table textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          outline: none;
        }
        .form-table input::placeholder {
          color: #64748b;
          font-style: italic;
          font-size: 13px;
        }
        .form-container {
          max-width: 1300px;
          width: 100%;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        .form-portal-content {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .fomu-no {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          display: flex;
          align-items: center;
        }

        .fomu-no-input {
          width: 130px;
          padding: 6px 10px;
          margin-left: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #0f172a;
          font-weight: normal;
          outline: none;
        }
        .fomu-no-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .step-indicators {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .step-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #e2e8f0;
          background: white;
          color: #64748b;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-btn.completed { background: #22c55e; color: white; border-color: #22c55e; }
        .step-btn.active { background: #1a3a5c; color: white; border-color: #1a3a5c; box-shadow: 0 0 0 3px rgba(26, 58, 92, 0.2); }

        .step-title {
          background: #e0e0e0;
          padding: 8px 20px;
          font-weight: bold;
          font-size: 14px;
          border-bottom: 2px solid #1a3a5c;
        }

        .form-scroll {
          padding: 20px;
          max-height: calc(100vh - 300px);
          overflow-y: auto;
        }

        .section-divider {
          background: #1a3a5c;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 15px;
          margin-top: 5px;
        }

        .form-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        .form-table td, .form-table th {
          border: 1px solid #ddd;
          padding: 6px;
          vertical-align: top;
          font-size: 13px;
        }
        
        .form-table th {
          background: #f0f0f0;
          font-weight: bold;
          text-align: center;
        }
        
        .form-table input, .form-table select, .form-table textarea {
          width: 100%;
          padding: 5px;
          border: 1px solid #ccc;
          border-radius: 2px;
          font-family: inherit;
          font-size: 12px;
        }
        
        .form-table textarea {
          resize: vertical;
        }
        
        .tamko-section {
          padding: 20px;
        }
        
        .tamko-content p {
          margin-bottom: 12px;
          line-height: 1.5;
          text-align: justify;
          font-size: 12px;
        }
        
        .tamko-line {
          margin: 12px 0;
          padding: 4px;
          border-bottom: 1px dotted #999;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 0;
          cursor: pointer;
          font-size: 13px;
        }
        
        .input-group {
          position: relative;
          margin: 10px 0;
        }
        
        .input-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 13px;
        }
        
        .input-group label {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: white;
          padding: 0 5px;
          color: #666;
          font-size: 12px;
          transition: 0.2s;
          pointer-events: none;
        }
        
        .input-group input:focus ~ label,
        .input-group input:not(:placeholder-shown) ~ label {
          top: -10px;
          font-size: 10px;
          color: #1a3a5c;
        }
        
        .contact-info {
          margin-top: 20px;
          padding: 10px;
          background: #fef3c7;
          border-radius: 8px;
          text-align: center;
          font-size: 11px;
          color: #92400e;
        }
        
        .tamko-container { display: flex; flex-direction: column; gap: 24px; padding: 10px; }
        .tamko-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: all 0.3s ease;
          border-left: 5px solid #2563eb;
          position: relative;
          overflow: hidden;
        }
        .tamko-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 100%);
          pointer-events: none;
        }
        .tamko-card:hover {
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
          transform: translateY(-2px);
          border-left-color: #1d4ed8;
        }
        .tamko-card p {
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .tamko-card strong {
          color: #0f172a;
          font-weight: 700;
          background: rgba(59, 130, 246, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          background: white;
          padding: 14px 18px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          transition: all 0.2s;
          position: relative;
          z-index: 1;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .checkbox-label:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #2563eb;
        }
        
        .tamko-checkbox-group {
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f1f5f9;
          padding: 16px;
          border-radius: 8px;
          border: 1px dashed #cbd5e1;
        }
        .tamko-checkbox-group--2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: start;
        }

        .mdhamini2-uhusiano-radios {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          padding: 6px 0 2px;
        }
        .mdhamini2-uhusiano-radio {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
        }
        .mdhamini2-uhusiano-radio input[type="radio"] {
          width: 16px;
          height: 16px;
          accent-color: #1a3a5c;
          cursor: pointer;
          margin: 0;
        }

        .nav-buttons {
          display: flex;
          gap: 15px;
          padding: 15px 20px;
          background: #ffffff;
          border-top: 2px solid #1a3a5c;
        }
        .btn-prev {
          flex: 1;
          padding: 12px 20px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          font-size: 15px;
          border-radius: 8px;
          background: #6c757d;
          color: white;
        }
        .btn-next {
          flex: 1;
          padding: 12px 20px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          font-size: 15px;
          border-radius: 8px;
          background: #28a745;
          color: white;
        }
        .btn-submit {
          flex: 1;
          padding: 12px 20px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          font-size: 15px;
          border-radius: 8px;
          background: #007bff;
          color: white;
        }
        .btn-prev:hover, .btn-next:hover, .btn-submit:hover { opacity: 0.85; transform: translateY(-2px); }
        button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        
        @media (max-width: 800px) {
          .page-container { padding: 10px; margin-top: -24px; border-radius: 0; }
          .group-photo-row { grid-template-columns: 1fr !important; }
          .tamko-checkbox-group--2col { grid-template-columns: 1fr; }
          .form-portal-content { flex-direction: column; align-items: flex-start; gap: 10px; }
          .form-scroll { padding: 12px; max-height: none; }
          .form-table, .form-table tbody, .form-table tr, .form-table td, .form-table th {
            display: block;
            width: 100%;
          }
          .form-table tr {
            margin-bottom: 12px;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 12px;
          }
          .form-table td {
            border: none;
            padding: 4px 0;
            margin-bottom: 8px;
          }
          .btn-prev, .btn-next, .btn-submit { padding: 8px; font-size: 12px; }
          .nav-buttons { flex-direction: column; gap: 8px; }
        }
      `}</style>
      <AlertModal
        isOpen={showModal}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default GroupLoan;