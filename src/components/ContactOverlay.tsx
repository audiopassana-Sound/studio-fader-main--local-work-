import { Globe, Linkedin, Mail, MapPin, Phone, X } from "lucide-react";
import { FaFacebook, FaImdb, FaInstagram, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { ensureHttpsUrl, type ContactInfo, useSiteContext } from "@/context/SiteContext";

interface ContactOverlayProps {
  open: boolean;
  onClose: () => void;
}

const ensureTelHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("tel:") ? trimmed : `tel:${trimmed}`;
};

const ensureWhatsAppHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("wa.me/") || trimmed.startsWith("www.")
    ? `https://${trimmed}`
    : `https://wa.me/${trimmed.replace(/[^\d]/g, "")}`;
};

type ContactFieldKey = Exclude<keyof ContactInfo, "studioAddress">;

interface ContactFieldMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  toHref: (value: string) => string;
}

const ContactOverlay = ({ open, onClose }: ContactOverlayProps) => {
  const { contact, customLinks } = useSiteContext();
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fieldMeta: Record<ContactFieldKey, ContactFieldMeta> = {
    email: { label: "Email", icon: Mail, toHref: (value) => (value.trim() ? `mailto:${value.trim()}` : "") },
    phone: { label: "Phone", icon: Phone, toHref: ensureTelHref },
    whatsapp: { label: "WhatsApp", icon: FaWhatsapp, toHref: ensureWhatsAppHref },
    linkedin: { label: "LinkedIn", icon: Linkedin, toHref: ensureHttpsUrl },
    instagram: { label: "Instagram", icon: FaInstagram, toHref: ensureHttpsUrl },
    facebook: { label: "Facebook", icon: FaFacebook, toHref: ensureHttpsUrl },
    x: { label: "X", icon: FaXTwitter, toHref: ensureHttpsUrl },
    youtube: { label: "YouTube", icon: FaYoutube, toHref: ensureHttpsUrl },
    imdb: { label: "IMDb", icon: FaImdb, toHref: ensureHttpsUrl },
    website: { label: "Website", icon: Globe, toHref: ensureHttpsUrl },
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setActivePopover(null);
      setCopied(false);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  }, [open]);

  const handlePopoverToggle = (key: "email" | "phone") => {
    setCopied(false);
    setActivePopover((prev) => (prev === key ? null : key));
  };

  const handleCopyToClipboard = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || typeof navigator === "undefined" || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        setActivePopover(null);
      }, 2000);
    } catch {
      // Ignore clipboard failures to avoid breaking UI interaction.
    }
  };

  const externalKeys: ContactFieldKey[] = ["linkedin", "instagram", "facebook", "x", "youtube", "imdb", "website"];
  const externalContactItems = externalKeys
    .map((key) => {
      const rawValue = contact[key];
      if (!rawValue.trim()) return null;
      const meta = fieldMeta[key];
      const href = meta.toHref(rawValue);
      if (!href) return null;
      return {
        key,
        label: meta.label,
        href,
        Icon: meta.icon,
      };
    })
    .filter(Boolean) as Array<{ key: ContactFieldKey; label: string; href: string; Icon: ContactFieldMeta["icon"] }>;

  const phoneValue = contact.phone.trim();
  const phoneHref = ensureTelHref(phoneValue);
  const whatsappValue = contact.whatsapp.trim();
  const whatsappDigits = whatsappValue.replace(/[^\d]/g, "");
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
  const emailValue = contact.email.trim();

  const hasPrimaryContactButtons = Boolean(emailValue || phoneValue || whatsappHref);
  const hasAnyContacts = useMemo(() => {
    return hasPrimaryContactButtons || externalContactItems.length > 0;
  }, [externalContactItems.length, hasPrimaryContactButtons]);

  const visibleCustomLinks = customLinks
    .map((link) => ({ label: link.label.trim(), href: ensureHttpsUrl(link.url) }))
    .filter((link) => link.label && link.href);

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center px-4 transition-opacity duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-800 bg-slate-950 p-6 md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
          aria-label="Close contact overlay"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-6 text-center text-2xl font-semibold text-cyan-300">Let's Connect</h3>

        {hasAnyContacts && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emailValue && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handlePopoverToggle("email")}
                  className="w-full inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                >
                  <Mail className="h-5 w-5" />
                  <span className="text-base font-medium">Email</span>
                </button>
                {activePopover === "email" && (
                  <div
                    onClick={() => handleCopyToClipboard(emailValue)}
                    className="absolute top-full mt-2 w-full bg-gray-800 rounded p-3 text-center cursor-pointer hover:bg-gray-700 transition-colors z-50 border border-gray-700 text-cyan-400"
                  >
                    {copied ? "Copied! ✓" : emailValue}
                  </div>
                )}
              </div>
            )}

            {phoneValue &&
              (isMobile ? (
                <a
                  href={phoneHref}
                  className="inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-base font-medium">Phone</span>
                </a>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => handlePopoverToggle("phone")}
                    className="w-full inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                  >
                    <Phone className="h-5 w-5" />
                    <span className="text-base font-medium">Phone</span>
                  </button>
                  {activePopover === "phone" && (
                    <div
                      onClick={() => handleCopyToClipboard(phoneValue)}
                      className="absolute top-full mt-2 w-full bg-gray-800 rounded p-3 text-center cursor-pointer hover:bg-gray-700 transition-colors z-50 border border-gray-700 text-cyan-400"
                    >
                      {copied ? "Copied! ✓" : phoneValue}
                    </div>
                  )}
                </div>
              ))}

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
              >
                <FaWhatsapp className="h-5 w-5" />
                <span className="text-base font-medium">WhatsApp</span>
              </a>
            )}

            {externalContactItems.map((item) => {
              const Icon = item.Icon;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-base font-medium">{item.label}</span>
                </a>
              );
            })}
          </div>
        )}

        {visibleCustomLinks.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Custom Links</h4>
            <div className="flex flex-wrap gap-2">
              {visibleCustomLinks.map((link) => (
                <a
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
                >
                  <Globe className="h-4 w-4" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {contact.studioAddress.trim() && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-200">
            <p className="mb-1 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
              <MapPin className="h-4 w-4" />
              Studio Address
            </p>
            <p className="text-sm leading-relaxed">{contact.studioAddress.trim()}</p>
          </div>
        )}

        {!hasAnyContacts && visibleCustomLinks.length === 0 && !contact.studioAddress.trim() && (
          <p className="text-center text-sm text-slate-400">No contact details are available yet.</p>
        )}
      </div>
    </div>
  );
};

export default ContactOverlay;
