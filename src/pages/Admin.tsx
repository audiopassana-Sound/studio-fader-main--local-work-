import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Pencil, Plus, LogOut, Upload, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

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
  created_at: string;
}

const EMPTY_FORM = {
  title: "",
  client: "",
  category: "post" as string,
  video_url: "",
  description: "",
  stem_1_name: "",
  stem_2_name: "",
  stem_3_name: "",
  stem_4_name: "",
};

type AudioFiles = {
  audio_mix: File | null;
  stem_1: File | null;
  stem_2: File | null;
  stem_3: File | null;
  stem_4: File | null;
};

const Admin = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [audioFiles, setAudioFiles] = useState<AudioFiles>({
    audio_mix: null,
    stem_1: null,
    stem_2: null,
    stem_3: null,
    stem_4: null,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
      setProjects(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchProjects();
  }, [session, fetchProjects]);

  const uploadFile = async (file: File, folder: string, bucket = "audio_files"): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const contentType =
      file.type ||
      (bucket === "audio_files" ? "video/mp4" : "audio/mpeg");

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("Upload error details:", error);
      toast.error(`Upload failed for ${file.name}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    if (!data.publicUrl) {
      toast.error(`Failed to get public URL for ${file.name}`);
      return null;
    }

    return data.publicUrl;
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAudioFiles({ audio_mix: null, stem_1: null, stem_2: null, stem_3: null, stem_4: null });
    setVideoFile(null);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: ProjectRow) => {
    setForm({
      title: p.title,
      client: p.client || "",
      category: p.category,
      video_url: p.video_url || "",
      description: p.description || "",
      stem_1_name: (p as any).stem_1_name || "",
      stem_2_name: (p as any).stem_2_name || "",
      stem_3_name: (p as any).stem_3_name || "",
      stem_4_name: (p as any).stem_4_name || "",
    });
    setAudioFiles({ audio_mix: null, stem_1: null, stem_2: null, stem_3: null, stem_4: null });
    setVideoFile(null);
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

  const FileInput = ({ label, fileKey }: { label: string; fileKey: keyof AudioFiles }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-sm">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground/80">{audioFiles[fileKey]?.name || "Choose file"}</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setAudioFiles((prev) => ({ ...prev, [fileKey]: e.target.files?.[0] || null }))}
          />
        </label>
        {audioFiles[fileKey] && (
          <button
            type="button"
            onClick={() => setAudioFiles((prev) => ({ ...prev, [fileKey]: null }))}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const VideoFileInput = () => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload Video File</label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-sm">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground/80">{videoFile?.name || "Choose file"}</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
        </label>
        {videoFile && (
          <button
            type="button"
            onClick={() => setVideoFile(null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Uploading stores a public URL into <code className="text-foreground/80">video_url</code> (bucket:{" "}
        <code className="text-foreground/80">video_files</code>).
      </p>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category) {
      toast.error("Title and category are required");
      return;
    }

    setSubmitting(true);

    try {
      const urls: Record<string, string | null> = {
        audio_mix_url: null,
        stem_1_url: null,
        stem_2_url: null,
        stem_3_url: null,
        stem_4_url: null,
      };

      const uploadKeys: { key: keyof AudioFiles; urlKey: string }[] = [
        { key: "audio_mix", urlKey: "audio_mix_url" },
        { key: "stem_1", urlKey: "stem_1_url" },
        { key: "stem_2", urlKey: "stem_2_url" },
        { key: "stem_3", urlKey: "stem_3_url" },
        { key: "stem_4", urlKey: "stem_4_url" },
      ];

      for (const { key, urlKey } of uploadKeys) {
        const file = audioFiles[key];
        if (!file) continue;
        const url = await uploadFile(file, key, "audio_files");
        if (!url) {
          setSubmitting(false);
          return;
        }
        urls[urlKey] = url;
      }

      // Video upload (bucket: video_files). If provided, overrides the Video URL field.
      let uploadedVideoUrl: string | null = null;
      if (videoFile) {
        const url = await uploadFile(videoFile, "video", "audio_files");
        if (!url) {
          toast.error(
            "Video upload failed. Make sure a Supabase Storage bucket named 'video_files' exists and is configured for uploads + public access."
          );
          setSubmitting(false);
          return;
        }
        uploadedVideoUrl = url;
      }

      const record = {
        title: form.title.trim(),
        client: form.client.trim() || null,
        category: form.category === "post" ? "post-production" : "recording",
        video_url: uploadedVideoUrl || form.video_url.trim() || null,
        description: form.description.trim() || null,
        stem_1_name: form.stem_1_name.trim() || null,
        stem_2_name: form.stem_2_name.trim() || null,
        stem_3_name: form.stem_3_name.trim() || null,
        stem_4_name: form.stem_4_name.trim() || null,
        ...urls,
      };

      if (editingId) {
        const updateData: Record<string, unknown> = {
          title: record.title,
          client: record.client,
          category: record.category,
          video_url: record.video_url,
          description: record.description,
          stem_1_name: record.stem_1_name,
          stem_2_name: record.stem_2_name,
          stem_3_name: record.stem_3_name,
          stem_4_name: record.stem_4_name,
        };

        for (const { key, urlKey } of uploadKeys) {
          if (audioFiles[key]) updateData[urlKey] = urls[urlKey];
        }

        const { error } = await supabase.from("projects").update(updateData).eq("id", editingId);
        if (error) throw error;
        toast.success("Project updated successfully");
      } else {
        const { error } = await supabase.from("projects").insert(record);
        if (error) throw error;
        toast.success("Project created successfully");
      }

      resetForm();
      fetchProjects();
    } catch (err) {
      console.error("Admin save error:", err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 p-8 rounded-lg border border-border bg-card">
          <h1 className="text-xl font-bold text-foreground text-center">Admin</h1>
          <p className="text-sm text-muted-foreground text-center">Sign in to manage projects.</p>
          <Button className="w-full" onClick={() => navigate("/auth?redirect=/admin")}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Project Manager</h1>
          <div className="flex gap-2">
            {!showForm && (
              <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
                <Plus className="w-4 h-4 mr-1" /> New Project
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out");
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>

        {/* Form */}
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
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
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
                <VideoFileInput />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="bg-secondary/50" />
            </div>

            <div className="space-y-4">
              <FileInput label="Audio Mix" fileKey="audio_mix" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileInput label="Stem 1" fileKey="stem_1" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem 1 Name</label>
                  <Input value={form.stem_1_name} onChange={(e) => setForm((f) => ({ ...f, stem_1_name: e.target.value }))} placeholder="e.g., Vocals" className="bg-secondary/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileInput label="Stem 2" fileKey="stem_2" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem 2 Name</label>
                  <Input value={form.stem_2_name} onChange={(e) => setForm((f) => ({ ...f, stem_2_name: e.target.value }))} placeholder="e.g., Drums" className="bg-secondary/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileInput label="Stem 3" fileKey="stem_3" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem 3 Name</label>
                  <Input value={form.stem_3_name} onChange={(e) => setForm((f) => ({ ...f, stem_3_name: e.target.value }))} placeholder="e.g., Bass" className="bg-secondary/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileInput label="Stem 4" fileKey="stem_4" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stem 4 Name</label>
                  <Input value={form.stem_4_name} onChange={(e) => setForm((f) => ({ ...f, stem_4_name: e.target.value }))} placeholder="e.g., Guitar" className="bg-secondary/50" />
                </div>
              </div>
            </div>

            {editingId && (
              <p className="text-xs text-muted-foreground">Only re-upload files you want to replace. Existing files are kept otherwise.</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Update Project" : "Create Project"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Projects list */}
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
                  <TableHead>Audio</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.client || "—"}</TableCell>
                    <TableCell className="capitalize">{p.category === "post" ? "Post Production" : "Recordings"}</TableCell>
                    <TableCell>{p.video_url ? "✓" : "—"}</TableCell>
                    <TableCell>
                      {[p.audio_mix_url, p.stem_1_url, p.stem_2_url, p.stem_3_url, p.stem_4_url].filter(Boolean).length}/5
                    </TableCell>
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

export default Admin;
