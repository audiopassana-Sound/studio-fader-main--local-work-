import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface ContactInfo {
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  instagram: string;
  facebook: string;
  x: string;
  youtube: string;
  imdb: string;
  website: string;
  studioAddress: string;
}

export interface CustomLink {
  label: string;
  url: string;
}

export interface HeroContent {
  title: string;
  subtitle: string;
  description: string;
}

export interface ServiceContent {
  title: string;
  description: string;
}

export interface FooterContent {
  copyrightName: string;
}

interface ActiveModules {
  allWorks: boolean;
  studio: boolean;
  pictureEdit: boolean;
  cinematic: boolean;
}

interface SiteContextValue {
  contact: ContactInfo;
  setContact: React.Dispatch<React.SetStateAction<ContactInfo>>;
  updateContactField: <K extends keyof ContactInfo>(key: K, value: ContactInfo[K]) => void;
  customLinks: CustomLink[];
  setCustomLinks: React.Dispatch<React.SetStateAction<CustomLink[]>>;
  activeModules: ActiveModules;
  setActiveModules: React.Dispatch<React.SetStateAction<ActiveModules>>;
  heroContent: HeroContent;
  setHeroContent: React.Dispatch<React.SetStateAction<HeroContent>>;
  servicesContent: ServiceContent[];
  setServicesContent: React.Dispatch<React.SetStateAction<ServiceContent[]>>;
  footerContent: FooterContent;
  setFooterContent: React.Dispatch<React.SetStateAction<FooterContent>>;
  saveSettings: () => void;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);
const SITE_SETTINGS_STORAGE_KEY = "yaniv-site-settings-v1";
const URL_CONTACT_FIELDS: Array<keyof ContactInfo> = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "youtube",
  "imdb",
  "website",
];

const DEFAULT_CONTACT: ContactInfo = {
  email: "contact@yanivpaz.com",
  phone: "",
  whatsapp: "",
  linkedin: "https://linkedin.com/in/yanivpaz",
  instagram: "",
  facebook: "",
  x: "",
  youtube: "",
  imdb: "",
  website: "",
  studioAddress: "",
};

const DEFAULT_ACTIVE_MODULES: ActiveModules = {
  allWorks: true,
  studio: true,
  pictureEdit: true,
  cinematic: true,
};

const DEFAULT_HERO_CONTENT: HeroContent = {
  title: "Sound Design",
  subtitle: "YANIV PAZ",
  description: "Award-winning sound designer crafting immersive audio experiences for film, television, and advertising.",
};

const DEFAULT_SERVICES_CONTENT: ServiceContent[] = [
  { title: "Sound Design", description: "Crafting immersive sonic worlds for film, TV, and advertising." },
  { title: "Mixing & Mastering", description: "Precision mixing and mastering for any format." },
  { title: "Foley & SFX", description: "Custom Foley recording and sound effects creation." },
  { title: "Post Production", description: "Complete audio post-production pipeline." },
];

const DEFAULT_FOOTER_CONTENT: FooterContent = {
  copyrightName: "YANIV PAZ",
};

interface PersistedSiteSettings {
  contact: ContactInfo;
  customLinks: CustomLink[];
  activeModules: ActiveModules;
  heroContent: HeroContent;
  servicesContent: ServiceContent[];
  footerContent: FooterContent;
}

export const ensureHttpsUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizeContactForStorage = (contact: ContactInfo): ContactInfo => {
  const normalized = { ...contact };
  URL_CONTACT_FIELDS.forEach((field) => {
    normalized[field] = ensureHttpsUrl(contact[field]);
  });
  return normalized;
};

const loadPersistedSettings = (): PersistedSiteSettings | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SITE_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSiteSettings>;
    return {
      contact: normalizeContactForStorage({ ...DEFAULT_CONTACT, ...(parsed.contact || {}) }),
      customLinks: Array.isArray(parsed.customLinks) ? parsed.customLinks : [],
      activeModules: { ...DEFAULT_ACTIVE_MODULES, ...(parsed.activeModules || {}) },
      heroContent: { ...DEFAULT_HERO_CONTENT, ...(parsed.heroContent || {}) },
      servicesContent: DEFAULT_SERVICES_CONTENT.map((defaultService, index) => {
        const service = Array.isArray(parsed.servicesContent) ? parsed.servicesContent[index] : undefined;
        return {
          title: service?.title?.trim() || defaultService.title,
          description: service?.description?.trim() || defaultService.description,
        };
      }),
      footerContent: { ...DEFAULT_FOOTER_CONTENT, ...(parsed.footerContent || {}) },
    };
  } catch {
    return null;
  }
};

export const SiteProvider = ({ children }: { children: ReactNode }) => {
  const persisted = loadPersistedSettings();
  const [contact, setContact] = useState<ContactInfo>(persisted?.contact || DEFAULT_CONTACT);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>(persisted?.customLinks || []);
  const [activeModules, setActiveModules] = useState<ActiveModules>(persisted?.activeModules || DEFAULT_ACTIVE_MODULES);
  const [heroContent, setHeroContent] = useState<HeroContent>(persisted?.heroContent || DEFAULT_HERO_CONTENT);
  const [servicesContent, setServicesContent] = useState<ServiceContent[]>(persisted?.servicesContent || DEFAULT_SERVICES_CONTENT);
  const [footerContent, setFooterContent] = useState<FooterContent>(persisted?.footerContent || DEFAULT_FOOTER_CONTENT);

  const updateContactField = useCallback(<K extends keyof ContactInfo>(key: K, value: ContactInfo[K]) => {
    setContact((prev) => {
      const raw = String(value);
      const nextValue = URL_CONTACT_FIELDS.includes(key) ? ensureHttpsUrl(raw) : raw;
      return {
        ...prev,
        [key]: nextValue,
      };
    });
  }, []);

  const saveSettings = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload: PersistedSiteSettings = {
      contact: normalizeContactForStorage(contact),
      customLinks,
      activeModules,
      heroContent,
      servicesContent,
      footerContent,
    };
    window.localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  }, [contact, customLinks, activeModules, heroContent, servicesContent, footerContent]);

  useEffect(() => {
    saveSettings();
  }, [saveSettings]);

  const value = useMemo(
    () => ({
      contact,
      setContact,
      updateContactField,
      customLinks,
      setCustomLinks,
      activeModules,
      setActiveModules,
      heroContent,
      setHeroContent,
      servicesContent,
      setServicesContent,
      footerContent,
      setFooterContent,
      saveSettings,
    }),
    [
      contact,
      customLinks,
      activeModules,
      heroContent,
      servicesContent,
      footerContent,
      saveSettings,
      updateContactField,
    ]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export const useSiteContext = () => {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSiteContext must be used within a SiteProvider.");
  }
  return context;
};
