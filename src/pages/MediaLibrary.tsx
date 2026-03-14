import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Pencil, Plus, Upload, X } from "lucide-react";
import type { PostgrestError, Session } from "@supabase/supabase-js";

interface StemPayload {
  name?: string;
  url: string;
}

interface StemRowInput {
  id: string;
  name: string;
  file: File | null;
  existingUrl: string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  client: string | null;
  category: string;
  video_url: string | null;
  description: string | null;
  audio_mix_url: string | null;
  stem_1_url: string | null;
  stem_2_url: string | null;
  stem_3_url: string | null;
  stem_4_url: string | null;
  stem_1_name: string | null;
  stem_2_name: string | null;
  stem_3_name: string | null;
  stem_4_name: string | null;
  stems?: StemPayload[] | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: "",
  client: "",
  category: "post-production" as "post-production" | "recording",
  video_url: "",
  description: "",
};

const AUDIO_BUCKET = "audio_files";
const VIDEO_BUCKET = "video_files";

const createStemRow = (name = ""): StemRowInput => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name,
  file: null,
  existingUrl: null,
});

const MediaLibrary = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [audioMixFile, setAudioMixFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [stems, setStems] = useState<StemRowInput[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load projects");
    } else {
      setProjects((data || []) as ProjectRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchProjects();
  }, [session, fetchProjects]);

  const uploadFile = async (file: File, folder: string, bucketName: string = AUDIO_BUCKET): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const contentType = file.type || (bucketName === VIDEO_BUCKET ? "video/mp4" : "audio/mpeg");

    const { error } = await supabase.storage.from(bucketName).upload(path, file, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(`Upload failed for ${file.name}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl || null;
  };

  const normalizedProjectStems = useCallback((p: ProjectRow): StemPayload[] => {
    if (Array.isArray((p as any).stems)) {
      return ((p as any).stems as StemPayload[]).filter((s) => !!s?.url);
    }
    return [
      { name: p.stem_1_name || undefined, url: p.stem_1_url || "" },
      { name: p.stem_2_name || undefined, url: p.stem_2_url || "" },
      { name: p.stem_3_name || undefined, url: p.stem_3_url || "" },
      { name: p.stem_4_name || undefined, url: p.stem_4_url || "" },
    ].filter((s) => !!s.url);
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAudioMixFile(null);
    setVideoFile(null);
    setStems([]);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: ProjectRow) => {
    const normalizedCategory: "post-production" | "recording" =
      p.category === "post" || p.category === "post-production" ? "post-production" : "recording";
    setForm({
      title: p.title,
      client: p.client || "",
      category: normalizedCategory,
      video_url: p.video_url || "",
      description: p.description || "",
    });
    setAudioMixFile(null);
    setVideoFile(null);
    setStems(
      normalizedProjectStems(p).map((s) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: s.name || "",
        file: null,
        existingUrl: s.url,
      }))
    );
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    fetchProjects();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category) {
      toast.error("Title and category are required");
      return;
    }
    setSubmitting(true);

    try {
      let mixUrl: string | null = null;
      if (audioMixFile) {
        mixUrl = await uploadFile(audioMixFile, "audio_mix", AUDIO_BUCKET);
        if (!mixUrl) throw new Error("Failed to upload audio mix");
      }

      let uploadedVideoUrl: string | null = null;
      if (videoFile) {
        uploadedVideoUrl = await uploadFile(videoFile, "video", VIDEO_BUCKET);
        if (!uploadedVideoUrl) throw new Error("Failed to upload video");
      }

      const stemPayload: StemPayload[] = [];
      for (let i = 0; i < stems.length; i++) {
        const stem = stems[i];
        let url = stem.existingUrl || null;
        if (stem.file) {
          url = await uploadFile(stem.file, `stem_${i + 1}`, AUDIO_BUCKET);
        }
        if (url) {
          stemPayload.push({
            name: stem.name.trim() || undefined,
            url,
          });
        }
      }

      const legacy = {
        stem_1_url: stemPayload[0]?.url || null,
        stem_2_url: stemPayload[1]?.url || null,
        stem_3_url: stemPayload[2]?.url || null,
        stem_4_url: stemPayload[3]?.url || null,
        stem_1_name: stemPayload[0]?.name || null,
        stem_2_name: stemPayload[1]?.name || null,
        stem_3_name: stemPayload[2]?.name || null,
        stem_4_name: stemPayload[3]?.name || null,
      };

      const record: Record<string, unknown> = {
        title: form.title.trim(),
        client: form.client.trim() || null,
        category: form.category,
        video_url: uploadedVideoUrl || form.video_url.trim() || null,
        description: form.description.trim() || null,
        stems: stemPayload,
        ...legacy,
      };

      if (editingId) {
        if (!mixUrl) {
          const existing = projects.find((p) => p.id === editingId);
          record.audio_mix_url = existing?.audio_mix_url || null;
        } else {
          record.audio_mix_url = mixUrl;
        }

        const { error } = await supabase.from("projects").update(record as any).eq("id", editingId);
        if (error) throw error;
        toast.success("Project updated successfully");
      } else {
        record.audio_mix_url = mixUrl;
        const { error } = await supabase.from("projects").insert(record as any);
        if (error) throw error;
        toast.success("Project created successfully");
      }

      resetForm();
      fetchProjects();
    } catch (err) {
      console.error("Media library save error:", err);
      const e2 = err as Partial<PostgrestError> & { message?: string };
      const details = [e2.message, e2.details, e2.hint].filter(Boolean).join(" | ");
      toast.error(details || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const stemCountLabel = useMemo(() => {
    return (p: ProjectRow) => normalizedProjectStems(p).length;
  }, [normalizedProjectStems]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 p-8 rounded-lg border border-border bg-card">
          <h1 className="text-xl font-bold text-foreground text-center">Media Library</h1>
          <p className="text-sm text-muted-foreground text-center">Sign in to manage the media library.</p>
          <Button className="w-full" onClick={() => navigate("/auth?redirect=/office/media")}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/office")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to The Office
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Media Library</h1>
            {!showForm && (
              <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-6 rounded-lg border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Project" : "Add New Project"}</h2>
              <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="bg-secondary/50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</label>
                <Input value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} className="bg-secondary/50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category *</label>
                <Select value={form.category} onValueChange={(v: "post-production" | "recording") => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post-production">Post Production</SelectItem>
                    <SelectItem value="recording">Recordings &amp; Mixes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL</label>
                  <Input
                    value={form.video_url}
                    onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload Video File</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-sm">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground/80">{videoFile?.name || "Choose file"}</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                    </label>
                    {videoFile && (
                      <button type="button" onClick={() => setVideoFile(null)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="bg-secondary/50" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audio Mix</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-sm">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground/80">{audioMixFile?.name || "Choose file"}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioMixFile(e.target.files?.[0] || null)} />
                </label>
                {audioMixFile && (
                  <button type="button" onClick={() => setAudioMixFile(null)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem Channels</label>
                <Button type="button" variant="outline" size="sm" onClick={() => setStems((prev) => [...prev, createStemRow()])}>
                  <Plus className="w-4 h-4 mr-1" /> Add Stem Channel
                </Button>
              </div>

              {stems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No stems added yet.</p>
              ) : (
                stems.map((stem, idx) => (
                  <div key={stem.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 p-3 rounded border border-border">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem Name</label>
                      <Input
                        value={stem.name}
                        onChange={(e) =>
                          setStems((prev) => prev.map((s) => (s.id === stem.id ? { ...s, name: e.target.value } : s)))
                        }
                        placeholder={`Stem ${idx + 1}`}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audio File</label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-sm">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground/80">{stem.file?.name || (stem.existingUrl ? "Using existing file" : "Choose file")}</span>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) =>
                              setStems((prev) =>
                                prev.map((s) => (s.id === stem.id ? { ...s, file: e.target.files?.[0] || null } : s))
                              )
                            }
                          />
                        </label>
                        {(stem.file || stem.existingUrl) && (
                          <button
                            type="button"
                            onClick={() =>
                              setStems((prev) =>
                                prev.map((s) => (s.id === stem.id ? { ...s, file: null, existingUrl: null } : s))
                              )
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setStems((prev) => prev.filter((s) => s.id !== stem.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Update Project" : "Create Project"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No projects yet. Create one above.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Stems</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.client || "—"}</TableCell>
                    <TableCell className="capitalize">
                      {p.category === "post" || p.category === "post-production" ? "Post Production" : "Recordings"}
                    </TableCell>
                    <TableCell>{p.video_url ? "✓" : "—"}</TableCell>
                    <TableCell>{stemCountLabel(p)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLibrary;
