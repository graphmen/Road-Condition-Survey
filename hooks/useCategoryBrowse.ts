"use client";

import { useCallback, useEffect, useState } from "react";

export type CategoryBrowseQuery = {
  category: string;
  page: number;
  pageSize: number;
  search?: string;
  condition?: string;
  road?: string;
  surveyor?: string;
  province?: string;
  district?: string;
  sadc?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

export type CategoryStats = { total: number; good: number; fair: number; poor: number };

const EMPTY_STATS: CategoryStats = { total: 0, good: 0, fair: 0, poor: 0 };

export function useCategoryBrowse(query: CategoryBrowseQuery) {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<CategoryStats>(EMPTY_STATS);
  const [roads, setRoads] = useState<string[]>([]);
  const [surveyors, setSurveyors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(query.page),
          pageSize: String(query.pageSize),
          category: query.category,
          meta: query.page === 0 ? "1" : "0",
        });
        if (query.search) params.set("search", query.search);
        if (query.condition && query.condition !== "all") params.set("condition", query.condition);
        if (query.road && query.road !== "all") params.set("road", query.road);
        if (query.surveyor && query.surveyor !== "all") params.set("surveyor", query.surveyor);
        if (query.province && query.province !== "all") params.set("province", query.province);
        if (query.district && query.district !== "all") params.set("district", query.district);
        if (query.sadc && query.sadc !== "all") params.set("sadc", query.sadc);
        if (query.sort) params.set("sort", query.sort);
        if (query.dir) params.set("dir", query.dir);

        const res = await fetch(`/api/roads?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        setRecords(Array.isArray(data.records) ? data.records : []);
        setTotal(Number(data.total) || 0);
        if (data.categories && typeof data.categories === "object" && Object.keys(data.categories).length > 0) {
          setCounts(data.categories);
        }
        if (data.stats && typeof data.stats === "object") {
          setStats({
            total: Number(data.stats.total) || 0,
            good: Number(data.stats.good) || 0,
            fair: Number(data.stats.fair) || 0,
            poor: Number(data.stats.poor) || 0,
          });
        }
        if (Array.isArray(data.roads)) setRoads(data.roads);
        if (Array.isArray(data.surveyors)) setSurveyors(data.surveyors);

        const categoryKeys = data.categories && typeof data.categories === "object"
          ? Object.keys(data.categories)
          : [];
        if (query.page === 0 && categoryKeys.length < 8) {
          fetch("/api/roads?counts=1", { cache: "no-store", signal: controller.signal })
            .then((cr) => (cr.ok ? cr.json() : null))
            .then((cd) => {
              if (!alive || !cd?.categories || typeof cd.categories !== "object") return;
              if (Object.keys(cd.categories).length > 0) setCounts(cd.categories);
            })
            .catch(() => {});
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (!alive) return;
        setError(e?.message || "Failed to load records");
        setRecords([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [
    query.category,
    query.page,
    query.pageSize,
    query.search,
    query.condition,
    query.road,
    query.surveyor,
    query.province,
    query.district,
    query.sadc,
    query.sort,
    query.dir,
    tick,
  ]);

  return { records, total, counts, stats, roads, surveyors, loading, error, reload };
}
