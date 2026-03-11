import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Category = "recordings" | "post";

export interface Project {
  id: string;
  name: string;
  category: Category;
  videoUrl?: string;
  audioMixUrl?: string;
  stem1Url?: string;
  stem2Url?: string;
  stem3Url?: string;
  stem4Url?: string;
  stem1Name?: string;
  stem2Name?: string;
  stem3Name?: string;
  stem4Name?: string;
  client?: string;
  description?: string;
}

export function useProjects() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [category, setCategory] = useState<Category>("post");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch projects from database
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch projects:", error);
        return;
      }

      const mapped: Project[] = (data || []).map((row) => ({
        id: row.id,
        name: row.title,
        category: row.category as Category,
        videoUrl: row.video_url || undefined,
        audioMixUrl: row.audio_mix_url || undefined,
        stem1Url: row.stem_1_url || undefined,
        stem2Url: row.stem_2_url || undefined,
        stem3Url: row.stem_3_url || undefined,
        stem4Url: row.stem_4_url || undefined,
        stem1Name: (row as any).stem_1_name || undefined,
        stem2Name: (row as any).stem_2_name || undefined,
        stem3Name: (row as any).stem_3_name || undefined,
        stem4Name: (row as any).stem_4_name || undefined,
        client: row.client || undefined,
        description: row.description || undefined,
      }));

      setAllProjects(mapped);
    };

    load();
  }, []);

  const filtered = useMemo(
    () => allProjects.filter((p) => p.category === category),
    [allProjects, category]
  );

  const currentProject = filtered[currentIndex] ?? filtered[0] ?? null;

  const switchCategory = useCallback((cat: Category) => {
    setCategory(cat);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
  }, [filtered.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0));
  }, [filtered.length]);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const stopPlay = useCallback(() => setIsPlaying(false), []);
  const startPlay = useCallback(() => setIsPlaying(true), []);

  return useMemo(
    () => ({
      category,
      switchCategory,
      currentProject,
      currentIndex,
      projectCount: filtered.length,
      isPlaying,
      togglePlay,
      stopPlay,
      startPlay,
      goNext,
      goPrev,
    }),
    [
      category,
      switchCategory,
      currentProject,
      currentIndex,
      filtered.length,
      isPlaying,
      togglePlay,
      stopPlay,
      startPlay,
      goNext,
      goPrev,
    ]
  );
}
