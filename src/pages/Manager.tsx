import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { ensureHttpsUrl, useSiteContext } from "@/context/SiteContext";

const Manager = () => {
  const {
    contact,
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
  } = useSiteContext();
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleAddCustomLink = () => {
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!label || !url) return;
    setCustomLinks((prev) => [...prev, { label, url: ensureHttpsUrl(url) }]);
    setLinkLabel("");
    setLinkUrl("");
  };

  const handleSaveChanges = () => {
    saveSettings();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Manager Dashboard</h1>
          <Link
            to="/office"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to The Office
          </Link>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Social &amp; Professional Links</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Email</span>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContactField("email", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Phone</span>
                <input
                  type="text"
                  value={contact.phone}
                  onChange={(e) => updateContactField("phone", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">WhatsApp</span>
                <input
                  type="text"
                  value={contact.whatsapp}
                  onChange={(e) => updateContactField("whatsapp", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">LinkedIn</span>
                <input
                  type="url"
                  value={contact.linkedin}
                  onChange={(e) => updateContactField("linkedin", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Instagram</span>
                <input
                  type="url"
                  value={contact.instagram}
                  onChange={(e) => updateContactField("instagram", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Facebook</span>
                <input
                  type="url"
                  value={contact.facebook}
                  onChange={(e) => updateContactField("facebook", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">X (Twitter)</span>
                <input
                  type="url"
                  value={contact.x}
                  onChange={(e) => updateContactField("x", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">YouTube</span>
                <input
                  type="url"
                  value={contact.youtube}
                  onChange={(e) => updateContactField("youtube", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">IMDb</span>
                <input
                  type="url"
                  value={contact.imdb}
                  onChange={(e) => updateContactField("imdb", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Personal Website</span>
                <input
                  type="url"
                  value={contact.website}
                  onChange={(e) => updateContactField("website", e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Studio Address</span>
                <textarea
                  value={contact.studioAddress}
                  onChange={(e) => updateContactField("studioAddress", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Hero Section</h2>
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Title</span>
                <input
                  type="text"
                  value={heroContent.title}
                  onChange={(e) => setHeroContent((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Subtitle</span>
                <input
                  type="text"
                  value={heroContent.subtitle}
                  onChange={(e) => setHeroContent((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-slate-400">Description</span>
                <textarea
                  rows={4}
                  value={heroContent.description}
                  onChange={(e) => setHeroContent((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Services Section</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {servicesContent.map((service, index) => (
                <div key={`service-${index}`} className="space-y-3 rounded-md border border-slate-800 bg-slate-900/60 p-4">
                  <label className="space-y-2 block">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Service {index + 1} Title</span>
                    <input
                      type="text"
                      value={service.title}
                      onChange={(e) =>
                        setServicesContent((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                    />
                  </label>
                  <label className="space-y-2 block">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Service {index + 1} Description</span>
                    <textarea
                      rows={3}
                      value={service.description}
                      onChange={(e) =>
                        setServicesContent((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Footer Section</h2>
            <label className="space-y-2 block">
              <span className="text-xs uppercase tracking-wider text-slate-400">Copyright Name</span>
              <input
                type="text"
                value={footerContent.copyrightName}
                onChange={(e) => setFooterContent((prev) => ({ ...prev, copyrightName: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
              />
            </label>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Custom Links</h2>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                placeholder="Link Label (e.g. My Podcast)"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
              />
              <input
                type="url"
                placeholder="URL"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleAddCustomLink}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition-colors hover:bg-cyan-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Link
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {customLinks.length === 0 ? (
                <p className="text-sm text-slate-400">No custom links added yet.</p>
              ) : (
                customLinks.map((link, index) => (
                  <div
                    key={`${link.label}-${index}`}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">{link.label}</p>
                      <p className="truncate text-xs text-slate-400">{link.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomLinks((prev) => prev.filter((_, i) => i !== index))}
                      className="ml-3 inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="mb-4 text-lg font-medium text-cyan-300">Services</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={activeModules.allWorks.isEnabled}
                    onChange={(e) =>
                      setActiveModules((prev) => ({
                        ...prev,
                        allWorks: { ...prev.allWorks, isEnabled: e.target.checked },
                      }))
                    }
                    className="accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">All Works</span>
                </div>
                <input
                  type="text"
                  value={activeModules.allWorks.label}
                  onChange={(e) =>
                    setActiveModules((prev) => ({
                      ...prev,
                      allWorks: { ...prev.allWorks, label: e.target.value },
                    }))
                  }
                  placeholder="Display label"
                  className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={activeModules.studio.isEnabled}
                    onChange={(e) =>
                      setActiveModules((prev) => ({
                        ...prev,
                        studio: { ...prev.studio, isEnabled: e.target.checked },
                      }))
                    }
                    className="accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">The Studio</span>
                </div>
                <input
                  type="text"
                  value={activeModules.studio.label}
                  onChange={(e) =>
                    setActiveModules((prev) => ({
                      ...prev,
                      studio: { ...prev.studio, label: e.target.value },
                    }))
                  }
                  placeholder="Display label"
                  className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={activeModules.pictureEdit.isEnabled}
                    onChange={(e) =>
                      setActiveModules((prev) => ({
                        ...prev,
                        pictureEdit: { ...prev.pictureEdit, isEnabled: e.target.checked },
                      }))
                    }
                    className="accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">Picture &amp; Edit</span>
                </div>
                <input
                  type="text"
                  value={activeModules.pictureEdit.label}
                  onChange={(e) =>
                    setActiveModules((prev) => ({
                      ...prev,
                      pictureEdit: { ...prev.pictureEdit, label: e.target.value },
                    }))
                  }
                  placeholder="Display label"
                  className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={activeModules.cinematic.isEnabled}
                    onChange={(e) =>
                      setActiveModules((prev) => ({
                        ...prev,
                        cinematic: { ...prev.cinematic, isEnabled: e.target.checked },
                      }))
                    }
                    className="accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">Cinematic View</span>
                </div>
                <input
                  type="text"
                  value={activeModules.cinematic.label}
                  onChange={(e) =>
                    setActiveModules((prev) => ({
                      ...prev,
                      cinematic: { ...prev.cinematic, label: e.target.value },
                    }))
                  }
                  placeholder="Display label"
                  className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-400"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            {savedFeedback && (
              <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                Settings Saved!
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveChanges}
              className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Manager;
